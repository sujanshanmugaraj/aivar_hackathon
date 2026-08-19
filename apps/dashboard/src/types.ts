// Types shared across the dashboard
export type Decision = 'ALLOW' | 'BLOCK' | 'SHADOW_BLOCK' | 'RATE_LIMIT' | 'HITL';

export interface AuditEvent {
  id: string;
  agentId: string;
  sessionId: string;
  tool: string;
  sanitizedParams: Record<string, unknown>;
  riskScore: number;
  decision: Decision;
  shadowMode: boolean;
  reason?: string;
  rulesEvaluated: string[];
  matchedRules: string[];
  latencyMs: number;
  createdAt: string;
}

export interface Stats {
  total: number;
  byDecision: Record<Decision, number>;
  recentBlocks: AuditEvent[];
}

export interface HitlRequest {
  id: string;
  agentId: string;
  tool: string;
  riskScore: number;
  parameters: Record<string, unknown>;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
  resolvedAt?: string;
  reviewedBy?: string;
  agent?: { name: string };
}

export interface WsEvent {
  type: Decision | 'CONNECTED' | 'HITL_RESOLVED';
  payload: AuditEvent & { message?: string };
}
