-- AegisWAF Demo Seed
-- Agents
INSERT INTO agents (id, name, description, api_key, role, created_at, updated_at)
VALUES
  ('agent-customer-support-01', 'customer-support-agent', 'Customer support AI agent for CRM operations',
   encode(sha256('cs-agent-key-dev-001'::bytea), 'hex'), 'agent', now(), now()),
  ('agent-finance-01', 'finance-agent', 'Finance agent for payment and transfer operations',
   encode(sha256('finance-agent-key-dev-001'::bytea), 'hex'), 'agent', now(), now()),
  ('admin-01', 'admin', 'WAF admin account',
   encode(sha256('admin-key-dev-001'::bytea), 'hex'), 'admin', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Demo session bound to customer C101
INSERT INTO sessions (id, agent_id, customer_id, expires_at, created_at, updated_at)
VALUES
  ('sess-demo-001', 'agent-customer-support-01', 'C101', now() + interval '24 hours', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Confirm
SELECT name, role FROM agents;
SELECT id, customer_id, expires_at FROM sessions;
