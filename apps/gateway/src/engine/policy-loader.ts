import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';
import { Policy } from '../types';
import { logger } from '../lib/logger';
import { config } from '../lib/config';

// ─────────────────────────────────────────────
// Strict Zod Policy Schema Validation
// ─────────────────────────────────────────────
const PolicySchema = z.object({
  version: z.number().int().positive().default(1),
  shadow_mode: z.boolean().default(false),
  rate_limits: z.record(
    z.object({
      requests: z.number().int().positive(),
      window_seconds: z.number().int().positive(),
    })
  ).default({}),
  parameter_rules: z.record(
    z.object({
      max_length: z.number().int().positive().optional(),
      max_amount: z.number().positive().optional(),
      blocklist_patterns: z.array(z.string()).optional(),
    })
  ).default({}),
  data_scope: z.object({
    strategy: z.enum(['session_binding', 'open']).default('session_binding'),
    allowed_fields: z.array(z.string()).default(['customer_id', 'customerId']),
  }).default({ strategy: 'session_binding', allowed_fields: ['customer_id', 'customerId'] }),
  sequence_rules: z.record(
    z.object({
      requires: z.array(z.string()),
    })
  ).default({}),
  risk_weights: z.record(z.number().min(0).max(100)).default({}),
  decision_thresholds: z.object({
    allow: z.tuple([z.number(), z.number()]),
    hitl: z.tuple([z.number(), z.number()]),
    block: z.tuple([z.number(), z.number()]),
  }),
});

// Built-in immutable fallback policy (Default-Deny fallback)
const HARDENED_DEFAULT_POLICY: Policy = {
  id: 'hardened-fallback',
  agent: '*',
  version: 1,
  shadow_mode: false,
  rate_limits: {
    get_customer: { requests: 20, window_seconds: 60 },
    search_customer: { requests: 30, window_seconds: 60 },
    update_customer: { requests: 10, window_seconds: 60 },
    delete_customer: { requests: 2, window_seconds: 60 },
    send_email: { requests: 50, window_seconds: 60 },
    transfer_money: { requests: 5, window_seconds: 3600 },
  },
  parameter_rules: {
    '*': {
      max_length: 1000,
      blocklist_patterns: [
        'DROP', 'DELETE *', 'TRUNCATE', "'; --", '../', '..\\', '<script', '</script',
        'javascript:', 'UNION SELECT', "' OR '1'='1", "' OR 1=1", 'rm -rf', '/etc/passwd',
        'cmd.exe', '/bin/sh', '/bin/bash', 'powershell', 'exec(', 'eval(', 'system('
      ],
    },
    transfer_money: { max_amount: 50000 },
  },
  data_scope: {
    strategy: 'session_binding',
    allowed_fields: ['customer_id', 'customerId'],
  },
  sequence_rules: {
    update_customer: { requires: ['get_customer'] },
    delete_customer: { requires: ['get_customer'] },
    transfer_money: { requires: ['get_customer'] },
  },
  risk_weights: {
    search_customer: 10,
    get_customer: 8,
    update_customer: 30,
    send_email: 25,
    delete_customer: 70,
    transfer_money: 75,
  },
  decision_thresholds: {
    allow: [0, 50],
    hitl: [51, 90],
    block: [91, 100],
  },
};

const policyCache = new Map<string, { policy: Policy; loadedAt: number }>();

/**
 * Load and validate policy for a given agent ID.
 * Features:
 *  - Zod schema validation
 *  - Corrupted / invalid YAML fault-tolerance
 *  - Safe fallback to in-memory immutable policy
 *  - Memory caching with auto-reload TTL
 */
export async function loadPolicy(agentId: string): Promise<Policy> {
  const cached = policyCache.get(agentId);
  const now = Date.now();

  if (cached && now - cached.loadedAt < config.POLICY_RELOAD_INTERVAL_MS) {
    return cached.policy;
  }

  const policyPath = path.resolve(config.DEFAULT_POLICY_PATH, `${agentId}.yaml`);
  const fallbackPath = path.resolve(config.DEFAULT_POLICY_PATH, 'default.yaml');

  const filePath = fs.existsSync(policyPath)
    ? policyPath
    : fs.existsSync(fallbackPath)
    ? fallbackPath
    : null;

  if (!filePath) {
    logger.warn('Policy file missing on disk — using hardened default-deny policy', { agentId });
    return HARDENED_DEFAULT_POLICY;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsedYaml = yaml.load(raw) as any;

    if (!parsedYaml || !parsedYaml.policy) {
      throw new Error("Missing root 'policy' key in YAML configuration");
    }

    const validated = PolicySchema.safeParse(parsedYaml.policy);
    if (!validated.success) {
      logger.error('Policy schema validation failed — falling back to safe defaults', {
        agentId,
        errors: validated.error.format(),
        file: filePath,
      });
      return HARDENED_DEFAULT_POLICY;
    }

    const policy = validated.data as Policy;
    policyCache.set(agentId, { policy, loadedAt: now });
    logger.info('Policy successfully loaded and validated', { agentId, version: policy.version, file: filePath });

    return policy;
  } catch (err) {
    logger.error('Corrupted YAML policy detected — engaging safe default-deny fallback', {
      agentId,
      error: (err as Error).message,
      file: filePath,
    });
    return HARDENED_DEFAULT_POLICY;
  }
}

/**
 * Invalidate cached policy for a specific agent or flush all.
 */
export function invalidatePolicyCache(agentId?: string): void {
  if (agentId) {
    policyCache.delete(agentId);
  } else {
    policyCache.clear();
  }
}
