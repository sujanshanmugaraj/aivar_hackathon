import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

const GATEWAY_URL = process.env.WAF_GATEWAY_URL ?? 'http://localhost:3001';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const VALID_KEY = 'cs-agent-key-dev-001';
const INVALID_KEY = 'forged-fake-agent-key-999';

async function runBypassSecurityTests() {
  console.log('\n' + '█'.repeat(65));
  console.log('█  AEGIS WAF — BYPASS RESISTANCE & SECURITY VERIFICATION    █');
  console.log('█'.repeat(65));

  // Reset rate limits before running hermetic security tests
  try {
    const redis = new Redis(REDIS_URL, { lazyConnect: true });
    await redis.connect();
    const keys = await redis.keys('waf:rl:*');
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();
  } catch {
    // Ignore if Redis unreachable directly from runner
  }

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`\n✅ [PASSED] ${testName}`);
      if (detail) console.log(`   ${detail}`);
      passed++;
    } else {
      console.log(`\n❌ [FAILED] ${testName}`);
      if (detail) console.log(`   ${detail}`);
      failed++;
    }
  }

  // ────────────────────────────────────────────
  // Test 1: Direct Tool Execution Without Prior WAF Evaluation
  // ────────────────────────────────────────────
  const unverifiedRequestId = uuidv4();
  const res1 = await axios.post(
    `${GATEWAY_URL}/api/waf/execute`,
    {
      requestId: unverifiedRequestId,
      tool: 'delete_customer',
      parameters: { customer_id: 'C101' },
    },
    {
      headers: { Authorization: `Bearer ${VALID_KEY}`, 'Content-Type': 'application/json' },
      validateStatus: () => true,
    }
  );
  assert(
    res1.status === 404 && res1.data.error === 'EVALUATION_NOT_FOUND',
    'Bypass Defense 1: Direct Tool Execution Without Prior Evaluation is Blocked',
    `Status: ${res1.status} | Error: ${res1.data.error} (Cannot bypass evaluate phase)`
  );

  // ────────────────────────────────────────────
  // Test 2: Direct Execution of a BLOCKED Tool Call
  // ────────────────────────────────────────────
  const blockedRequestId = uuidv4();
  const evalRes = await axios.post(
    `${GATEWAY_URL}/api/waf/evaluate`,
    {
      tool: 'update_customer',
      parameters: { customer_id: 'C101', name: 'DROP TABLE users;' },
      sessionId: `sess-bypass-${uuidv4().slice(0, 8)}`,
      customerId: 'C101',
      requestId: blockedRequestId,
    },
    {
      headers: { Authorization: `Bearer ${VALID_KEY}`, 'Content-Type': 'application/json' },
      validateStatus: () => true,
    }
  );

  const execRes = await axios.post(
    `${GATEWAY_URL}/api/waf/execute`,
    {
      requestId: blockedRequestId,
      tool: 'update_customer',
      parameters: { customer_id: 'C101', name: 'DROP TABLE users;' },
    },
    {
      headers: { Authorization: `Bearer ${VALID_KEY}`, 'Content-Type': 'application/json' },
      validateStatus: () => true,
    }
  );
  assert(
    execRes.status === 403 && execRes.data.error === 'EXECUTION_DENIED',
    'Bypass Defense 2: Blocked Tool Call Cannot Be Executed',
    `Evaluation decision: ${evalRes.data.decision} -> Execution Status: ${execRes.status} (${execRes.data.message})`
  );

  // ────────────────────────────────────────────
  // Test 3: Unauthenticated WAF Evaluation
  // ────────────────────────────────────────────
  const res3 = await axios.post(
    `${GATEWAY_URL}/api/waf/evaluate`,
    {
      tool: 'get_customer',
      parameters: { customer_id: 'C101' },
      sessionId: `sess-bypass-${uuidv4().slice(0, 8)}`,
      requestId: uuidv4(),
    },
    {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    }
  );
  assert(
    res3.status === 401 && res3.data.error === 'UNAUTHORIZED',
    'Bypass Defense 3: Unauthenticated Evaluation Requests Are Rejected',
    `Status: ${res3.status} | Error: ${res3.data.error} (${res3.data.message})`
  );

  // ────────────────────────────────────────────
  // Test 4: Forged / Fake API Key
  // ────────────────────────────────────────────
  const res4 = await axios.post(
    `${GATEWAY_URL}/api/waf/evaluate`,
    {
      tool: 'get_customer',
      parameters: { customer_id: 'C101' },
      sessionId: `sess-bypass-${uuidv4().slice(0, 8)}`,
      requestId: uuidv4(),
    },
    {
      headers: { Authorization: `Bearer ${INVALID_KEY}`, 'Content-Type': 'application/json' },
      validateStatus: () => true,
    }
  );
  assert(
    res4.status === 401 && res4.data.error === 'UNAUTHORIZED',
    'Bypass Defense 4: Forged API Key Rejected by Crypto Hash Verification',
    `Status: ${res4.status} | Error: ${res4.data.error} (${res4.data.message})`
  );

  // ────────────────────────────────────────────
  // Test 5: Authorized Evaluation -> Execution Handshake
  // ────────────────────────────────────────────
  const validRequestId = uuidv4();
  const validEval = await axios.post(
    `${GATEWAY_URL}/api/waf/evaluate`,
    {
      tool: 'get_customer',
      parameters: { customer_id: 'C101' },
      sessionId: `sess-bypass-${uuidv4().slice(0, 8)}`,
      customerId: 'C101',
      requestId: validRequestId,
    },
    {
      headers: { Authorization: `Bearer ${VALID_KEY}`, 'Content-Type': 'application/json' },
      validateStatus: () => true,
    }
  );

  const validExec = await axios.post(
    `${GATEWAY_URL}/api/waf/execute`,
    {
      requestId: validRequestId,
      tool: 'get_customer',
      parameters: { customer_id: 'C101' },
    },
    {
      headers: { Authorization: `Bearer ${VALID_KEY}`, 'Content-Type': 'application/json' },
      validateStatus: () => true,
    }
  );

  assert(
    validEval.data.decision === 'ALLOW' && validExec.status === 200 && validExec.data.success === true,
    'Bypass Defense 5: Legitimate 2-Phase Evaluation-Execution Handshake Succeeds',
    `Evaluate: ${validEval.data.decision} -> Execute: ${JSON.stringify(validExec.data.result)}`
  );

  console.log('\n' + '─'.repeat(65));
  console.log(`🎯 BYPASS RESISTANCE SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('─'.repeat(65) + '\n');

  if (failed > 0) process.exit(1);
}

runBypassSecurityTests().catch(console.error);
