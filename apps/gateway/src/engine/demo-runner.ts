import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { getRedis } from '../lib/redis';
import { intercept } from './interceptor';
import { publishEvent } from '../realtime/event-bus';
import { toolCallsTotal } from '../observability/metrics';

interface DemoScenario {
  label: string;
  agentId: string;
  tool: string;
  parameters: Record<string, unknown>;
  customerId?: string;
  expectedDecision: string;
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    label: 'Legitimate customer profile lookup',
    agentId: 'agent-customer-support-01',
    tool: 'get_customer',
    parameters: { customer_id: 'C101' },
    customerId: 'C101',
    expectedDecision: 'ALLOW',
  },
  {
    label: 'Normal business customer search',
    agentId: 'agent-customer-support-01',
    tool: 'search_customer',
    parameters: { query: 'Acme Corporation' },
    customerId: 'C101',
    expectedDecision: 'ALLOW',
  },
  {
    label: 'SQL Injection via parameter payload (DROP TABLE)',
    agentId: 'agent-customer-support-01',
    tool: 'update_customer',
    parameters: { customer_id: 'C101', name: "Robert'; DROP TABLE customers; --" },
    customerId: 'C101',
    expectedDecision: 'BLOCK',
  },
  {
    label: 'SQL Injection via UNION SELECT tautology',
    agentId: 'agent-customer-support-01',
    tool: 'search_customer',
    parameters: { query: "' UNION SELECT username, password FROM users --" },
    customerId: 'C101',
    expectedDecision: 'BLOCK',
  },
  {
    label: 'Directory path traversal attempt (../../etc/passwd)',
    agentId: 'agent-customer-support-01',
    tool: 'get_customer',
    parameters: { customer_id: '../../../etc/passwd' },
    customerId: 'C101',
    expectedDecision: 'BLOCK',
  },
  {
    label: 'Broken Object Level Authorization / Cross-tenant BOLA violation',
    agentId: 'agent-customer-support-01',
    tool: 'get_customer',
    parameters: { customer_id: 'C999' },
    customerId: 'C101', // Session is bound to C101
    expectedDecision: 'BLOCK',
  },
  {
    label: 'Workflow Sequence Violation (delete_customer without prior get_customer)',
    agentId: 'agent-customer-support-01',
    tool: 'delete_customer',
    parameters: { customer_id: 'C101' },
    customerId: 'C101',
    expectedDecision: 'BLOCK',
  },
  {
    label: 'High-risk financial wire transfer requiring Human-in-the-Loop review',
    agentId: 'agent-finance-01',
    tool: 'transfer_money',
    parameters: { to: 'Offshore Holding Corp', amount: 50000 },
    customerId: 'C101',
    expectedDecision: 'HITL',
  },
];

/**
 * Runs 8 distinct security scenarios in-process and emits WebSocket events to dashboard
 */
export async function runSecurityDemoSimulation(): Promise<{ executed: number; scenarios: string[] }> {
  const sessionId = `sess-demo-${uuidv4().slice(0, 8)}`;
  const redis = getRedis();
  let count = 0;
  const labels: string[] = [];

  logger.info('Starting in-process security demo simulation', { sessionId });

  // Ensure agents exist in database
  await prisma.agent.upsert({
    where: { id: 'agent-customer-support-01' },
    update: {},
    create: {
      id: 'agent-customer-support-01',
      name: 'customer-support-agent',
      description: 'Customer Support AI Agent',
      apiKey: 'cs-agent-hash',
      role: 'agent',
    },
  });

  await prisma.agent.upsert({
    where: { id: 'agent-finance-01' },
    update: {},
    create: {
      id: 'agent-finance-01',
      name: 'finance-agent',
      description: 'Finance Operations AI Agent',
      apiKey: 'finance-agent-hash',
      role: 'agent',
    },
  });

  for (const scenario of DEMO_SCENARIOS) {
    const requestId = uuidv4();
    labels.push(scenario.label);

    try {
      // Ensure session exists
      await prisma.session.upsert({
        where: { id: sessionId },
        update: { lastActiveAt: new Date() },
        create: {
          id: sessionId,
          agentId: scenario.agentId,
          customerId: scenario.customerId ?? 'C101',
        },
      });

      // Run evaluation
      const result = await intercept(
        {
          agentId: scenario.agentId,
          tool: scenario.tool,
          parameters: scenario.parameters,
          sessionId,
          customerId: scenario.customerId,
          requestId,
        },
        redis
      );

      // Save to database
      await prisma.toolCall.create({
        data: {
          id: requestId,
          agentId: scenario.agentId,
          sessionId,
          tool: scenario.tool,
          rawParameters: scenario.parameters as any,
          sanitizedParams: result.sanitizedParams as any,
          riskScore: result.riskScore,
          decision: result.decision as any,
          shadowMode: result.shadowMode,
          reason: result.reason,
          rulesEvaluated: result.rulesEvaluated,
          matchedRules: result.matchedRules,
          latencyMs: result.latencyMs,
        },
      });

      // Broadcast to WebSocket clients
      await publishEvent({
        eventId: requestId,
        timestamp: new Date().toISOString(),
        agentId: scenario.agentId,
        sessionId,
        tool: scenario.tool,
        parameters: result.sanitizedParams,
        riskScore: result.riskScore,
        rulesEvaluated: result.rulesEvaluated,
        matchedRules: result.matchedRules,
        decision: result.decision as any,
        shadowMode: result.shadowMode,
        reason: result.reason,
        latencyMs: result.latencyMs,
      });

      toolCallsTotal.labels(scenario.agentId, scenario.tool, result.decision).inc();

      // If HITL, enqueue into database
      if (result.decision === 'HITL') {
        await prisma.hitlRequest.create({
          data: {
            toolCallId: requestId,
            agentId: scenario.agentId,
            riskScore: result.riskScore,
            tool: scenario.tool,
            parameters: result.sanitizedParams as any,
            reason: result.reason,
            status: 'PENDING',
          },
        });
      }

      count++;
      // Delay between events for smooth visual animation in dashboard
      await new Promise((r) => setTimeout(r, 200));
    } catch (err: any) {
      logger.error('Error executing demo scenario item', { label: scenario.label, error: err.message });
    }
  }

  return { executed: count, scenarios: labels };
}
