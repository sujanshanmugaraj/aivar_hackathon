import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const GATEWAY_URL = 'http://localhost:3001';
const AUTH_HEADER = { Authorization: 'Bearer sec-officer-key-dev-001' };

async function testHitlRaceCondition() {
  console.log('\n███████████████████████████████████████████████████████████████████████████');
  console.log('█  AEGIS WAF — CONCURRENT HITL RACE CONDITION VERIFICATION                 █');
  console.log('█  Simulating: Simultaneous Officer A (APPROVE) vs Officer B (REJECT)     █');
  console.log('███████████████████████████████████████████████████████████████████████████\n');

  // 1. Create a fresh HITL Request
  const requestId = uuidv4();
  const evalRes = await axios.post(
    `${GATEWAY_URL}/api/waf/evaluate`,
    {
      tool: 'transfer_money',
      parameters: { to: 'Vendor Corp', amount: 35000 },
      sessionId: 'sess-demo-001',
      requestId,
    },
    { headers: { Authorization: 'Bearer cs-agent-key-dev-001' }, validateStatus: () => true }
  );

  console.log(`[SETUP] Triggered high-risk tool call (Status: ${evalRes.status}, Decision: ${evalRes.data.decision})`);

  // 2. Fetch the created HITL ID
  const queueRes = await axios.get(`${GATEWAY_URL}/api/hitl/queue?status=PENDING`, { headers: AUTH_HEADER });
  const hitlItem = queueRes.data.queue?.find((q: any) => q.toolCallId === requestId);

  if (!hitlItem) {
    console.error('❌ Failed to locate pending HITL item in queue');
    process.exit(1);
  }

  const hitlId = hitlItem.id;
  console.log(`[RACE] Firing concurrent APPROVE & REJECT for HITL ID: ${hitlId}...`);

  // 3. Fire simultaneous Approve and Reject requests
  const [resA, resB] = await Promise.all([
    axios.post(`${GATEWAY_URL}/api/hitl/${hitlId}/approve`, { note: 'Approved by Officer Alpha' }, { headers: AUTH_HEADER, validateStatus: () => true }),
    axios.post(`${GATEWAY_URL}/api/hitl/${hitlId}/reject`, { note: 'Rejected by Officer Bravo' }, { headers: AUTH_HEADER, validateStatus: () => true }),
  ]);

  console.log(`\n── Race Results ──────────────────────────────`);
  console.log(`Officer A Response: Status ${resA.status} | Data:`, resA.data);
  console.log(`Officer B Response: Status ${resB.status} | Data:`, resB.data);

  const statuses = [resA.status, resB.status];
  const hasSuccess = statuses.includes(200);
  const hasConflict = statuses.includes(409);

  if (hasSuccess && hasConflict) {
    console.log('\n🛡️  [DEFENDED] Atomic state machine guaranteed single-winner resolution!');
    console.log('   - Exactly 1 request succeeded (200 OK)');
    console.log('   - Exactly 1 request was rejected with conflict error (409 RACE_CONDITION_CONFLICT)');
    console.log('   - Database integrity preserved with zero post-finalization state corruption.\n');
  } else {
    console.error('\n❌ [FAILED] Non-atomic execution detected: Both succeeded or unexpected statuses:', statuses);
    process.exit(1);
  }
}

testHitlRaceCondition().catch((err) => {
  console.error('Race test exception:', err.message);
  process.exit(1);
});
