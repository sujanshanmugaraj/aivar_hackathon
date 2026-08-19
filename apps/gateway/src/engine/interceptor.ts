import { Redis } from 'ioredis';
import {
  Decision,
  Policy,
  RuleResult,
  ToolCallRequest,
  WafEvaluationResult,
} from '../types';
import { loadPolicy } from './policy-loader';
import { evaluateRateLimit } from './rules/rate-limit';
import { evaluateParameterValidation, sanitizeParameters } from './rules/parameter-validation';
import { evaluateDataScope } from './rules/data-scope';
import { evaluateSequenceRule, recordAllowedToolCall } from './rules/sequence';
import { calculateRiskScore } from './risk-engine';
import { logger } from '../lib/logger';

/**
 * Central WAF Interceptor
 *
 * Evaluation pipeline:
 *   1. Load policy
 *   2. Rate limit check
 *   3. Parameter validation
 *   4. Data scope check
 *   5. Sequence check
 *   6. Risk scoring
 *   7. Decision
 *   8. Shadow mode conversion (BLOCK → SHADOW_BLOCK if enabled)
 */
export async function intercept(
  req: ToolCallRequest,
  redis: Redis
): Promise<WafEvaluationResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  logger.info('WAF intercepting tool call', {
    requestId: req.requestId,
    agentId: req.agentId,
    tool: req.tool,
    sessionId: req.sessionId,
  });

  // ── 1. Load policy (with schema validation & fault-tolerant fallback) ──
  const policy = await loadPolicy(req.agentId);

  // ── 2. Sanitise parameters ────────────────────────────────
  const sanitizedParams = sanitizeParameters(req.parameters);

  // ── 3. Check registered tools whitelist ──────────────────
  const registeredTools = Object.keys(policy.risk_weights);
  if (!registeredTools.includes(req.tool)) {
    const riskScore = 100;
    const decision = applyDecision('BLOCK', policy);
    return buildResult(
      req, decision, riskScore, policy.shadow_mode,
      ['tool_whitelist'], ['tool_whitelist'],
      `Unrecognized or unauthorized tool invocation: '${req.tool}'`,
      startTime, timestamp, sanitizedParams
    );
  }

  // ── 4. Run all rules in order ─────────────────────────────
  const ruleResults: RuleResult[] = [];

  // Rule 1: Rate Limit
  const rateLimitResult = await evaluateRateLimit(req, policy, redis);
  ruleResults.push(rateLimitResult);
  if (!rateLimitResult.passed) {
    const riskScore = calculateRiskScore(req.tool, policy, ruleResults, req.parameters);
    const decision = applyDecision('RATE_LIMIT', policy);
    return buildResult(
      req, decision, riskScore, policy.shadow_mode,
      ['rate_limit'], ['rate_limit'],
      rateLimitResult.reason, startTime, timestamp, sanitizedParams
    );
  }

  // Rule 2: Parameter Validation
  const paramResult = evaluateParameterValidation(req, policy);
  ruleResults.push(paramResult);
  if (!paramResult.passed) {
    const riskScore = calculateRiskScore(req.tool, policy, ruleResults, req.parameters);
    const decision = applyDecision('BLOCK', policy);
    return buildResult(
      req, decision, riskScore, policy.shadow_mode,
      ['rate_limit', 'parameter_validation'], ['parameter_validation'],
      paramResult.reason, startTime, timestamp, sanitizedParams
    );
  }

  // Rule 3: Data Scope
  const scopeResult = evaluateDataScope(req, policy);
  ruleResults.push(scopeResult);
  if (!scopeResult.passed) {
    const riskScore = calculateRiskScore(req.tool, policy, ruleResults, req.parameters);
    const decision = applyDecision('BLOCK', policy);
    return buildResult(
      req, decision, riskScore, policy.shadow_mode,
      ['rate_limit', 'parameter_validation', 'data_scope'], ['data_scope'],
      scopeResult.reason, startTime, timestamp, sanitizedParams
    );
  }

  // Rule 4: Sequence
  const seqResult = await evaluateSequenceRule(req, policy, redis);
  ruleResults.push(seqResult);
  if (!seqResult.passed) {
    const riskScore = calculateRiskScore(req.tool, policy, ruleResults, req.parameters);
    const decision = applyDecision('BLOCK', policy);
    return buildResult(
      req, decision, riskScore, policy.shadow_mode,
      ['rate_limit', 'parameter_validation', 'data_scope', 'sequence'], ['sequence'],
      seqResult.reason, startTime, timestamp, sanitizedParams
    );
  }

  // ── 4. Risk Score → Final Decision ────────────────────────
  const riskScore = calculateRiskScore(req.tool, policy, ruleResults, req.parameters);
  const allRules = ['rate_limit', 'parameter_validation', 'data_scope', 'sequence'];

  let decision: Decision;
  const [allowMin, allowMax] = policy.decision_thresholds.allow;
  const [hitlMin, hitlMax] = policy.decision_thresholds.hitl;

  if (riskScore >= allowMin && riskScore <= allowMax) {
    decision = 'ALLOW';
  } else if (riskScore >= hitlMin && riskScore <= hitlMax) {
    decision = 'HITL';
  } else {
    decision = 'BLOCK';
  }

  // Apply shadow mode
  if (policy.shadow_mode && decision === 'BLOCK') {
    decision = 'SHADOW_BLOCK';
  }

  // Record successful sequences for ALLOW (and SHADOW_BLOCK passes through)
  if (decision === 'ALLOW' || decision === 'SHADOW_BLOCK') {
    await recordAllowedToolCall(req, redis);
  }

  return buildResult(
    req, decision, riskScore, policy.shadow_mode,
    allRules, [],
    undefined, startTime, timestamp, sanitizedParams
  );
}

// ── Helpers ───────────────────────────────────────────────

function applyDecision(
  base: Decision,
  policy: Policy
): Decision {
  if (policy.shadow_mode && base === 'BLOCK') return 'SHADOW_BLOCK';
  return base;
}

function buildResult(
  req: ToolCallRequest,
  decision: Decision,
  riskScore: number,
  shadowMode: boolean,
  rulesEvaluated: string[],
  matchedRules: string[],
  reason: string | undefined,
  startTime: number,
  timestamp: string,
  sanitizedParams?: Record<string, unknown>
): WafEvaluationResult {
  const latencyMs = Date.now() - startTime;

  logger.info('WAF decision', {
    requestId: req.requestId,
    agentId: req.agentId,
    tool: req.tool,
    decision,
    riskScore,
    latencyMs,
  });

  return {
    requestId: req.requestId,
    agentId: req.agentId,
    sessionId: req.sessionId,
    tool: req.tool,
    sanitizedParams: sanitizedParams ?? sanitizeParameters(req.parameters),
    decision,
    riskScore,
    shadowMode,
    rulesEvaluated,
    matchedRules,
    reason,
    latencyMs,
    timestamp,
  };
}
