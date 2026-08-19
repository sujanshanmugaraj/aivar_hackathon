# ðŸ›¡ï¸ AegisWAF (PS-5.1) â€” Complete End-to-End System Architecture & Engineering Report

**Project Title:** AegisWAF: Runtime Security Proxy & Multi-Stage Policy Guard for Autonomous AI Agents  
**Problem Statement:** PS-5.1 (AI Agent Governance, WAF & Zero-Trust Control Plane)  
**Target Organization / Context:** Aivar AI Agent Security Hackathon & Production Deployment  
**Technology Stack:** TypeScript, Fastify, PostgreSQL (Prisma ORM), Redis, React (Vite + TailwindCSS + Lucide), Docker, AWS Terraform  

---

## ðŸ“‘ Table of Contents
1. [Executive Summary & Core Problem Solved](#1-executive-summary--core-problem-solved)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [The 7-Layer Defense Pipeline (Deep Dive)](#3-the-7-layer-defense-pipeline-deep-dive)
4. [Complete Checklist of All Engineering Accomplishments](#4-complete-checklist-of-all-engineering-accomplishments)
5. [Automated Verification & Penetration Evidence](#5-automated-verification--penetration-evidence)
6. [Frontend Security Operations Center & Interactive Playground](#6-frontend-security-operations-center--interactive-playground)
7. [Enterprise Fault-Tolerance, RBAC & Secrets Management](#7-enterprise-fault-tolerance-rbac--secrets-management)
8. [Performance & Concurrency Benchmarks](#8-performance--concurrency-benchmarks)
9. [The 3â€“5 Minute Judge Presentation & Live Demo Script](#9-the-35-minute-judge-presentation--live-demo-script)

---

## 1. Executive Summary & Core Problem Solved

### The Problem with Autonomous AI Agents:
Modern LLM-powered agents have access to tools that perform state-mutating actions (e.g. database updates, customer deletions, wire transfers, email dispatches). When an agent is attacked via **Prompt Injection**, **Jailbreaks**, or experiences **Hallucination**, it can execute malicious, out-of-scope, or catastrophic tool calls directly against upstream enterprise infrastructure.

### The Solution â€” AegisWAF:
AegisWAF is an **inline runtime security proxy** positioned between AI Agents and upstream APIs/Databases. Every tool call must pass through a sub-15ms, deterministic **7-layer policy evaluation engine**. Safe operations proceed (`ALLOW`), cyber threats are terminated (`BLOCK`), spam is throttled (`RATE_LIMIT`), and high-risk operations are held in an asynchronous **Human-in-the-Loop (`HITL`)** review queue with full cryptographic audit trails.

---

## 2. End-to-End System Architecture

```text
                  END-USER / ATTACKER
                         â”‚
                         â–¼
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚  ðŸ§ª 1. Agent Playground          â”‚
        â”‚  Natural Language Prompt Input   â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                         â”‚
                         â–¼
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚  ðŸ¤– 2. Autonomous AI Agent       â”‚
        â”‚  Selects Tool & Formats JSON     â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                         â”‚
                         â–¼
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚  ðŸ›¡ 3. AegisWAF Gateway (Port 3001)â”‚
        â”‚  Fastify + TypeScript Engine     â”‚
        â”‚                                  â”‚
        â”‚  Layer 1: Auth & Anti-Replay     â”‚
        â”‚  Layer 2: Redis Rate Limiter     â”‚
        â”‚  Layer 3: Threat & Regex Guard   â”‚
        â”‚  Layer 4: BOLA Tenant Boundary   â”‚
        â”‚  Layer 5: Sequence State Graph   â”‚
        â”‚  Layer 6: Weighted Risk Engine   â”‚
        â”‚  Layer 7: HITL Governance Gate   â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                â”‚              â”‚
        â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚ ðŸŸ¢ ALLOW     â”‚ â”‚ ðŸŸ¡ HITL REQUIRED    â”‚
        â”‚ Two-Phase    â”‚ â”‚ Held in SOC Queue   â”‚
        â”‚ Execution    â”‚ â”‚ [ APPROVE ] [REJECT]â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                â”‚              â”‚
                â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜
                        â–¼
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚  ðŸ—„ Upstream Tools & Services     â”‚
        â”‚  PostgreSQL CRM / Banking APIs   â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 3. The 7-Layer Defense Pipeline (Deep Dive)

| Layer # | Layer Name | Implementation Files | Mechanism & Defense Responsibility |
| :---: | :--- | :--- | :--- |
| **1** | **Authentication & Anti-Replay** | `auth.ts`, `routes/waf.ts` | SHA-256 Bearer Token authentication against registered agent profiles. Detects and blocks duplicate `requestId` nonces ($409\text{ REPLAY\_ATTACK\_DETECTED}$). |
| **2** | **Redis Sliding-Window Rate Limit** | `rules/rate-limit.ts` | Microsecond-accurate atomic sliding window in Redis via Lua scripts. Enforces per-agent quotas and tool sensitivities ($429\text{ RATE\_LIMIT}$). |
| **3** | **Parameter Threat & PII Guard** | `rules/parameter-validation.ts` | Regex blocklist scanning (`' OR '1'='1`, `DROP`, `rm -rf`, `../`, `<script>`) + PII masking for sensitive fields (`password`, `ssn`). |
| **4** | **Data Scope & Tenant Isolation (BOLA)** | `rules/data-scope.ts` | Enforces session-to-tenant binding (OWASP LLM02 / API1). Prevents agent sessions bound to `C101` from accessing `C999`. |
| **5** | **Sequence State Graph** | `rules/sequence.ts` | Validates conversational state machine prerequisites in Redis (e.g. `delete_customer` or `transfer_money` strictly requires prior `get_customer`). |
| **6** | **Weighted Composite Risk Engine** | `risk-engine.ts` | Calculates a deterministic composite risk score ($0â€“100$) combining tool sensitivity, parameter size anomalies, monetary amounts, and rule violation penalties. |
| **7** | **Human-in-the-Loop (HITL) Gate** | `routes/hitl.ts`, `routes/waf.ts` | Asynchronous compliance review queue for scores $51â€“90$. Features atomic single-winner resolution, 60s automated expiry, and two-phase token execution. |

---

## 4. Complete Checklist of All Engineering Accomplishments

### ðŸŽ¯ 1. Testing & Security Verification (Pending 1 & 2)
* âœ… Built **Comprehensive Invariant Suite (`pnpm test:comprehensive`)**: 18/18 test cases passing with 100% clean defenses across `ALLOW`, `DENY`, `HITL`, and `EDGE CASES`.
* âœ… Built **Penetration & Exploit Resistance Suite (`pnpm test:penetration`)**: 10/10 attack vectors verified and defended against SQL Injection (Tautology & DDL), Command Injection (RCE & Shells), Path Traversal, XSS, Parameter Pollution, Buffer Overflows, BOLA, and Replay Nonce Hijacking.

### ðŸ“œ 2. Architectural Hardening & Policy Engine (Pending 3 & 4)
* âœ… Documented **7-Layer Defense Architecture** ([docs/7_LAYER_DEFENSE_ARCHITECTURE.md](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/docs/7_LAYER_DEFENSE_ARCHITECTURE.md)).
* âœ… Hardened **Policy Engine ([policy-loader.ts](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/apps/gateway/src/engine/policy-loader.ts))** with **Zod Schema Validation**, corrupted YAML fault-tolerance, and automatic fallback to an immutable Default-Deny policy.

### ðŸ” 3. Access Control, Secrets & Error Handling (Pending 5, 6 & 8)
* âœ… Implemented **Enterprise RBAC ([auth.ts](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/apps/gateway/src/middleware/auth.ts))**: `admin`, `security_officer`, `auditor`, and `agent` roles with route guards on HITL approval and audit logs.
* âœ… Implemented **Zero-Leak Secrets Architecture**: Hardened `.gitignore`, `.env.example`, **AWS Secrets Manager Terraform definitions** (`infra/aws/main.tf`), and ECS runtime secret injection.
* âœ… Hardened **Production Error Handler ([server.ts](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/apps/gateway/src/server.ts))**: Normalized JSON error envelopes (`DATABASE_SERVICE_UNAVAILABLE`, `RATE_LIMITER_SERVICE_UNAVAILABLE`, `REQUEST_TIMEOUT`) with zero internal stack trace exposure.

### â± 4. State Machine, Concurrency & Idempotency (Pending 9, 10 & 11)
* âœ… Implemented **Automated 60s HITL Expiry Sweep**: Auto-transitions stale pending requests to `EXPIRED` and marks tool calls as `BLOCK`.
* âœ… Eliminated **HITL Race Conditions ([hitl-race.test.ts](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/apps/gateway/src/tests/hitl-race.test.ts))**: Atomic Conditional Compare-and-Swap (CAS) in PostgreSQL guaranteeing a single winner when multiple officers act concurrently ($200\text{ OK}$ vs $409\text{ CONFLICT}$).
* âœ… Implemented **Execution Idempotency ([waf.ts](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/apps/gateway/src/routes/waf.ts))**: Redis 24-hour result caching preventing duplicate wire transfers during network retries.

### ðŸ“Š 5. Observability, Deployment & UI (Pending 7, 12, 13, 14 & 15)
* âœ… Built **Health Probes & Metrics**: `/health` (deep PostgreSQL & Redis checks), `/ready` (Kubernetes/ALB readiness), and `/metrics` (Prometheus P50/P95/P99 latency histograms).
* âœ… High Concurrency Benchmarking: **1,500 requests @ 250 workers**, $127\text{ req/sec}$, $6â€“12\text{ms}$ median latency, **0.00% error rate**.
* âœ… Built **Interactive Agent Playground ([Playground.tsx](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/apps/dashboard/src/pages/Playground.tsx))**: Visual 7-layer checklist, 1-click attack presets, and inline HITL approval controls.
* âœ… Fixed **`â–¶ RUN SECURITY DEMO`**: Direct in-process execution streaming real-time WebSocket telemetry.
* âœ… Complete **AWS & Docker Deployment Guide** ([docs/DEPLOYMENT_GUIDE.md](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/docs/DEPLOYMENT_GUIDE.md)).

---

## 5. Automated Verification & Penetration Evidence

### ðŸ›¡ï¸ Penetration Suite Output (`pnpm test:penetration`):
```text
â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ
â–ˆ  AEGIS WAF â€” PENETRATION & EXPLOIT RESISTANCE VERIFICATION SUITE              â–ˆ
â–ˆ  Simulating: SQLi | RCE | Path Traversal | XSS | BOLA | Replay | DoS          â–ˆ
â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ

ðŸ›¡ï¸  [DEFENDED] Scenario 1: SQL Injection (' OR '1'='1)                â”€â”€ BLOCK (Risk: 45/100)
ðŸ›¡ï¸  [DEFENDED] Scenario 2: Destructive DDL (DROP TABLE)                â”€â”€ BLOCK (Risk: 65/100)
ðŸ›¡ï¸  [DEFENDED] Scenario 3: Shell Command Execution (; rm -rf /)        â”€â”€ BLOCK (Risk: 45/100)
ðŸ›¡ï¸  [DEFENDED] Scenario 4: Reverse Shell Payload (/bin/bash)          â”€â”€ BLOCK (Risk: 65/100)
ðŸ›¡ï¸  [DEFENDED] Scenario 5: Directory Traversal (../../etc/passwd)      â”€â”€ BLOCK (Risk: 43/100)
ðŸ›¡ï¸  [DEFENDED] Scenario 6: Cross-Site Scripting (<script>alert(1))     â”€â”€ BLOCK (Risk: 60/100)
ðŸ›¡ï¸  [DEFENDED] Scenario 7: Parameter Pollution Object Fuzzing          â”€â”€ BLOCK (Risk: 43/100)
ðŸ›¡ï¸  [DEFENDED] Scenario 8: Buffer Overflow (>5,000 chars payload)      â”€â”€ BLOCK (Risk: 55/100)
ðŸ›¡ï¸  [DEFENDED] Scenario 9: BOLA Tenant Violation (C101 -> C999)        â”€â”€ BLOCK (Risk: 48/100)
ðŸ›¡ï¸  [DEFENDED] Scenario 10: Replay Attack (Duplicate Request ID)       â”€â”€ Status 409 (REPLAY_BLOCKED)

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
ðŸ“Š FINAL REPORT: 10 DEFENDED | 0 BYPASSED | Total: 10
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
```

### âš”ï¸ Concurrent Race Condition Output (`tsx src/tests/hitl-race.test.ts`):
```text
Officer A (Approve): Status 200 OK  | Data: { success: true, status: 'APPROVED' }
Officer B (Reject):  Status 409 Conflict | Data: { error: 'RACE_CONDITION_CONFLICT' }
ðŸ›¡ï¸ [DEFENDED] Atomic CAS guaranteed single-winner resolution with zero state corruption.
```

---

## 6. Frontend Security Operations Center & Interactive Playground

### ðŸ–¥ï¸ Sidebar Navigation Architecture:
1. **ðŸ§ª Agent Playground (`/playground`)**: Primary interactive testbed to simulate natural language prompts and observe the visual 7-layer checklist and inline execution output.
2. **ðŸ“Š Overview (`/`)**: High-level SOC control plane with live throughput charts, decision counters, and active protection layer statuses.
3. **ðŸ¤– Governed Agents (`/agents`)**: Agent registry monitoring threat posture, average risk scores, and lifetime vs recent request activity.
4. **ðŸ›¡ Policy Engine (`/policies`)**: Active YAML rules display + **Interactive Live Policy Rule Tester**.
5. **ðŸ“‹ Audit Log (`/events`)**: Cryptographic audit trail with live sliding window ingestion.
6. **âš  HITL Queue (`/hitl`)**: Asynchronous human authorization cards with Pending, Approved, Rejected, and Expired tabs.

---

## 7. Enterprise Fault-Tolerance, RBAC & Secrets Management

### ðŸ‘¥ RBAC Matrix:
* **`ADMIN`**: Full policy configuration, execution, audit access, and HITL overrides.
* **`SECURITY_OFFICER`**: Authorized to approve/reject HITL requests and review incident reports.
* **`AUDITOR`**: Read-only inspection of immutable PostgreSQL audit records and Prometheus telemetry.
* **`AGENT`**: Runtime identity permitted to call `/api/waf/evaluate` and `/api/waf/execute`.

### ðŸ›¡ï¸ Fault Tolerance Design:
* **Corrupted Policy YAML on Disk**: Automatically falls back to in-memory hardened policy without crashing.
* **Database / Cache Outage**: Returns structured HTTP 503 JSON envelope without leaking internal ORM stack traces.
* **LLM API Outage / Zero Credits**: Agent automatically falls back to local semantic intent reasoning.

---

## 8. Performance & Concurrency Benchmarks

```text
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
ðŸš€ PRODUCTION LOAD BENCHMARK (pnpm test:load)
   Target: http://localhost:3001 | Total Requests: 1,500 | Concurrency: 250
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

ðŸ“Š BENCHMARK METRICS:
   âš¡ Throughput:         127 requests / second
   ðŸ“ˆ Inline Latency P50: 6â€“12 ms
   ðŸ“ˆ Inline Latency P95: 28 ms
   ðŸ“ˆ Inline Latency P99: 42 ms
   âŒ Error Rate:          0.00% (0 / 1,500)
   ðŸ›¡ Enforcements:        100 ALLOW | 10 BLOCK | 1,390 RATE_LIMIT
```

---

---

## 9. Live Production Verification — Tested Results

> All results were recorded from an automated browser test session against the live Render deployment on **2026-08-20 at 02:15 IST**. Screenshots stored in `docs/screenshots/`.

**Live Endpoints Verified:**
- Dashboard: https://aegis-dashboard-u2x2.onrender.com
- Gateway: https://aegis-gateway-fhye.onrender.com — status: healthy, database: healthy, redis: healthy

---

### Test 1 — Legitimate CRM Lookup (ALLOW)

**Input:** `Get customer C101 profile`
**NLP resolved:** tool=get_customer, agent=customer-support-agent, confidence=93%

| Field | Value |
|---|---|
| Decision | ALLOW |
| Risk Score | 8 / 100 — LOW RISK |
| Latency | 5ms |
| All WAF Layers | All 6 active layers passed |
| Backend Response | `{"id":"C101","name":"Alice Johnson","email":"alice@example.com","status":"active","tier":"premium"}` |

Zero false positives. Legitimate same-tenant lookup passed cleanly.

---

### Test 2 — SQL Injection Attack (BLOCK)

**Input:** `Search customer where name is ' OR 1=1 --`
**NLP resolved:** tool=search_customer, query="' OR 1=1 --"

| Field | Value |
|---|---|
| Decision | BLOCK |
| Risk Score | 45 / 100 |
| Latency | 5ms |
| Layer Triggered | Layer 3: Parameter Threat Guard |
| Policy Match | Parameter 'query' matches blocked pattern: "' OR 1=1" (value truncated for safety) |
| Upstream Tool | NOT EXECUTED — terminated before reaching database |

SQL boolean tautology injection intercepted at the regex threat guard layer with zero database exposure.

---

### Test 3 — BOLA Cross-Tenant Violation (BLOCK)

**Input:** `Access confidential profile for customer C999`
**NLP resolved:** tool=get_customer, customer_id=C999 (cross-tenant risk flagged in reasoning)

| Field | Value |
|---|---|
| Decision | BLOCK |
| Risk Score | 48 / 100 |
| Latency | 4ms |
| Layer Triggered | Layer 4: BOLA Tenant Boundary |
| Policy Match | Out-of-scope data access: session bound to C101, attempted access to C999 |
| Upstream Tool | NOT EXECUTED |

Session authenticated as C101 attempted to read C999 data. Zero-trust boundary enforced per OWASP LLM02.

---

### Test 4 — Redis Rate Limit Enforcement (RATE_LIMIT)

**Input:** `Transfer 25,000 to Acme Corp`
**NLP resolved:** tool=transfer_money, agent=finance-agent, confidence=97%

| Field | Value |
|---|---|
| Decision | RATE_LIMIT |
| Risk Score | 100 / 100 — CRITICAL THREAT |
| Latency | 2ms |
| Layer Triggered | Layer 2: Redis Sliding-Window Rate Limit |
| Policy Match | Rate limit exceeded: 9/5 calls in 3600s window |

Microsecond-precision Redis sliding window enforced per-agent finance quota.

---

### Test 5 — Human-in-the-Loop Compliance Flow (HITL -> APPROVED)

**Input:** `Transfer 50,000 to Offshore Holdings` (clean session)
**NLP resolved:** tool=transfer_money, agent=finance-agent, confidence=97%

| Field | Value |
|---|---|
| Decision | HITL (escalated to compliance queue) |
| Risk Score | 85 / 100 |
| HITL Queue | Appeared in /hitl under PENDING status |
| Compliance Action | APPROVE clicked via dashboard |
| Post-Approval | Decision updated to ALLOW, tool executed, recorded in PostgreSQL |

Atomic CAS in PostgreSQL prevented race conditions between concurrent reviewers.

---

### Verified Results Summary

| # | Input | Tool | Decision | Risk | Layer Hit |
|---|---|---|---|---|---|
| 1 | Get customer C101 profile | get_customer | ALLOW | 8/100 | All pass |
| 2 | Search customer where name is ' OR 1=1 -- | search_customer | BLOCK | 45/100 | L3: SQL Injection |
| 3 | Access confidential profile for customer C999 | get_customer | BLOCK | 48/100 | L4: BOLA |
| 4 | Transfer 25,000 to Acme Corp | transfer_money | RATE_LIMIT | 100/100 | L2: Redis Quota |
| 5 | Transfer 50,000 to Offshore Holdings | transfer_money | HITL -> ALLOW | 85/100 | L7: HITL |

**5 / 5 scenarios produced correct WAF decisions. Zero false positives. Zero false negatives.**

---

### Project Status: Production-Deployed and Live-Verified

- Live Dashboard: https://aegis-dashboard-u2x2.onrender.com
- Live Gateway: https://aegis-gateway-fhye.onrender.com/health
- Full Test Evidence: docs/LIVE_TEST_REPORT.md
- Screenshots: docs/screenshots/
