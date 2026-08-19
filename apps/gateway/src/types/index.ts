// ─────────────────────────────────────────────────────────
// AegisWAF — Core Type Definitions
// ─────────────────────────────────────────────────────────

export type Decision =
  | 'ALLOW'
  | 'BLOCK'
  | 'SHADOW_BLOCK'
  | 'RATE_LIMIT'
  | 'HITL';

// ── Policy structure (mirrors YAML schema) ────────────────

export interface RateLimitRule {
  requests: number;
  window_seconds: number;
}

export interface ParameterRules {
  max_length?: number;
  blocklist_patterns?: string[];
  max_amount?: number;
  [key: string]: unknown;
}

export interface SequenceRule {
  requires: string[];
}

export interface Policy {
  id: string;
  agent: string;
  version: number;
  shadow_mode: boolean;
  rate_limits: Record<string, RateLimitRule>;
  parameter_rules: Record<string, ParameterRules>;
  data_scope: {
    strategy: 'session_binding' | 'open';
    allowed_fields?: string[];
  };
  sequence_rules: Record<string, SequenceRule>;
  risk_weights: Record<string, number>;
  decision_thresholds: {
    allow: [number, number];
    hitl: [number, number];
    block: [number, number];
  };
}

// ── Tool Call Request (from agent) ────────────────────────

export interface ToolCallRequest {
  tool: string;
  parameters: Record<string, unknown>;
  agentId: string;
  sessionId: string;
  customerId?: string; // data scope binding
  requestId: string;
}

// ── Rule evaluation result ─────────────────────────────────

export interface RuleResult {
  rule: string;
  passed: boolean;
  reason?: string;
  detail?: Record<string, unknown>;
}

// ── WAF evaluation result ─────────────────────────────────

export interface WafEvaluationResult {
  requestId: string;
  agentId: string;
  sessionId: string;
  tool: string;
  sanitizedParams: Record<string, unknown>;
  decision: Decision;
  riskScore: number;
  shadowMode: boolean;
  rulesEvaluated: string[];
  matchedRules: string[];
  reason?: string;
  latencyMs: number;
  timestamp: string;
}

// ── Audit event (written to DB) ───────────────────────────

export interface AuditEventPayload {
  eventId: string;
  timestamp: string;
  agentId: string;
  sessionId: string;
  tool: string;
  parameters: Record<string, unknown>; // sanitised
  riskScore: number;
  rulesEvaluated: string[];
  matchedRules: string[];
  decision: Decision;
  shadowMode: boolean;
  reason?: string;
  latencyMs: number;
}

// ── Real-time WebSocket event ─────────────────────────────

export interface WsEvent {
  type: 'TOOL_CALL' | 'BLOCK' | 'ALLOW' | 'HITL' | 'RATE_LIMIT' | 'SHADOW_BLOCK' | 'HITL_RESOLVED';
  payload: AuditEventPayload | Record<string, unknown>;
}
