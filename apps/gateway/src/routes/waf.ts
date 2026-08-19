import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getRedis } from '../lib/redis';
import { intercept } from '../engine/interceptor';
import { writeAuditEvent } from '../audit/audit-service';
import { publishEvent } from '../realtime/event-bus';
import {
  toolCallsTotal,
  toolCallLatency,
  riskScoreHistogram,
  blockedCallsTotal,
  rateLimitHitsTotal,
  shadowBlocksTotal,
} from '../observability/metrics';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { config } from '../lib/config';
import { ToolCallRequest } from '../types';
import { requireRole } from '../middleware/auth';

const EvaluateSchema = z.object({
  tool: z.string().min(1).max(100),
  parameters: z.record(z.unknown()).default({}),
  sessionId: z.string().min(1),
  customerId: z.string().optional(),
  requestId: z.string().uuid().default(() => uuidv4()),
});

export async function wafRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/waf/evaluate
   * Main WAF evaluation endpoint. Called by agents before every tool execution.
   * Returns a decision: ALLOW | BLOCK | SHADOW_BLOCK | RATE_LIMIT | HITL
   */
  fastify.post(
    '/api/waf/evaluate',
    {
      schema: {
        description: 'Evaluate a tool call against WAF policies',
        tags: ['WAF'],
        body: {
          type: 'object',
          required: ['tool', 'sessionId'],
          properties: {
            tool: { type: 'string' },
            parameters: { type: 'object' },
            sessionId: { type: 'string' },
            customerId: { type: 'string' },
            requestId: { type: 'string', format: 'uuid' },
          },
        },
      },
    } as any,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const agent = (req as any).agent; // set by auth middleware

      const parsed = EvaluateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'INVALID_REQUEST',
          details: parsed.error.format(),
        });
      }

      const { tool, parameters, sessionId, customerId, requestId } = parsed.data;

      const toolCallReq: ToolCallRequest = {
        tool,
        parameters,
        agentId: agent.id,
        sessionId,
        customerId,
        requestId,
      };

      // ── Replay Attack Prevention ─────────────────────────
      const existingCall = await prisma.toolCall.findUnique({ where: { id: requestId } });
      if (existingCall) {
        logger.warn('Replay attack detected: Duplicate requestId evaluated', { requestId, agentId: agent.id });
        return reply.code(409).send({
          error: 'REPLAY_ATTACK_DETECTED',
          message: `Request ID ${requestId} has already been evaluated. Duplicate replay is blocked.`,
          decision: 'BLOCK',
        });
      }

      // Run WAF evaluation
      const redis = getRedis();
      const result = await intercept(toolCallReq, redis);

      // Write audit log (non-blocking)
      const eventId = await writeAuditEvent(result);

      // Publish to dashboard (non-blocking)
      publishEvent({ ...result.sanitizedParams as any, ...result, eventId } as any).catch(() => {});

      // Update Prometheus metrics
      toolCallsTotal.labels(agent.id, tool, result.decision).inc();
      toolCallLatency.labels(tool, result.decision).observe(result.latencyMs);
      riskScoreHistogram.labels(tool).observe(result.riskScore);

      if (result.decision === 'BLOCK' || result.decision === 'RATE_LIMIT') {
        blockedCallsTotal.labels(agent.id, tool, result.matchedRules[0] ?? 'unknown').inc();
      }
      if (result.decision === 'RATE_LIMIT') {
        rateLimitHitsTotal.labels(agent.id, tool).inc();
      }
      if (result.decision === 'SHADOW_BLOCK') {
        shadowBlocksTotal.labels(agent.id, tool, result.matchedRules[0] ?? 'unknown').inc();
      }

      // If HITL — create HITL request in DB
      if (result.decision === 'HITL') {
        await createHitlRequest(result, agent.id, tool, result.sanitizedParams);
      }

      const statusCode = result.decision === 'ALLOW' || result.decision === 'SHADOW_BLOCK' ? 200 :
        result.decision === 'RATE_LIMIT' ? 429 :
        result.decision === 'HITL' ? 202 : 403;

      return reply.code(statusCode).send({
        requestId: result.requestId,
        decision: result.decision,
        riskScore: result.riskScore,
        reason: result.reason,
        shadowMode: result.shadowMode,
        latencyMs: result.latencyMs,
        eventId,
      });
    }
  );

  /**
   * POST /api/waf/execute
   * Execute a tool call that was previously evaluated and ALLOWED.
   * Requires 'agent', 'security_officer', or 'admin' role.
   */
  fastify.post(
    '/api/waf/execute',
    { preHandler: [requireRole(['agent', 'admin', 'security_officer'])] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as { requestId: string; tool: string; parameters: Record<string, unknown> };

      // Verify the request was previously evaluated and ALLOWED
      const toolCall = await prisma.toolCall.findUnique({
        where: { id: body.requestId },
      });

      if (!toolCall) {
        return reply.code(404).send({ error: 'EVALUATION_NOT_FOUND', message: 'Call /api/waf/evaluate first' });
      }

      if (toolCall.decision !== 'ALLOW' && toolCall.decision !== 'SHADOW_BLOCK') {
        return reply.code(403).send({
          error: 'EXECUTION_DENIED',
          message: `Tool execution denied — decision was ${toolCall.decision}`,
        });
      }

      // Check execution idempotency in Redis & DB
      const redis = getRedis();
      const execCacheKey = `exec:idempotency:${body.requestId}`;
      const existingExec = await redis.get(execCacheKey);

      if (existingExec) {
        logger.warn('Duplicate execution intercepted (Idempotency Key)', { requestId: body.requestId, tool: body.tool });
        return reply.send({
          success: true,
          idempotent: true,
          message: 'Execution already processed for this request ID (returned from idempotent cache)',
          result: JSON.parse(existingExec),
        });
      }

      // Execute the mock tool
      const toolResult = await executeMockTool(body.tool, body.parameters);

      // Cache execution result for 24h to guarantee idempotency
      await redis.setex(execCacheKey, 86400, JSON.stringify(toolResult));

      logger.info('Tool executed', { tool: body.tool, requestId: body.requestId });

      return reply.send({ success: true, idempotent: false, result: toolResult });
    }
  );
}

async function createHitlRequest(
  result: any,
  agentId: string,
  tool: string,
  parameters: Record<string, unknown>
): Promise<void> {
  const expiresAt = new Date(Date.now() + config.HITL_TIMEOUT_MINUTES * 60 * 1000);

  await prisma.hitlRequest.create({
    data: {
      toolCallId: result.requestId,
      agentId,
      riskScore: result.riskScore,
      tool,
      parameters: parameters as any,
      reason: result.reason,
    },
  }).catch((err: Error) => logger.error('Failed to create HITL request', { error: err.message }));
}

// Mock enterprise tool executor (replace with real MCP in production)
async function executeMockTool(
  tool: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const mockData: Record<string, () => Record<string, unknown>> = {
    get_customer: () => ({
      id: params.customer_id,
      name: 'Alice Johnson',
      email: 'alice@example.com',
      status: 'active',
      tier: 'premium',
    }),
    search_customer: () => ({
      results: [
        { id: 'C101', name: 'Alice Johnson', email: 'alice@example.com' },
        { id: 'C102', name: 'Bob Smith', email: 'bob@example.com' },
      ],
      total: 2,
    }),
    update_customer: () => ({
      id: params.customer_id,
      updated: true,
      changes: params,
      timestamp: new Date().toISOString(),
    }),
    delete_customer: () => ({
      id: params.customer_id,
      deleted: true,
      timestamp: new Date().toISOString(),
    }),
    send_email: () => ({
      messageId: `msg_${Date.now()}`,
      recipient: params.to,
      status: 'queued',
    }),
    transfer_money: () => ({
      transactionId: `txn_${Date.now()}`,
      amount: params.amount,
      status: 'processing',
    }),
  };

  const handler = mockData[tool];
  if (!handler) return { error: 'UNKNOWN_TOOL', tool };

  // Simulate tool latency
  await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
  return handler();
}
