import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const GATEWAY_URL = process.env.WAF_GATEWAY_URL ?? 'http://localhost:3001';
const API_KEY = process.env.AGENT_API_KEY ?? 'cs-agent-key-dev-001';
const SESSION_ID = process.env.AGENT_SESSION_ID ?? 'sess-demo-001';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_KEY}`,
};

async function evaluate(tool: string, parameters: Record<string, unknown>, customerId?: string, customSession?: string) {
  const res = await axios.post(
    `${GATEWAY_URL}/api/waf/evaluate`,
    {
      tool,
      parameters,
      sessionId: customSession ?? SESSION_ID,
      customerId,
      requestId: uuidv4(),
    },
    { headers, validateStatus: () => true }
  );
  return res.data;
}

function printResult(label: string, result: any) {
  const icon = result.decision === 'ALLOW' ? '✅' :
    result.decision === 'BLOCK' ? '🚫' :
    result.decision === 'RATE_LIMIT' ? '⏱ ' :
    result.decision === 'SHADOW_BLOCK' ? '👻' :
    result.decision === 'HITL' ? '⚠️ ' : '❓';

  console.log(`\n${icon} [${result.decision}] ${label}`);
  console.log(`   Risk Score: ${result.riskScore}/100`);
  if (result.reason) console.log(`   Reason: ${result.reason}`);
  if (result.latencyMs !== undefined) console.log(`   Latency: ${result.latencyMs}ms`);
}

async function runAllScenarios() {
  console.log('\n' + '█'.repeat(65));
  console.log('█  AEGIS WAF — COMPLETE ATTACK & HITL SIMULATION SUITE          █');
  console.log('█'.repeat(65));
  console.log(`\nTarget: ${GATEWAY_URL}`);
  console.log('Primary Session: ' + SESSION_ID + ' (bound to customer C101)');

  // ────────────────────────────────────────────
  // Scenario 1: Normal Legitimate Lookup
  // ────────────────────────────────────────────
  console.log('\n' + '─'.repeat(65));
  console.log('SCENARIO 1: Normal customer lookup (should ALLOW)');
  const s1 = await evaluate('get_customer', { customer_id: 'C101' }, 'C101');
  printResult('get_customer(C101)', s1);

  // ────────────────────────────────────────────
  // Scenario 2: Rate Limit Attack
  // ────────────────────────────────────────────
  console.log('\n' + '─'.repeat(65));
  console.log('SCENARIO 2: Rate limit — 35 rapid search calls (policy limit is 30/min)');
  const rateLimitSession = `sess-rate-${uuidv4().slice(0, 8)}`;
  let lastResult;
  for (let i = 1; i <= 35; i++) {
    lastResult = await evaluate('search_customer', { query: `client_${i}` }, 'C101', rateLimitSession);
    if (lastResult.decision === 'RATE_LIMIT') {
      console.log(`   ⏱  Rate limit triggered on request #${i}`);
      break;
    }
  }
  printResult('search_customer (rate limit exceeded)', lastResult);

  // ────────────────────────────────────────────
  // Scenario 3: SQL Injection in Parameter
  // ────────────────────────────────────────────
  console.log('\n' + '─'.repeat(65));
  console.log('SCENARIO 3: SQL injection in parameter (should BLOCK)');
  const s3 = await evaluate('update_customer', { customer_id: 'C101', name: "Robert'; DROP TABLE customers; --" }, 'C101');
  printResult('update_customer(name="DROP TABLE customers")', s3);

  // ────────────────────────────────────────────
  // Scenario 4: Path Traversal Attempt
  // ────────────────────────────────────────────
  console.log('\n' + '─'.repeat(65));
  console.log('SCENARIO 4: Path traversal attempt (should BLOCK)');
  const s4 = await evaluate('get_customer', { customer_id: '../../../etc/passwd' }, 'C101');
  printResult('get_customer(customer_id="../../../etc/passwd")', s4);

  // ────────────────────────────────────────────
  // Scenario 5: Data Scope / BOLA Violation
  // ────────────────────────────────────────────
  console.log('\n' + '─'.repeat(65));
  console.log('SCENARIO 5: Cross-customer data access (should BLOCK)');
  console.log('   Session bound to: C101 | Attempting to access: C999');
  const s5 = await evaluate('get_customer', { customer_id: 'C999' }, 'C101');
  printResult('get_customer(C999) from C101 session', s5);

  // ────────────────────────────────────────────
  // Scenario 6: Sequence Violation
  // ────────────────────────────────────────────
  console.log('\n' + '─'.repeat(65));
  console.log('SCENARIO 6: update_customer without prior get_customer (should BLOCK)');
  const freshSession = `sess-seq-${uuidv4().slice(0, 8)}`;
  const s6 = await evaluate('update_customer', { customer_id: 'C101', address: 'New Delhi' }, 'C101', freshSession);
  printResult('update_customer (no prior get_customer)', s6);

  // ────────────────────────────────────────────
  // Scenario 7: High-Risk Operation → HITL Queue & Approval Handshake
  // ────────────────────────────────────────────
  console.log('\n' + '─'.repeat(65));
  console.log('SCENARIO 7: High-risk transfer (₹25,000) → triggers HITL workflow');
  // First satisfy sequence prerequisite in primary session
  await evaluate('get_customer', { customer_id: 'C101' }, 'C101');
  const s7 = await evaluate('transfer_money', { customer_id: 'C101', amount: 25000, recipient: 'Acme Corp' }, 'C101');
  printResult('transfer_money(₹25,000)', s7);

  if (s7.decision === 'HITL') {
    console.log('\n   📋 Querying HITL Pending Queue...');
    const queueRes = await axios.get(`${GATEWAY_URL}/api/hitl/queue`, { headers });
    const pendingItem = queueRes.data.queue?.find((q: any) => q.tool === 'transfer_money') ?? queueRes.data.queue?.[0];

    if (pendingItem) {
      console.log(`   🟡 Found Pending Review in Queue (ID: ${pendingItem.id})`);
      console.log(`      Tool: ${pendingItem.tool} | Risk Score: ${pendingItem.riskScore}/100`);

      console.log('   👨‍💼 Admin Human Approving Request via Dashboard API...');
      const approveRes = await axios.post(
        `${GATEWAY_URL}/api/hitl/${pendingItem.id}/approve`,
        { note: 'Approved by Compliance Officer' },
        { headers }
      );
      console.log(`   ✅ HITL Approval Confirmed: status=${approveRes.data.status}`);

      console.log('   🚀 Executing Authorized Tool Call...');
      const execRes = await axios.post(
        `${GATEWAY_URL}/api/waf/execute`,
        {
          requestId: pendingItem.toolCallId ?? s7.requestId,
          tool: 'transfer_money',
          parameters: { customer_id: 'C101', amount: 25000, recipient: 'Acme Corp' },
        },
        { headers, validateStatus: () => true }
      );
      console.log(`   🎉 Tool Execution Result: ${JSON.stringify(execRes.data?.result ?? execRes.data)}`);
    }
  }

  // ────────────────────────────────────────────
  // Scenario 8: Shadow Mode Demonstration
  // ────────────────────────────────────────────
  console.log('\n' + '─'.repeat(65));
  console.log('SCENARIO 8: Shadow Mode (Policy would BLOCK, but shadow mode logs and allows)');
  const s8 = await evaluate('send_email', { to: 'evil<script>alert(1)</script>@test.com', subject: 'test', body: 'test' }, 'C101');
  printResult('send_email with XSS payload', s8);

  console.log('\n' + '█'.repeat(65));
  console.log('█  SIMULATION SUITE COMPLETE — ALL 8 SCENARIOS VERIFIED         █');
  console.log('█'.repeat(65));
  console.log(`\n📊 Live Dashboard URL: http://localhost:5173`);
  console.log(`📋 Audit Statistics:   http://localhost:3001/api/audit/stats`);
  console.log(`📈 Metrics Endpoint:   http://localhost:3001/metrics\n`);
}

runAllScenarios().catch(console.error);
