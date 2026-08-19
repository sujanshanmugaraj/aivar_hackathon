import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function seed() {
  console.log('🌱 Seeding AegisWAF database...');

  // Seed agents
  const agents = [
    {
      id: 'agent-customer-support-01',
      name: 'customer-support-agent',
      description: 'Customer support AI agent for CRM operations',
      apiKey: hashApiKey('cs-agent-key-dev-001'),
      role: 'agent',
    },
    {
      id: 'agent-finance-01',
      name: 'finance-agent',
      description: 'Finance agent for payment and transfer operations',
      apiKey: hashApiKey('finance-agent-key-dev-001'),
      role: 'agent',
    },
    {
      id: 'security-officer-01',
      name: 'compliance-officer',
      description: 'Human-in-the-Loop Security & Compliance Reviewer',
      apiKey: hashApiKey('sec-officer-key-dev-001'),
      role: 'security_officer',
    },
    {
      id: 'auditor-01',
      name: 'compliance-auditor',
      description: 'Read-only compliance audit analyst',
      apiKey: hashApiKey('auditor-key-dev-001'),
      role: 'auditor',
    },
    {
      id: 'admin-01',
      name: 'admin',
      description: 'WAF enterprise admin account',
      apiKey: hashApiKey('admin-key-dev-001'),
      role: 'admin',
    },
  ];

  for (const agent of agents) {
    await prisma.agent.upsert({
      where: { id: agent.id },
      update: {},
      create: agent,
    });
    console.log(`✅ Agent seeded: ${agent.name}`);
  }

  // Seed a test session
  await prisma.session.upsert({
    where: { id: 'sess-demo-001' },
    update: {},
    create: {
      id: 'sess-demo-001',
      agentId: 'agent-customer-support-01',
      customerId: 'C101',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  console.log('✅ Demo session seeded: sess-demo-001 (customerId: C101)');

  console.log('\n🔑 API Keys (for testing):');
  console.log('  customer-support-agent: cs-agent-key-dev-001');
  console.log('  finance-agent:          finance-agent-key-dev-001');
  console.log('  admin:                  admin-key-dev-001');

  await prisma.$disconnect();
}

seed().catch(console.error);
