import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export const metricsRegistry = new Registry();

// Collect default Node.js metrics (memory, CPU, event loop)
collectDefaultMetrics({ register: metricsRegistry });

// ── WAF-specific metrics ───────────────────────────────────

export const toolCallsTotal = new Counter({
  name: 'aegis_tool_calls_total',
  help: 'Total number of tool call evaluations',
  labelNames: ['agent_id', 'tool', 'decision'],
  registers: [metricsRegistry],
});

export const toolCallLatency = new Histogram({
  name: 'aegis_tool_call_latency_ms',
  help: 'WAF evaluation latency in milliseconds',
  labelNames: ['tool', 'decision'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [metricsRegistry],
});

export const riskScoreHistogram = new Histogram({
  name: 'aegis_risk_score',
  help: 'Distribution of risk scores',
  labelNames: ['tool'],
  buckets: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  registers: [metricsRegistry],
});

export const blockedCallsTotal = new Counter({
  name: 'aegis_blocked_calls_total',
  help: 'Total number of blocked tool calls',
  labelNames: ['agent_id', 'tool', 'rule'],
  registers: [metricsRegistry],
});

export const rateLimitHitsTotal = new Counter({
  name: 'aegis_rate_limit_hits_total',
  help: 'Total rate limit violations',
  labelNames: ['agent_id', 'tool'],
  registers: [metricsRegistry],
});

export const hitlPendingGauge = new Gauge({
  name: 'aegis_hitl_pending',
  help: 'Number of HITL requests awaiting review',
  registers: [metricsRegistry],
});

export const wsClientsGauge = new Gauge({
  name: 'aegis_ws_clients_connected',
  help: 'Number of connected WebSocket dashboard clients',
  registers: [metricsRegistry],
});

export const shadowBlocksTotal = new Counter({
  name: 'aegis_shadow_blocks_total',
  help: 'Total shadow mode blocks (would-have-blocked)',
  labelNames: ['agent_id', 'tool', 'rule'],
  registers: [metricsRegistry],
});
