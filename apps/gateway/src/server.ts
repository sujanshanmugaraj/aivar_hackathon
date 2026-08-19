import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { config } from './lib/config';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { getRedis, closeRedis } from './lib/redis';
import { initEventBus, registerWsClient, deregisterWsClient } from './realtime/event-bus';
import { authenticate } from './middleware/auth';
import { wafRoutes } from './routes/waf';
import { auditRoutes } from './routes/audit';
import { hitlRoutes } from './routes/hitl';
import { agentRoutes } from './routes/agents';
import { systemRoutes } from './routes/system';
import { wsClientsGauge } from './observability/metrics';

async function buildServer() {
  const fastify = Fastify({
    logger: false, // Winston handles structured logging
    trustProxy: true,
    requestTimeout: 30000,
  });

  // ── Plugins ─────────────────────────────────────────────
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  await fastify.register(websocket);

  // ── Global auth hook ─────────────────────────────────────
  fastify.addHook('preHandler', authenticate);

  // ── WebSocket endpoint ───────────────────────────────────
  fastify.get('/events', { websocket: true }, (socket) => {
    logger.info('Dashboard client connected via WebSocket');
    registerWsClient(socket);
    wsClientsGauge.inc();

    socket.on('close', () => {
      deregisterWsClient(socket);
      wsClientsGauge.dec();
      logger.info('Dashboard client disconnected');
    });

    socket.on('error', (err: Error) => {
      logger.error('WebSocket error', { error: err.message });
      deregisterWsClient(socket);
      wsClientsGauge.dec();
    });

    socket.send(JSON.stringify({ type: 'CONNECTED', payload: { message: 'AegisWAF live event stream connected' } }));
  });

  // ── Routes ───────────────────────────────────────────────
  await fastify.register(systemRoutes);
  await fastify.register(wafRoutes);
  await fastify.register(auditRoutes);
  await fastify.register(hitlRoutes);
  await fastify.register(agentRoutes);

  // ── Global Hardened Error Handler ────────────────────────
  fastify.setErrorHandler((error, req, reply) => {
    logger.error('Intercepted application exception', {
      error: error.message,
      code: error.code,
      url: req.url,
      method: req.method,
      stack: error.stack,
    });

    // 1. Handle Schema / JSON Validation Errors
    if (error.validation || error.code === 'FST_ERR_VALIDATION') {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'INVALID_REQUEST_SCHEMA',
          message: 'The request payload is malformed or failed schema validation.',
          details: error.validation ?? error.message,
        },
      });
    }

    // 2. Handle Database / Prisma Failures
    if (error.name?.includes('Prisma') || error.message?.includes('database') || error.message?.includes('ConnectionRefused')) {
      return reply.code(503).send({
        success: false,
        error: {
          code: 'DATABASE_SERVICE_UNAVAILABLE',
          message: 'The persistence layer is temporarily unavailable. Please retry shortly.',
        },
      });
    }

    // 3. Handle Redis / Cache Connection Failures
    if (error.name?.includes('Redis') || error.message?.includes('redis') || error.message?.includes('ECONNREFUSED')) {
      return reply.code(503).send({
        success: false,
        error: {
          code: 'RATE_LIMITER_SERVICE_UNAVAILABLE',
          message: 'The distributed rate limiter is temporarily unavailable.',
        },
      });
    }

    // 4. Handle HTTP Timeouts
    if (error.code === 'FST_ERR_REQUEST_TIMEOUT' || error.statusCode === 408) {
      return reply.code(408).send({
        success: false,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'The policy evaluation exceeded the maximum allowed latency threshold.',
        },
      });
    }

    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;

    // Controlled Production Response (No Internal Stack Trace Exposure)
    return reply.code(statusCode).send({
      success: false,
      error: {
        code: error.code ?? 'WAF_INTERNAL_ERROR',
        message: 'Security gateway encountered an error while processing the request.',
      },
    });
  });

  return fastify;
}

async function main() {
  logger.info('🛡 Starting AegisWAF Gateway...');

  try {
    await prisma.$connect();
    logger.info('✅ PostgreSQL connected');
  } catch (err) {
    logger.error('❌ PostgreSQL connection failed', { error: (err as Error).message });
    process.exit(1);
  }

  try {
    const redis = getRedis();
    await redis.ping();
    logger.info('✅ Redis connected');
  } catch (err) {
    logger.error('❌ Redis connection failed', { error: (err as Error).message });
    process.exit(1);
  }

  await initEventBus();
  logger.info('✅ Event bus initialized');

  const server = await buildServer();

  try {
    await server.listen({ port: config.PORT, host: config.HOST });
    logger.info(`🚀 AegisWAF Gateway running on ${config.HOST}:${config.PORT}`);
    logger.info(`📊 Dashboard API: http://localhost:${config.PORT}/api`);
    logger.info(`📡 WebSocket events: ws://localhost:${config.PORT}/events`);
    logger.info(`❤️  Health: http://localhost:${config.PORT}/health`);
    logger.info(`📈 Metrics: http://localhost:${config.PORT}/metrics`);
  } catch (err) {
    logger.error('❌ Server startup failed', { error: (err as Error).message });
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await server.close();
    await prisma.$disconnect();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal server boot failure', { error: err.message });
  process.exit(1);
});

export { buildServer };
