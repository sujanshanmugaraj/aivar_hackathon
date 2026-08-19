import { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';

export async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/agents
   * Returns list of registered agents with real-time statistics & risk posture
   */
  fastify.get('/api/agents', async (_req, reply: FastifyReply) => {
    const agents = await prisma.agent.findMany({
      include: {
        toolCalls: {
          select: { decision: true, riskScore: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    const enriched = await Promise.all(
      agents.map(async (agent) => {
        const calls = agent.toolCalls;
        const recentCount = calls.length;
        const totalLifetime = await prisma.toolCall.count({ where: { agentId: agent.id } });

        const allowed = calls.filter((c) => c.decision === 'ALLOW').length;
        const blocked = calls.filter((c) => c.decision === 'BLOCK').length;
        const rateLimited = calls.filter((c) => c.decision === 'RATE_LIMIT').length;
        const hitl = calls.filter((c) => c.decision === 'HITL').length;

        const avgRisk = recentCount > 0 ? Math.round(calls.reduce((sum, c) => sum + c.riskScore, 0) / recentCount) : 10;
        const riskLevel = avgRisk > 60 ? 'HIGH' : avgRisk > 30 ? 'MEDIUM' : 'LOW';
        const lastActivity = calls[0]?.createdAt ? calls[0].createdAt.toISOString() : agent.updatedAt.toISOString();

        return {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          description: agent.description,
          status: 'ACTIVE',
          totalLifetimeRequests: totalLifetime,
          recentRequests: recentCount,
          totalRequests: totalLifetime,
          allowed,
          blocked: blocked + rateLimited,
          hitl,
          avgRiskScore: avgRisk,
          riskLevel,
          lastActivity,
        };
      })
    );

    return reply.send({ agents: enriched });
  });
}
