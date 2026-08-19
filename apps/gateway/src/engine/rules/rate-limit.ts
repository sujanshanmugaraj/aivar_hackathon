import { Redis } from 'ioredis';
import { Policy, RuleResult, ToolCallRequest } from '../../types';
import { logger } from '../../lib/logger';

/**
 * Rule 1: Rate Limiting
 * Uses Redis sliding window counter (token bucket per agent+tool).
 * Key format: waf:rl:{agentId}:{tool}
 */
export async function evaluateRateLimit(
  req: ToolCallRequest,
  policy: Policy,
  redis: Redis
): Promise<RuleResult> {
  const ruleConfig = policy.rate_limits[req.tool] ?? policy.rate_limits['*'];

  if (!ruleConfig) {
    return { rule: 'rate_limit', passed: true };
  }

  const { requests, window_seconds } = ruleConfig;
  const key = `waf:rl:${req.agentId}:${req.tool}`;
  const now = Date.now();
  const windowStart = now - window_seconds * 1000;

  // Sliding window using Redis sorted set
  const pipeline = redis.pipeline();
  // Remove old entries outside window
  pipeline.zremrangebyscore(key, '-inf', windowStart);
  // Add current request
  pipeline.zadd(key, now, `${now}-${req.requestId}`);
  // Count requests in window
  pipeline.zcard(key);
  // Set expiry
  pipeline.expire(key, window_seconds * 2);

  const results = await pipeline.exec();
  const count = results?.[2]?.[1] as number;

  if (count > requests) {
    logger.warn('Rate limit exceeded', {
      agentId: req.agentId,
      tool: req.tool,
      count,
      limit: requests,
      window: window_seconds,
    });
    return {
      rule: 'rate_limit',
      passed: false,
      reason: `Rate limit exceeded: ${count}/${requests} calls in ${window_seconds}s window`,
      detail: { count, limit: requests, window_seconds },
    };
  }

  return {
    rule: 'rate_limit',
    passed: true,
    detail: { count, limit: requests, window_seconds },
  };
}
