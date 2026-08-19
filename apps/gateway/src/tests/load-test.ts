import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const GATEWAY_URL = process.env.WAF_GATEWAY_URL ?? 'http://localhost:3001';
const API_KEY = process.env.AGENT_API_KEY ?? 'cs-agent-key-dev-001';
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_KEY}`,
};

interface LatencyResult {
  latencyMs: number;
  statusCode: number;
  decision: string;
  success: boolean;
}

function calculatePercentiles(latencies: number[]) {
  if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  return { p50, p95, p99, min, max, avg };
}

async function sendRequest(sessionId: string, tool: string, parameters: Record<string, unknown>): Promise<LatencyResult> {
  const start = Date.now();
  try {
    const res = await axios.post(
      `${GATEWAY_URL}/api/waf/evaluate`,
      {
        tool,
        parameters,
        sessionId,
        customerId: 'C101',
        requestId: uuidv4(),
      },
      { headers: HEADERS, validateStatus: () => true }
    );
    const latencyMs = Date.now() - start;
    return {
      latencyMs,
      statusCode: res.status,
      decision: res.data?.decision ?? 'UNKNOWN',
      success: res.status === 200 || res.status === 403 || res.status === 429 || res.status === 202,
    };
  } catch {
    return {
      latencyMs: Date.now() - start,
      statusCode: 500,
      decision: 'ERROR',
      success: false,
    };
  }
}

async function runBenchmark(concurrentWorkers: number, totalRequests: number, testName: string) {
  console.log('\n' + '═'.repeat(65));
  console.log(`🚀 LOAD TEST: ${testName}`);
  console.log(`   Target: ${GATEWAY_URL} | Total Requests: ${totalRequests} | Concurrency: ${concurrentWorkers}`);
  console.log('═'.repeat(65));

  const tools = ['get_customer', 'search_customer', 'update_customer', 'send_email'];
  const results: LatencyResult[] = [];
  const startTime = Date.now();

  let completed = 0;
  const queue: number[] = Array.from({ length: totalRequests }, (_, i) => i);

  async function worker(workerId: number) {
    const sessionId = `sess-load-w${workerId}-${uuidv4().slice(0, 8)}`;
    while (queue.length > 0) {
      const idx = queue.shift();
      if (idx === undefined) break;
      const tool = tools[idx % tools.length];
      const params = tool === 'get_customer'
        ? { customer_id: 'C101' }
        : tool === 'search_customer'
        ? { query: `load_test_${idx}` }
        : tool === 'update_customer'
        ? { customer_id: 'C101', address: 'Bangalore' }
        : { to: 'user@example.com', subject: 'Load test', body: 'Test' };

      const res = await sendRequest(sessionId, tool, params);
      results.push(res);
      completed++;
    }
  }

  const workers = Array.from({ length: concurrentWorkers }, (_, i) => worker(i));
  await Promise.all(workers);

  const totalTimeSeconds = (Date.now() - startTime) / 1000;
  const rps = Math.round(totalRequests / totalTimeSeconds);

  const latencies = results.map((r) => r.latencyMs);
  const percentiles = calculatePercentiles(latencies);

  const errorCount = results.filter((r) => !r.success || r.statusCode >= 500).length;
  const errorRate = ((errorCount / totalRequests) * 100).toFixed(2);

  const decisions: Record<string, number> = {};
  for (const r of results) {
    decisions[r.decision] = (decisions[r.decision] ?? 0) + 1;
  }

  console.log('\n📊 BENCHMARK METRICS:');
  console.log(`   ⏱  Total Duration:     ${totalTimeSeconds.toFixed(2)}s`);
  console.log(`   ⚡ Throughput:         ${rps} req/sec`);
  console.log(`   📈 Latency P50 (median):${percentiles.p50}ms`);
  console.log(`   📈 Latency P95:         ${percentiles.p95}ms`);
  console.log(`   📈 Latency P99:         ${percentiles.p99}ms`);
  console.log(`   📉 Latency Min / Max:   ${percentiles.min}ms / ${percentiles.max}ms (avg ${percentiles.avg}ms)`);
  console.log(`   ❌ Error Rate:          ${errorRate}% (${errorCount}/${totalRequests})`);
  console.log(`   🛡  WAF Decisions:      ${JSON.stringify(decisions)}`);

  return { rps, percentiles, errorRate, decisions, totalTimeSeconds };
}

async function main() {
  console.log('\n' + '█'.repeat(65));
  console.log('█  AEGIS WAF — PRODUCTION CONCURRENCY & LATENCY BENCHMARK   █');
  console.log('█'.repeat(65));

  // Benchmark 1: 100 Concurrent Connections, 500 requests
  await runBenchmark(100, 500, '100 Concurrent Workers (500 Requests)');

  // Benchmark 2: 250 Concurrent Connections, 1000 requests
  await runBenchmark(250, 1000, '250 Concurrent Workers (1000 Requests)');

  console.log('\n' + '█'.repeat(65));
  console.log('█  CONCURRENCY BENCHMARK SUITE COMPLETE                     █');
  console.log('█'.repeat(65) + '\n');
}

main().catch(console.error);
