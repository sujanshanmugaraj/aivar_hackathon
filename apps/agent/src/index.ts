import readline from 'readline';
import dotenv from 'dotenv';
import http from 'http';
import { runAgent } from './agent';

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;

/**
 * Starts a lightweight HTTP server so web dashboards and Render workers can query the Agent
 */
function startHttpServer() {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', service: 'aegis-agent', timestamp: new Date().toISOString() }));
      return;
    }

    if (req.url === '/api/agent/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const message = parsed.message || parsed.prompt;
          const customerId = parsed.customerId || 'C101';

          if (!message) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing message or prompt in request body' }));
            return;
          }

          console.log(`[HTTP AGENT] Received prompt: "${message}" for customer ${customerId}`);
          const agentResult = await runAgent(message, customerId);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, result: agentResult }));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'NOT_FOUND' }));
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Agent HTTP Server running on http://0.0.0.0:${PORT} (POST /api/agent/chat)`);
  });
}

async function startInteractiveCli() {
  console.log('\n' + '█'.repeat(65));
  console.log('█  AEGIS WAF — LIVE AUTONOMOUS AGENT CLI & HTTP SERVICE       █');
  console.log('█'.repeat(65));

  // Always start HTTP API in background
  startHttpServer();

  // If stdin is interactive (TTY), also launch the CLI prompt
  if (process.stdin.isTTY) {
    const customerId = 'C101';
    console.log(`👤 Active Session Customer Scope: ${customerId}`);
    console.log(`🛡  All agent tool calls are proxied through AegisWAF\n`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const ask = () => {
      rl.question('💬 You: ', async (input) => {
        const trimmed = input.trim();
        if (!trimmed) {
          ask();
          return;
        }
        if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
          console.log('\n👋 Exiting agent session.\n');
          rl.close();
          process.exit(0);
        }

        try {
          await runAgent(trimmed, customerId);
        } catch (err: any) {
          console.error(`\n❌ Error: ${err.message}`);
        }

        console.log('\n' + '─'.repeat(65));
        ask();
      });
    };

    ask();
  }
}

startInteractiveCli().catch(console.error);
