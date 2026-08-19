import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import { publishEvent } from '../realtime/event-bus';
import { hitlPendingGauge } from '../observability/metrics';
import { logger } from '../lib/logger';
import { requireRole } from '../middleware/auth';

const HITL_EXPIRY_THRESHOLD_MS = 60 * 1000; // 60s automated expiry threshold

/**
 * Sweeps all pending HITL requests that have exceeded their authorization lifetime
 * and atomically marks them as EXPIRED in PostgreSQL.
 */
async function expireStaleHitlRequests(): Promise<number> {
  const cutoff = new Date(Date.now() - HITL_EXPIRY_THRESHOLD_MS);

  const staleItems = await prisma.hitlRequest.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
    },
    select: { id: true, toolCallId: true, tool: true, agentId: true },
  });

  if (staleItems.length === 0) return 0;

  for (const item of staleItems) {
    try {
      // Atomic conditional update — only update if still PENDING
      const updated = await prisma.hitlRequest.updateMany({
        where: { id: item.id, status: 'PENDING' },
        data: {
          status: 'EXPIRED',
          reviewedBy: 'SYSTEM_AUTOTIMEOUT',
          reviewNote: 'HITL authorization window expired (60s timeout)',
          resolvedAt: new Date(),
        },
      });

      if (updated.count > 0) {
        await prisma.toolCall.update({
          where: { id: item.toolCallId },
          data: { decision: 'BLOCK', reason: 'HITL Authorization Window Expired' },
        });
        logger.info('HITL request expired automatically', { hitlId: item.id, tool: item.tool });
      }
    } catch (e) {
      logger.warn('Failed to expire HITL item cleanly', { id: item.id, error: (e as Error).message });
    }
  }

  return staleItems.length;
}

export async function hitlRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/hitl/queue
   * Returns HITL requests for dashboard review (supports ?status=PENDING|ALL|APPROVED|REJECTED|EXPIRED).
   */
  fastify.get('/api/hitl/queue', async (req: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
    await expireStaleHitlRequests();

    const statusParam = req.query.status?.toUpperCase() ?? 'PENDING';
    const whereClause = statusParam === 'ALL' ? {} : { status: statusParam as any };

    const items = await prisma.hitlRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        agent: { select: { name: true } },
        toolCall: { select: { sanitizedParams: true, riskScore: true } },
      },
    });

    const pendingCount = await prisma.hitlRequest.count({ where: { status: 'PENDING' } });
    hitlPendingGauge.set(pendingCount);

    return reply.send({ queue: items, count: items.length, pendingCount });
  });

  /**
   * POST /api/hitl/:id/approve
   * Atomically approves a HITL request — guaranteed single-winner under concurrent race conditions.
   */
  fastify.post<{ Params: { id: string }; Body: { note?: string } }>(
    '/api/hitl/:id/approve',
    { preHandler: [requireRole(['security_officer', 'admin'])] },
    async (req, reply) => {
      const hitlId = req.params.id;
      const reviewer = (req as any).agent?.name ?? 'compliance-officer';

      // Atomic conditional update: ONLY transitions if current status === 'PENDING'
      const updateResult = await prisma.hitlRequest.updateMany({
        where: {
          id: hitlId,
          status: 'PENDING',
        },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewer,
          reviewNote: (req.body as any)?.note ?? 'Approved via SOC Console',
          resolvedAt: new Date(),
        },
      });

      // If count === 0, either not found or already resolved by concurrent reviewer
      if (updateResult.count === 0) {
        const existing = await prisma.hitlRequest.findUnique({ where: { id: hitlId } });
        if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });
        return reply.code(409).send({
          error: 'RACE_CONDITION_CONFLICT',
          message: `Request has already been finalized by ${existing.reviewedBy} (Status: ${existing.status}).`,
          status: existing.status,
          reviewedBy: existing.reviewedBy,
        });
      }

      const updatedHitl = await prisma.hitlRequest.findUnique({ where: { id: hitlId } });
      if (!updatedHitl) return reply.code(404).send({ error: 'NOT_FOUND' });

      // Atomically enable tool execution in toolCall
      await prisma.toolCall.update({
        where: { id: updatedHitl.toolCallId },
        data: { decision: 'ALLOW', reason: `Approved by human reviewer: ${reviewer}` },
      });

      // Broadcast resolution event
      await publishEvent({
        eventId: updatedHitl.id,
        timestamp: new Date().toISOString(),
        agentId: updatedHitl.agentId,
        sessionId: '',
        tool: updatedHitl.tool,
        parameters: updatedHitl.parameters as any,
        riskScore: updatedHitl.riskScore,
        rulesEvaluated: [],
        matchedRules: [],
        decision: 'ALLOW',
        shadowMode: false,
        reason: `HITL APPROVED by ${reviewer}`,
        latencyMs: 0,
      });

      hitlPendingGauge.dec();
      logger.info('HITL atomically approved', { hitlId, reviewer });

      return reply.send({ success: true, status: 'APPROVED', reviewedBy: reviewer });
    }
  );

  /**
   * POST /api/hitl/:id/reject
   * Atomically rejects a HITL request — guaranteed single-winner under concurrent race conditions.
   */
  fastify.post<{ Params: { id: string }; Body: { note?: string } }>(
    '/api/hitl/:id/reject',
    { preHandler: [requireRole(['security_officer', 'admin'])] },
    async (req, reply) => {
      const hitlId = req.params.id;
      const reviewer = (req as any).agent?.name ?? 'compliance-officer';

      // Atomic conditional update: ONLY transitions if current status === 'PENDING'
      const updateResult = await prisma.hitlRequest.updateMany({
        where: {
          id: hitlId,
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
          reviewedBy: reviewer,
          reviewNote: (req.body as any)?.note ?? 'Rejected via SOC Console',
          resolvedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        const existing = await prisma.hitlRequest.findUnique({ where: { id: hitlId } });
        if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });
        return reply.code(409).send({
          error: 'RACE_CONDITION_CONFLICT',
          message: `Request has already been finalized by ${existing.reviewedBy} (Status: ${existing.status}).`,
          status: existing.status,
          reviewedBy: existing.reviewedBy,
        });
      }

      const updatedHitl = await prisma.hitlRequest.findUnique({ where: { id: hitlId } });
      if (!updatedHitl) return reply.code(404).send({ error: 'NOT_FOUND' });

      await prisma.toolCall.update({
        where: { id: updatedHitl.toolCallId },
        data: { decision: 'BLOCK', reason: `Rejected by human reviewer: ${reviewer}` },
      });

      await publishEvent({
        eventId: updatedHitl.id,
        timestamp: new Date().toISOString(),
        agentId: updatedHitl.agentId,
        sessionId: '',
        tool: updatedHitl.tool,
        parameters: updatedHitl.parameters as any,
        riskScore: updatedHitl.riskScore,
        rulesEvaluated: [],
        matchedRules: [],
        decision: 'BLOCK',
        shadowMode: false,
        reason: `HITL REJECTED by ${reviewer}`,
        latencyMs: 0,
      });

      hitlPendingGauge.dec();
      logger.info('HITL atomically rejected', { hitlId, reviewer });

      return reply.send({ success: true, status: 'REJECTED', reviewedBy: reviewer });
    }
  );

  /**
   * POST /api/hitl/clear-all
   * Resolves all pending requests in queue — requires 'security_officer' or 'admin' role.
   */
  fastify.post<{ Body: { action?: 'APPROVE' | 'REJECT' } }>(
    '/api/hitl/clear-all',
    { preHandler: [requireRole(['security_officer', 'admin'])] },
    async (req, reply) => {
      const action = req.body?.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const pending = await prisma.hitlRequest.findMany({ where: { status: 'PENDING' } });

      await prisma.hitlRequest.updateMany({
        where: { status: 'PENDING' },
        data: { status: action, reviewedBy: 'admin', resolvedAt: new Date() },
      });

      hitlPendingGauge.set(0);
      return reply.send({ success: true, cleared: pending.length, status: action });
    }
  );
}
