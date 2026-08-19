import { prisma } from '../lib/prisma';
import { AuditEventPayload, WafEvaluationResult } from '../types';
import { auditLogger } from '../lib/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Writes a tool call evaluation to the audit log.
 * Parameters are always sanitised before persistence.
 * This record is immutable — never update, only insert.
 */
export async function writeAuditEvent(
  result: WafEvaluationResult
): Promise<string> {
  const eventId = uuidv4();

  const payload: AuditEventPayload = {
    eventId,
    timestamp: result.timestamp,
    agentId: result.agentId,
    sessionId: result.sessionId,
    tool: result.tool,
    parameters: result.sanitizedParams, // already sanitised
    riskScore: result.riskScore,
    rulesEvaluated: result.rulesEvaluated,
    matchedRules: result.matchedRules,
    decision: result.decision,
    shadowMode: result.shadowMode,
    reason: result.reason,
    latencyMs: result.latencyMs,
  };

  try {
    // Ensure session exists
    await prisma.session.upsert({
      where: { id: result.sessionId },
      update: {},
      create: {
        id: result.sessionId,
        agentId: result.agentId,
        customerId: result.sanitizedParams?.customer_id as string ?? result.sanitizedParams?.customerId as string ?? null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Write tool call record
    const toolCall = await prisma.toolCall.create({
      data: {
        id: result.requestId,
        agentId: result.agentId,
        sessionId: result.sessionId,
        tool: result.tool,
        rawParameters: result.sanitizedParams as any, // sanitised replaces raw
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

    // Write immutable audit event
    await prisma.auditEvent.create({
      data: {
        id: eventId,
        toolCallId: toolCall.id,
        eventData: payload as any,
      },
    });

    // Structured audit log (for log drain / CloudWatch)
    auditLogger.info('audit_event', payload as any);
  } catch (err) {
    // Audit failures must never crash the WAF — log and continue
    auditLogger.error('Failed to write audit event', {
      error: (err as Error).message,
      requestId: result.requestId,
    });
  }

  return eventId;
}
