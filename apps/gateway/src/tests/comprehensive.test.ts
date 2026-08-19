import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const GATEWAY_URL = process.env.WAF_GATEWAY_URL ?? 'http://localhost:3001';
const API_KEY = process.env.AGENT_API_KEY ?? 'cs-agent-key-dev-001';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_KEY}`,
};

interface TestCase {
  name: string;
  category: 'ALLOW' | 'DENY' | 'HITL' | 'EDGE_CASE' | 'RATE_LIMIT';
  tool: string;
  parameters: Record<string, unknown>;
  customerId?: string;
  sessionId?: string;
  customHeaders?: Record<string, string>;
  expectedStatus: number;
  expectedDecision?: string;
  expectedRiskMin?: number;
  expectedRiskMax?: number;
  expectedReasonSubstring?: string;
}

const TEST_CASES: TestCase[] = [
  // ─────────────────────────────────────────────────────────────
  // CATEGORY 1: ALLOW (Legitimate business invocations)
  // ─────────────────────────────────────────────────────────────
  {
    name: 'Test 1/17: Normal read_customer (get_customer) with matching customer scope',
    category: 'ALLOW',
    tool: 'get_customer',
    parameters: { customer_id: 'C101' },
    customerId: 'C101',
    expectedStatus: 200,
    expectedDecision: 'ALLOW',
    expectedRiskMin: 0,
    expectedRiskMax: 40,
  },
  {
    name: 'Test 2/17: Normal search_customer with legitimate business query',
    category: 'ALLOW',
    tool: 'search_customer',
    parameters: { query: 'Acme Corporation' },
    customerId: 'C101',
    expectedStatus: 200,
    expectedDecision: 'ALLOW',
    expectedRiskMin: 0,
    expectedRiskMax: 40,
  },
  {
    name: 'Test 3/17: Normal send_email with standard parameters',
    category: 'ALLOW',
    tool: 'send_email',
    parameters: { to: 'support@acme.com', subject: 'Invoice #1024', body: 'Please find attached invoice' },
    customerId: 'C101',
    expectedStatus: 200,
    expectedDecision: 'ALLOW',
    expectedRiskMin: 0,
    expectedRiskMax: 40,
  },

  // ─────────────────────────────────────────────────────────────
  // CATEGORY 2: DENY (Attacks, Injections & Policy Violations)
  // ─────────────────────────────────────────────────────────────
  {
    name: 'Test 4/17: SQL Injection in update_customer name parameter (DROP TABLE)',
    category: 'DENY',
    tool: 'update_customer',
    parameters: { customer_id: 'C101', name: "Robert'; DROP TABLE customers; --" },
    customerId: 'C101',
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    expectedReasonSubstring: 'DROP',
  },
  {
    name: 'Test 5/17: SQL Injection in search_customer query (UNION SELECT)',
    category: 'DENY',
    tool: 'search_customer',
    parameters: { query: "' UNION SELECT username, password FROM users --" },
    customerId: 'C101',
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    expectedReasonSubstring: 'UNION SELECT',
  },
  {
    name: 'Test 6/17: Path Traversal in get_customer (../../../etc/passwd)',
    category: 'DENY',
    tool: 'get_customer',
    parameters: { customer_id: '../../../etc/passwd' },
    customerId: 'C101',
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    expectedReasonSubstring: '../',
  },
  {
    name: 'Test 7/17: Cross-Tenant BOLA Violation (Session bound to C101 accessing C999)',
    category: 'DENY',
    tool: 'get_customer',
    parameters: { customer_id: 'C999' },
    customerId: 'C101', // Session bound to C101
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    expectedReasonSubstring: 'Out-of-scope',
  },
  {
    name: 'Test 8/17: Invalid Sequence State Transition (delete_customer without prior get_customer)',
    category: 'DENY',
    tool: 'delete_customer',
    parameters: { customer_id: 'C101' },
    customerId: 'C101',
    sessionId: `sess-fresh-${uuidv4().slice(0, 8)}`, // fresh session guarantees no prior get_customer
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    expectedReasonSubstring: 'requires',
  },
  {
    name: 'Test 9/17: Forged / Unauthorized API Key',
    category: 'DENY',
    tool: 'get_customer',
    parameters: { customer_id: 'C101' },
    customHeaders: { 'Content-Type': 'application/json', Authorization: 'Bearer forged-invalid-token-xyz' },
    expectedStatus: 401,
  },

  // ─────────────────────────────────────────────────────────────
  // CATEGORY 3: HITL (Human-in-the-Loop High-Risk Operations)
  // ─────────────────────────────────────────────────────────────
  {
    name: 'Test 10/17: High-risk financial wire transfer (transfer_money ₹25,000)',
    category: 'HITL',
    tool: 'transfer_money',
    parameters: { customer_id: 'C101', amount: 25000, recipient: 'Acme Corp' },
    customerId: 'C101',
    expectedStatus: 202,
    expectedDecision: 'HITL',
    expectedRiskMin: 41,
    expectedRiskMax: 90,
  },
  {
    name: 'Test 11/17: Excessive high-value wire transfer (transfer_money ₹45,000)',
    category: 'HITL',
    tool: 'transfer_money',
    parameters: { customer_id: 'C101', amount: 45000, recipient: 'Offshore Holding' },
    customerId: 'C101',
    expectedStatus: 202,
    expectedDecision: 'HITL',
    expectedRiskMin: 41,
    expectedRiskMax: 90,
  },

  // ─────────────────────────────────────────────────────────────
  // CATEGORY 4: EDGE CASES & FUZZING RESILIENCE
  // ─────────────────────────────────────────────────────────────
  {
    name: 'Test 12/17: Missing required parameter object or empty body structure',
    category: 'EDGE_CASE',
    tool: 'get_customer',
    parameters: {},
    customerId: 'C101',
    expectedStatus: 200,
  },
  {
    name: 'Test 13/17: Null & Undefined values in payload parameters',
    category: 'EDGE_CASE',
    tool: 'update_customer',
    parameters: { customer_id: 'C101', name: null, email: undefined },
    customerId: 'C101',
    expectedStatus: 200,
  },
  {
    name: 'Test 14/17: Wrong data types (number instead of string for name)',
    category: 'EDGE_CASE',
    tool: 'update_customer',
    parameters: { customer_id: 'C101', name: 123456789 },
    customerId: 'C101',
    expectedStatus: 200,
  },
  {
    name: 'Test 15/17: Huge oversized string payload (Parameter size exceeds max length limit)',
    category: 'EDGE_CASE',
    tool: 'search_customer',
    parameters: { query: 'A'.repeat(6000) },
    customerId: 'C101',
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    expectedReasonSubstring: 'max length',
  },
  {
    name: 'Test 16/17: Unknown / Unregistered Tool Name Invocation (tool_whitelist check)',
    category: 'EDGE_CASE',
    tool: 'execute_arbitrary_shell_command',
    parameters: { cmd: 'cat /etc/passwd' },
    customerId: 'C101',
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    expectedReasonSubstring: 'Unrecognized',
  },
  {
    name: 'Test 17/17: Direct Two-Phase Execution Bypass (Execute without Evaluate)',
    category: 'EDGE_CASE',
    tool: 'delete_customer',
    parameters: { customer_id: 'C101' },
    expectedStatus: 404, // Must fail execution if not pre-evaluated
  },
];

async function runComprehensiveTests() {
  console.log('\n' + '█'.repeat(75));
  console.log('█  AEGIS WAF — COMPREHENSIVE AUTOMATED VERIFICATION SUITE                  █');
  console.log('█  Covers: ALLOW | DENY | HITL | EDGE CASES | BOLA | SQLi | FUZZING        █');
  console.log('█'.repeat(75) + '\n');

  let passed = 0;
  let failed = 0;
  const primarySession = `sess-comp-${uuidv4().slice(0, 8)}`;

  // First prerequisite for primary session: sequence check
  try {
    await axios.post(
      `${GATEWAY_URL}/api/waf/evaluate`,
      { tool: 'get_customer', parameters: { customer_id: 'C101' }, sessionId: primarySession, customerId: 'C101', requestId: uuidv4() },
      { headers, validateStatus: () => true }
    );
  } catch (e) {
    console.error('❌ Failed to connect to AegisWAF Gateway. Ensure the gateway is running on http://localhost:3001');
    process.exit(1);
  }

  for (const tc of TEST_CASES) {
    const requestId = uuidv4();
    const activeSession = tc.sessionId ?? primarySession;
    const reqHeaders = tc.customHeaders ?? headers;

    let res;
    if (tc.name.includes('Direct Two-Phase Execution Bypass')) {
      // Test direct call to /execute with unapproved fake requestId
      res = await axios.post(
        `${GATEWAY_URL}/api/waf/execute`,
        { requestId: uuidv4(), tool: tc.tool, parameters: tc.parameters },
        { headers: reqHeaders, validateStatus: () => true }
      );
    } else {
      res = await axios.post(
        `${GATEWAY_URL}/api/waf/evaluate`,
        {
          tool: tc.tool,
          parameters: tc.parameters,
          sessionId: activeSession,
          customerId: tc.customerId,
          requestId,
        },
        { headers: reqHeaders, validateStatus: () => true }
      );
    }

    let testPass = true;
    const failureReasons: string[] = [];

    // Validate HTTP Status Code
    if (res.status !== tc.expectedStatus) {
      testPass = false;
      failureReasons.push(`Expected HTTP status ${tc.expectedStatus}, got ${res.status}`);
    }

    // Validate Decision if expected
    if (tc.expectedDecision && res.data?.decision !== tc.expectedDecision) {
      testPass = false;
      failureReasons.push(`Expected decision '${tc.expectedDecision}', got '${res.data?.decision}'`);
    }

    // Validate Reason Substring if expected
    if (tc.expectedReasonSubstring && !res.data?.reason?.includes(tc.expectedReasonSubstring)) {
      testPass = false;
      failureReasons.push(`Reason '${res.data?.reason}' did not contain '${tc.expectedReasonSubstring}'`);
    }

    if (testPass) {
      passed++;
      console.log(`✅ [${tc.category}] ${tc.name}`);
      console.log(`   Status: ${res.status} | Decision: ${res.data?.decision ?? 'N/A'} | Risk: ${res.data?.riskScore ?? 'N/A'}/100`);
      if (res.data?.reason) console.log(`   Reason: "${res.data.reason}"`);
    } else {
      failed++;
      console.log(`❌ [FAILED] ${tc.name}`);
      failureReasons.forEach((r) => console.log(`   🚨 ${r}`));
    }
    console.log('');
  }

  // ─────────────────────────────────────────────────────────────
  // Bonus: Rate Limit Throttling Verification (Sliding Window)
  // ─────────────────────────────────────────────────────────────
  console.log('[RATE_LIMIT] Testing sliding-window rate limit exhaustion (delete_customer limit: 2)...');
  const rateLimitSession = `sess-rate-${uuidv4().slice(0, 8)}`;
  let rateLimitEngaged = false;

  for (let i = 1; i <= 5; i++) {
    const res = await axios.post(
      `${GATEWAY_URL}/api/waf/evaluate`,
      { tool: 'delete_customer', parameters: { customer_id: 'C101' }, sessionId: rateLimitSession, customerId: 'C101', requestId: uuidv4() },
      { headers, validateStatus: () => true }
    );
    if (res.status === 429 && res.data?.decision === 'RATE_LIMIT') {
      rateLimitEngaged = true;
      break;
    }
  }

  if (rateLimitEngaged) {
    passed++;
    console.log('✅ [RATE_LIMIT] Rate Limit Throttling correctly engaged on request quota breach');
  } else {
    failed++;
    console.log('❌ [FAILED] Rate limit failed to throttle excessive requests');
  }

  console.log('\n' + '═'.repeat(75));
  console.log(`📊 FINAL TEST REPORT: ${passed} PASSED | ${failed} FAILED | Total: ${passed + failed}`);
  console.log('═'.repeat(75) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveTests().catch(console.error);
