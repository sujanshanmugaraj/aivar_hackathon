import { Policy, RuleResult, ToolCallRequest } from '../../types';
import { logger } from '../../lib/logger';

// PII/sensitive field names to mask in logs
const SENSITIVE_FIELDS = [
  'password', 'token', 'secret', 'credit_card', 'ssn', 'cvv',
  'account_number', 'pin', 'api_key', 'private_key',
];

/**
 * Sanitise a single string value — mask it if it looks like PII.
 */
function sanitizeValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const keyLower = key.toLowerCase();
  if (SENSITIVE_FIELDS.some((f) => keyLower.includes(f))) {
    return '***REDACTED***';
  }
  return value;
}

/**
 * Recursively sanitise all parameters before logging.
 */
export function sanitizeParameters(
  params: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      sanitized[k] = sanitizeParameters(v as Record<string, unknown>);
    } else {
      sanitized[k] = sanitizeValue(k, v);
    }
  }
  return sanitized;
}

/**
 * Rule 2: Parameter Validation
 * Checks blocklist patterns, max length, and type-specific rules.
 */
export function evaluateParameterValidation(
  req: ToolCallRequest,
  policy: Policy
): RuleResult {
  // Merge tool-specific rules on top of wildcard rules
  const wildcardRules = policy.parameter_rules['*'] ?? {};
  const toolRules = policy.parameter_rules[req.tool] ?? {};
  const rules = { ...wildcardRules, ...toolRules };

  const violations: string[] = [];

  const checkValue = (key: string, value: unknown): void => {
    const strVal = String(value ?? '');

    // 1. Max length check
    if (rules.max_length && strVal.length > rules.max_length) {
      violations.push(
        `Parameter '${key}' exceeds max length (${strVal.length} > ${rules.max_length})`
      );
    }

    // 2. Blocklist pattern check
    if (rules.blocklist_patterns) {
      for (const pattern of rules.blocklist_patterns) {
        const regex = new RegExp(
          pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*'),
          'i'
        );
        if (regex.test(strVal)) {
          violations.push(
            `Parameter '${key}' matches blocked pattern: "${pattern}" (value truncated for safety)`
          );
        }
      }
    }

    // 3. SQL injection heuristic
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE)\b)/i,
      /(--|;|\bOR\b\s+\d+\s*=\s*\d+|\bAND\b\s+\d+\s*=\s*\d+)/i,
      /UNION\s+SELECT/i,
      /'\s*;\s*--/i,
    ];
    for (const re of sqlPatterns) {
      if (re.test(strVal)) {
        violations.push(`Parameter '${key}' contains SQL injection pattern`);
        break;
      }
    }

    // 4. Path traversal check
    if (/\.\.(\/|\\)/.test(strVal)) {
      violations.push(`Parameter '${key}' contains path traversal attempt`);
    }

    // 5. Tool-specific numeric checks
    if (key === 'amount' && rules.max_amount) {
      const numVal = Number(value);
      if (!isNaN(numVal) && numVal > rules.max_amount) {
        violations.push(
          `Parameter '${key}' amount ${numVal} exceeds max ${rules.max_amount}`
        );
      }
    }
  };

  const traverse = (obj: Record<string, unknown>, prefix = ''): void => {
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        traverse(v as Record<string, unknown>, fullKey);
      } else {
        checkValue(fullKey, v);
      }
    }
  };

  traverse(req.parameters);

  if (violations.length > 0) {
    logger.warn('Parameter validation failed', {
      agentId: req.agentId,
      tool: req.tool,
      violations,
    });
    return {
      rule: 'parameter_validation',
      passed: false,
      reason: violations[0],
      detail: { violations },
    };
  }

  return { rule: 'parameter_validation', passed: true };
}
