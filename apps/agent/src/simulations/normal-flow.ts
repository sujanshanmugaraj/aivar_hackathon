import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const GATEWAY_URL = process.env.WAF_GATEWAY_URL ?? 'http://localhost:3001';
const API_KEY = process.env.AGENT_API_KEY ?? 'cs-agent-key-dev-001';
const SESSION_ID = 'sess-demo-001';

async function main() {
  console.log('Running normal flow...');
  const res = await axios.post(
    `${GATEWAY_URL}/api/waf/evaluate`,
    {
      tool: 'get_customer',
      parameters: { customer_id: 'C101' },
      sessionId: SESSION_ID,
      customerId: 'C101',
      requestId: uuidv4(),
    },
    { headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' } }
  );
  console.log('Result:', res.data);
}

main().catch(console.error);
