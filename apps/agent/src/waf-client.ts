import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const RAW_GATEWAY_URL = process.env.WAF_GATEWAY_URL ?? 'http://localhost:3001';
const GATEWAY_URL = RAW_GATEWAY_URL.startsWith('http://') || RAW_GATEWAY_URL.startsWith('https://')
  ? RAW_GATEWAY_URL
  : `http://${RAW_GATEWAY_URL}`;
const API_KEY = process.env.AGENT_API_KEY ?? 'cs-agent-key-dev-001';
const SESSION_ID = process.env.AGENT_SESSION_ID ?? 'sess-demo-001';

export class WafBlockError extends Error {
  constructor(
    message: string,
    public readonly decision: string,
    public readonly riskScore: number
  ) {
    super(message);
    this.name = 'WafBlockError';
  }
}

/**
 * AegisWAF Client SDK
 *
 * Intercepts tool calls and handles synchronous evaluation, polling for HITL approvals,
 * and authorized two-phase execution.
 */
export class WafClient {
  private readonly headers: Record<string, string>;
  private readonly sessionId: string;
  private readonly customerId: string | undefined;

  constructor(customerId?: string) {
    this.headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    };
    this.sessionId = SESSION_ID;
    this.customerId = customerId;
  }

  async callTool(
    tool: string,
    parameters: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const requestId = uuidv4();

    console.log(`\n[WAF] ⏳ Evaluating: ${tool}`);
    console.log(`[WAF]    RequestID: ${requestId}`);
    console.log(`[WAF]    Params:    ${JSON.stringify(parameters)}`);

    // Step 1: Evaluate
    let evalResponse;
    try {
      evalResponse = await axios.post(
        `${GATEWAY_URL}/api/waf/evaluate`,
        {
          tool,
          parameters,
          sessionId: this.sessionId,
          customerId: this.customerId,
          requestId,
        },
        { headers: this.headers, validateStatus: () => true }
      );
    } catch (err) {
      throw new Error(`WAF unreachable: ${(err as Error).message}`);
    }

    const { decision, riskScore, reason, shadowMode } = evalResponse.data;

    console.log(`[WAF] 🎯 Decision:  ${decision} (risk: ${riskScore})`);
    if (reason) console.log(`[WAF] 📋 Reason:    ${reason}`);
    if (shadowMode) console.log(`[WAF] 👻 Shadow mode active`);

    switch (decision) {
      case 'ALLOW':
      case 'SHADOW_BLOCK': {
        const execResponse = await axios.post(
          `${GATEWAY_URL}/api/waf/execute`,
          { requestId, tool, parameters },
          { headers: this.headers }
        );
        console.log(`[WAF] ✅ Tool executed successfully`);
        return execResponse.data.result;
      }

      case 'BLOCK':
        console.log(`[WAF] 🚫 BLOCKED: ${reason}`);
        throw new WafBlockError(`Tool call blocked: ${reason}`, decision, riskScore);

      case 'RATE_LIMIT':
        console.log(`[WAF] ⏱  RATE LIMITED: ${reason}`);
        throw new WafBlockError(`Rate limit exceeded: ${reason}`, decision, riskScore);

      case 'HITL': {
        console.log(`[WAF] ⚠️  HITL REQUIRED: High-risk action intercepted (Risk ${riskScore}/100)`);
        console.log(`[WAF] 🌐 Live Request added to Dashboard Review Queue: http://localhost:5173/hitl`);
        console.log(`[WAF] ⏳ Waiting up to 45s for Human Compliance Officer Approval...`);

        const startTime = Date.now();
        const timeoutMs = 45000;

        while (Date.now() - startTime < timeoutMs) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const queueRes = await axios.get(`${GATEWAY_URL}/api/hitl/queue`, { headers: this.headers });
            const item = queueRes.data.queue?.find((q: any) => q.toolCallId === requestId);

            // If item is no longer in pending queue, check if it was approved
            if (!item) {
              const execTry = await axios.post(
                `${GATEWAY_URL}/api/waf/execute`,
                { requestId, tool, parameters },
                { headers: this.headers, validateStatus: () => true }
              );

              if (execTry.status === 200 && execTry.data.success) {
                console.log(`[WAF] 🎉 Human Approval Received on Dashboard! Tool executed successfully.`);
                return execTry.data.result;
              } else if (execTry.status === 403) {
                console.log(`[WAF] 🚫 Action was REJECTED by Human Reviewer.`);
                throw new WafBlockError(`Rejected by Human Reviewer`, 'BLOCK', riskScore);
              }
            }
          } catch (pollErr: any) {
            if (pollErr instanceof WafBlockError) throw pollErr;
          }
        }

        throw new WafBlockError(`Operation timed out awaiting Human Approval. Please check http://localhost:5173/hitl`, 'HITL', riskScore);
      }

      default:
        throw new Error(`Unknown WAF decision: ${decision}`);
    }
  }
}
