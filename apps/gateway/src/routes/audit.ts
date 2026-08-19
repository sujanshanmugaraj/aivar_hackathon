import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const QuerySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().max(100).default(20),
  agentId: z.string().optional(),
  tool: z.string().optional(),
  decision: z.enum(['ALLOW', 'BLOCK', 'SHADOW_BLOCK', 'RATE_LIMIT', 'HITL']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function auditRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/audit/events
   * Paginated audit log with filters.
   */
  fastify.get(
    '/api/audit/events',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = QuerySchema.safeParse(req.query);
      if (!query.success) return reply.code(400).send({ error: 'INVALID_QUERY' });

      const { page, limit, agentId, tool, decision, from, to } = query.data;

      const where: any = {};
      if (agentId) where.agentId = agentId;
      if (tool) where.tool = tool;
      if (decision) where.decision = decision;
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) where.createdAt.lte = new Date(to);
      }

      const [events, total] = await Promise.all([
        prisma.toolCall.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { auditEvent: { select: { id: true, createdAt: true } } },
        }),
        prisma.toolCall.count({ where }),
      ]);

      return reply.send({
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  );

  /**
   * GET /api/audit/events/:id
   */
  fastify.get(
    '/api/audit/events/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const event = await prisma.toolCall.findUnique({
        where: { id: req.params.id },
        include: { auditEvent: true, session: true },
      });

      if (!event) return reply.code(404).send({ error: 'NOT_FOUND' });
      return reply.send(event);
    }
  );

  /**
   * GET /api/audit/stats
   * Aggregated statistics for the dashboard overview.
   */
  fastify.get('/api/audit/stats', async (_req, reply: FastifyReply) => {
    const [total, byDecision, recentBlocks] = await Promise.all([
      prisma.toolCall.count(),
      prisma.toolCall.groupBy({
        by: ['decision'],
        _count: { _all: true },
      }),
      prisma.toolCall.findMany({
        where: { decision: { in: ['BLOCK', 'RATE_LIMIT', 'SHADOW_BLOCK'] } },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, agentId: true, tool: true, decision: true, reason: true, riskScore: true, createdAt: true },
      }),
    ]);

    const stats = { total, byDecision: {} as Record<string, number>, recentBlocks };
    for (const row of byDecision) {
      stats.byDecision[row.decision] = row._count._all;
    }

    return reply.send(stats);
  });
}
