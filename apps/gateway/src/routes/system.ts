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
}
