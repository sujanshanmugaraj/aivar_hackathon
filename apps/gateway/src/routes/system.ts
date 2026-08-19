import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import { metricsRegistry } from '../observability/metrics';
import { getRedis } from '../lib/redis';

export async function systemRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /health
   * Detailed health check endpoint validating PostgreSQL, Redis, and overall subsystem health.
   */
  fastify.get('/health', async (_req, reply: FastifyReply) => {
    let dbStatus = 'healthy';
    let redisStatus = 'healthy';

    // 1. Check PostgreSQL connection
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'unhealthy';
    }

    // 2. Check Redis connection
    try {
      const ping = await getRedis().ping();
      if (ping !== 'PONG') redisStatus = 'unhealthy';
    } catch {
      redisStatus = 'unhealthy';
    }

    const isHealthy = dbStatus === 'healthy' && redisStatus === 'healthy';
    const statusCode = isHealthy ? 200 : 503;

    return reply.code(statusCode).send({
      status: isHealthy ? 'healthy' : 'degraded',
      service: 'aegis-waf-gateway',
      database: dbStatus,
      redis: redisStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  /**
   * GET /ready
   * Kubernetes / ECS ALB readiness probe.
   */
  fastify.get('/ready', async (_req, reply: FastifyReply) => {
    const checks: Record<string, 'ok' | 'error'> = {};

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.postgresql = 'ok';
    } catch {
      checks.postgresql = 'error';
    }

    try {
      await getRedis().ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }

    const healthy = Object.values(checks).every((v) => v === 'ok');
    const statusCode = healthy ? 200 : 503;

    return reply.code(statusCode).send({
      status: healthy ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /metrics
   * Prometheus standard metrics endpoint with P50/P95/P99 latency histograms,
   * error counts, rule triggers, and active connections.
   */
  fastify.get('/metrics', async (_req, reply: FastifyReply) => {
    const metrics = await metricsRegistry.metrics();
    return reply.header('Content-Type', metricsRegistry.contentType).send(metrics);
  });

  /**
   * POST /api/system/run-demo
   * Triggers the full evaluation suite directly in-process for immediate live WebSocket telemetry
   */
  fastify.post('/api/system/run-demo', async (_req, reply: FastifyReply) => {
    try {
      const { runSecurityDemoSimulation } = await import('../engine/demo-runner');
      const { executed } = await runSecurityDemoSimulation();
      return reply.send({ success: true, executed, message: `Security demo simulation launched (${executed} events streamed)` });
    } catch (e: any) {
      return reply.code(500).send({ success: false, error: e.message });
    }
  });

  /**
   * POST /api/system/nlp-parse
   * Parses a natural-language user prompt into a structured {agentId, tool, parameters} intent.
   * Rule-based NLP — no LLM dependency, sub-millisecond latency, fully auditable.
   */
  fastify.post('/api/system/nlp-parse', async (req: FastifyRequest, reply: FastifyReply) => {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== 'string') {
      return reply.code(400).send({ error: 'prompt is required' });
    }

    const text = prompt.toLowerCase().trim();

    // ── Finance agent intents ────────────────────────────────────────────────
    const transferMatch =
      text.match(/transfer\s+[\$₹€£]?([\d,]+)\s+to\s+([\w\s]+)/i) ||
      text.match(/send\s+[\$₹€£]?([\d,]+)\s+to\s+([\w\s]+)/i) ||
      text.match(/wire\s+[\$₹€£]?([\d,]+)\s+to\s+([\w\s]+)/i) ||
      text.match(/pay\s+([\w\s]+)\s+[\$₹€£]?([\d,]+)/i);

    if (transferMatch) {
      const rawAmount = (transferMatch[1] ?? '0').replace(/,/g, '');
      const recipient = (transferMatch[2] ?? 'Unknown').trim();
      return reply.send({
        agentId: 'agent-finance-01',
        tool: 'transfer_money',
        parameters: { to: recipient, amount: parseFloat(rawAmount) },
        confidence: 0.97,
        intent: 'financial_transfer',
        reasoning: `Detected financial transfer intent. Recipient: "${recipient}", Amount: ${rawAmount}`,
      });
    }

    if (/(send|compose|email|notify|message)\s+(customer|user|client|them)/i.test(text)) {
      const toMatch = text.match(/to\s+([\w.@]+)/i);
      return reply.send({
        agentId: 'agent-customer-support-01',
        tool: 'send_email',
        parameters: { to: toMatch?.[1] ?? 'customer@example.com', subject: 'Notification', body: prompt },
        confidence: 0.88,
        intent: 'send_notification',
        reasoning: 'Detected email/notification intent',
      });
    }

    // ── Customer-support agent intents ───────────────────────────────────────
    const deleteMatch = text.match(/delete\s+(?:customer|user|account)\s*(c\d+)?/i);
    if (deleteMatch || /(remove|purge|deactivate)\s+(customer|account|user)/i.test(text)) {
      const idMatch = text.match(/\b(c\d{3,6})\b/i);
      return reply.send({
        agentId: 'agent-customer-support-01',
        tool: 'delete_customer',
        parameters: { customer_id: idMatch?.[1]?.toUpperCase() ?? 'C101' },
        confidence: 0.92,
        intent: 'delete_customer',
        reasoning: `Detected customer deletion intent. Customer ID: ${idMatch?.[1] ?? 'C101'}`,
      });
    }

    const updateMatch =
      /(update|change|modify|set|rename|edit)\s+(customer|user|account|name|email|address)/i.test(text);
    if (updateMatch) {
      const idMatch = text.match(/\b(c\d{3,6})\b/i);
      // Detect SQL injection patterns
      const sqlPayload = text.match(/'[^']*'|--|;|union|select|drop|insert|delete|exec/i);
      const nameMatch = text.match(/name\s+(?:to|=)?\s*["']?([^"',;]+)["']?/i);
      return reply.send({
        agentId: 'agent-customer-support-01',
        tool: 'update_customer',
        parameters: {
          customer_id: idMatch?.[1]?.toUpperCase() ?? 'C101',
          name: sqlPayload ? text.match(/name\s+(?:to\s+)?(.+)/i)?.[1] ?? prompt : nameMatch?.[1]?.trim() ?? 'Updated Name',
        },
        confidence: 0.85,
        intent: 'update_customer',
        reasoning: `Detected customer update intent${sqlPayload ? ' — payload contains potential SQL pattern' : ''}`,
      });
    }

    const searchMatch = /(search|find|look\s+up|query|list)\s+(customer|user|account)/i.test(text);
    if (searchMatch) {
      // Extract search query — everything after the keyword
      const queryPart = text.replace(/(search|find|look\s+up|query|list)\s+(customer|user|account)\s*(for|where|matching|with)?\s*/i, '').trim();
      return reply.send({
        agentId: 'agent-customer-support-01',
        tool: 'search_customer',
        parameters: { query: queryPart || prompt },
        confidence: 0.9,
        intent: 'search_customer',
        reasoning: `Detected customer search intent. Query: "${queryPart || prompt}"`,
      });
    }

    // BOLA: access another customer's data
    const foreignIdMatch = text.match(/\b(c\d{3,6})\b/i);
    const getKeywords = /(get|fetch|show|view|retrieve|access|check|profile|info|detail)/i.test(text);
    if (getKeywords) {
      const customerId = foreignIdMatch?.[1]?.toUpperCase() ?? 'C101';
      return reply.send({
        agentId: 'agent-customer-support-01',
        tool: 'get_customer',
        parameters: { customer_id: customerId },
        confidence: 0.93,
        intent: 'get_customer',
        reasoning: `Detected customer lookup intent. Customer ID: ${customerId}${customerId !== 'C101' ? ' — cross-tenant access (BOLA risk)' : ''}`,
      });
    }

    // Fallback: ambiguous
    return reply.send({
      agentId: 'agent-customer-support-01',
      tool: 'get_customer',
      parameters: { customer_id: 'C101' },
      confidence: 0.4,
      intent: 'unknown',
      reasoning: `Could not confidently detect intent from: "${prompt}". Defaulting to get_customer C101.`,
    });
  });
}

