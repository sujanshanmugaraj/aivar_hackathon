import { Redis } from 'ioredis';
import { Policy, RuleResult, ToolCallRequest } from '../../types';
import { logger } from '../../lib/logger';

// Key format: waf:seq:{agentId}:{sessionId}
const SESSION_TTL_SECONDS = 3600; // 1 hour

/**
 * Rule 4: Sequence Rules
 * Maintains a Redis-backed session state machine.
 * Blocks tool B unless tool A was previously called in this session.
 */
export async function evaluateSequenceRule(
  req: ToolCallRequest,
  policy: Policy,
  redis: Redis
): Promise<RuleResult> {
  const seqRule = policy.sequence_rules[req.tool];

  if (!seqRule) {
    // No sequence requirement — record the call and allow
    await recordToolCall(req, redis);
    return { rule: 'sequence', passed: true };
  }

  // Get the tool call history for this session
  const historyKey = `waf:seq:${req.agentId}:${req.sessionId}`;
  const history = await redis.smembers(historyKey);

  const missingPrereqs = seqRule.requires.filter(
    (prereq) => !history.includes(prereq)
  );

  if (missingPrereqs.length > 0) {
    logger.warn('Sequence rule violation', {
      agentId: req.agentId,
      sessionId: req.sessionId,
      tool: req.tool,
      requires: seqRule.requires,
      missing: missingPrereqs,
      history,
    });
    return {
      rule: 'sequence',
      passed: false,
      reason: `Tool '${req.tool}' requires ${missingPrereqs.map((p) => `'${p}'`).join(', ')} to be called first in this session`,
      detail: {
        requires: seqRule.requires,
        missing: missingPrereqs,
        history,
      },
    };
  }

  // Prerequisites satisfied — record and allow
  await recordToolCall(req, redis);
  return {
    rule: 'sequence',
    passed: true,
    detail: { requires: seqRule.requires, history },
  };
}

/**
 * Record a successful (ALLOW) tool call into session history.
 * Called after final ALLOW decision to track sequence state.
 */
export async function recordAllowedToolCall(
  req: ToolCallRequest,
  redis: Redis
): Promise<void> {
  await recordToolCall(req, redis);
}

async function recordToolCall(req: ToolCallRequest, redis: Redis): Promise<void> {
  const historyKey = `waf:seq:${req.agentId}:${req.sessionId}`;
  await redis.sadd(historyKey, req.tool);
  await redis.expire(historyKey, SESSION_TTL_SECONDS);
}
