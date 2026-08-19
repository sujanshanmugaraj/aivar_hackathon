import { Policy, RuleResult } from '../types';

/**
 * Risk Engine
 * Computes a 0–100 risk score based on:
 *   - Base tool sensitivity (from policy weights)
 *   - Matched rule violations (additive penalties)
 *   - Parameter characteristics
 */
export function calculateRiskScore(
  tool: string,
  policy: Policy,
  ruleResults: RuleResult[],
  parameters: Record<string, unknown>
): number {
  // 1. Base score from policy weight
  let score = policy.risk_weights[tool] ?? 20;

  // 2. Additive penalties for each rule violation
  const penalties: Record<string, number> = {
    rate_limit: 30,
    parameter_validation: 35,
    data_scope: 40,
    sequence: 25,
  };

  for (const result of ruleResults) {
    if (!result.passed) {
      score += penalties[result.rule] ?? 20;
    }
  }

  // 3. Parameter size anomaly (very large payloads are suspicious)
  const paramStr = JSON.stringify(parameters);
  if (paramStr.length > 5000) score += 10;
  if (paramStr.length > 10000) score += 15;

  // 4. High-value amount anomaly
  const amount = extractAmount(parameters);
  if (amount !== null) {
    if (amount > 10000) score += 10;
    if (amount > 50000) score += 20;
    if (amount > 100000) score += 30;
  }

  return Math.min(100, Math.max(0, score));
}

function extractAmount(params: Record<string, unknown>): number | null {
  const amountKeys = ['amount', 'value', 'price', 'total', 'sum'];
  for (const key of amountKeys) {
    if (key in params) {
      const v = Number(params[key]);
      if (!isNaN(v)) return v;
    }
  }
  return null;
}
