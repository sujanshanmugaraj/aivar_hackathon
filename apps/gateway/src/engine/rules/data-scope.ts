import { Policy, RuleResult, ToolCallRequest } from '../../types';
import { logger } from '../../lib/logger';

/**
 * Rule 3: Data Scope Enforcement
 * Ensures the agent only accesses data within its declared session scope.
 *
 * Strategy: session_binding
 *   The session has a customerId. Any tool call that references a different
 *   customerId in its parameters is blocked.
 */
export function evaluateDataScope(
  req: ToolCallRequest,
  policy: Policy
): RuleResult {
  const { strategy } = policy.data_scope;

  // Open strategy — no scope enforcement
  if (strategy === 'open') {
    return { rule: 'data_scope', passed: true };
  }

  // Session binding strategy
  const sessionCustomerId = req.customerId;

  if (!sessionCustomerId) {
    // No scope declared on session — allow but note it
    return {
      rule: 'data_scope',
      passed: true,
      detail: { note: 'No session scope declared — scope check skipped' },
    };
  }

  // Extract all customer_id-like fields from parameters
  const requestedIds = extractCustomerIds(req.parameters);

  if (requestedIds.length === 0) {
    return { rule: 'data_scope', passed: true };
  }

  const violations = requestedIds.filter((id) => id !== sessionCustomerId);

  if (violations.length > 0) {
    logger.warn('Data scope violation', {
      agentId: req.agentId,
      tool: req.tool,
      sessionCustomerId,
      requestedIds,
      violations,
    });
    return {
      rule: 'data_scope',
      passed: false,
      reason: `Out-of-scope data access: session bound to ${sessionCustomerId}, attempted access to ${violations.join(', ')}`,
      detail: {
        sessionCustomerId,
        requestedIds,
        violations,
      },
    };
  }

  return {
    rule: 'data_scope',
    passed: true,
    detail: { sessionCustomerId, requestedIds },
  };
}

/**
 * Recursively find all values of customer_id-like fields.
 */
function extractCustomerIds(params: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const customerIdKeys = ['customer_id', 'customerId', 'customer', 'cid', 'user_id', 'userId'];

  const traverse = (obj: Record<string, unknown>): void => {
    for (const [k, v] of Object.entries(obj)) {
      if (customerIdKeys.includes(k) && typeof v === 'string') {
        ids.push(v);
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        traverse(v as Record<string, unknown>);
      }
    }
  };

  traverse(params);
  return [...new Set(ids)];
}
