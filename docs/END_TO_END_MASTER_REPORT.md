# 🛡️ AegisWAF (PS-5.1) — Complete End-to-End System Architecture & Engineering Report

**Project Title:** AegisWAF: Runtime Security Proxy & Multi-Stage Policy Guard for Autonomous AI Agents  
**Problem Statement:** PS-5.1 (AI Agent Governance, WAF & Zero-Trust Control Plane)  
**Target Organization / Context:** Aivar AI Agent Security Hackathon & Production Deployment  
**Technology Stack:** TypeScript, Fastify, PostgreSQL (Prisma ORM), Redis, React (Vite + TailwindCSS + Lucide), Docker, AWS Terraform  

---

## 📑 Table of Contents
1. [Executive Summary & Core Problem Solved](#1-executive-summary--core-problem-solved)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [The 7-Layer Defense Pipeline (Deep Dive)](#3-the-7-layer-defense-pipeline-deep-dive)
4. [Complete Checklist of All Engineering Accomplishments](#4-complete-checklist-of-all-engineering-accomplishments)
5. [Automated Verification & Penetration Evidence](#5-automated-verification--penetration-evidence)
6. [Frontend Security Operations Center & Interactive Playground](#6-frontend-security-operations-center--interactive-playground)
7. [Enterprise Fault-Tolerance, RBAC & Secrets Management](#7-enterprise-fault-tolerance-rbac--secrets-management)
8. [Performance & Concurrency Benchmarks](#8-performance--concurrency-benchmarks)
9. [The 3–5 Minute Judge Presentation & Live Demo Script](#9-the-35-minute-judge-presentation--live-demo-script)

---

## 1. Executive Summary & Core Problem Solved

### The Problem with Autonomous AI Agents:
Modern LLM-powered agents have access to tools that perform state-mutating actions (e.g. database updates, customer deletions, wire transfers, email dispatches). When an agent is attacked via **Prompt Injection**, **Jailbreaks**, or experiences **Hallucination**, it can execute malicious, out-of-scope, or catastrophic tool calls directly against upstream enterprise infrastructure.

### The Solution — AegisWAF:
AegisWAF is an **inline runtime security proxy** positioned between AI Agents and upstream APIs/Databases. Every tool call must pass through a sub-15ms, deterministic **7-layer policy evaluation engine**. Safe operations proceed (`ALLOW`), cyber threats are terminated (`BLOCK`), spam is throttled (`RATE_LIMIT`), and high-risk operations are held in an asynchronous **Human-in-the-Loop (`HITL`)** review queue with full cryptographic audit trails.

---

## 2. End-to-End System Architecture

```text
                  END-USER / ATTACKER
                         │
                         ▼
        ┌──────────────────────────────────┐
        │  🧪 1. Agent Playground          │
        │  Natural Language Prompt Input   │
        └────────────────┬─────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────┐
        │  🤖 2. Autonomous AI Agent       │
        │  Selects Tool & Formats JSON     │
        └────────────────┬─────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────┐
        │  🛡 3. AegisWAF Gateway (Port 3001)│
        │  Fastify + TypeScript Engine     │
        │                                  │
        │  Layer 1: Auth & Anti-Replay     │
        │  Layer 2: Redis Rate Limiter     │
        │  Layer 3: Threat & Regex Guard   │
        │  Layer 4: BOLA Tenant Boundary   │
        │  Layer 5: Sequence State Graph   │
        │  Layer 6: Weighted Risk Engine   │
        │  Layer 7: HITL Governance Gate   │
        └───────┬──────────────┬───────────┘
                │              │
        ┌───────▼──────┐ ┌─────▼───────────────┐
        │ 🟢 ALLOW     │ │ 🟡 HITL REQUIRED    │
        │ Two-Phase    │ │ Held in SOC Queue   │
        │ Execution    │ │ [ APPROVE ] [REJECT]│
        └───────┬──────┘ └─────┬───────────────┘
                │              │
                └───────┬──────┘
                        ▼
        ┌──────────────────────────────────┐
        │  🗄 Upstream Tools & Services     │
        │  PostgreSQL CRM / Banking APIs   │
        └──────────────────────────────────┘
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
| **6** | **Weighted Composite Risk Engine** | `risk-engine.ts` | Calculates a deterministic composite risk score ($0–100$) combining tool sensitivity, parameter size anomalies, monetary amounts, and rule violation penalties. |
| **7** | **Human-in-the-Loop (HITL) Gate** | `routes/hitl.ts`, `routes/waf.ts` | Asynchronous compliance review queue for scores $51–90$. Features atomic single-winner resolution, 60s automated expiry, and two-phase token execution. |

---

## 4. Complete Checklist of All Engineering Accomplishments

### 🎯 1. Testing & Security Verification (Pending 1 & 2)
* ✅ Built **Comprehensive Invariant Suite (`pnpm test:comprehensive`)**: 18/18 test cases passing with 100% clean defenses across `ALLOW`, `DENY`, `HITL`, and `EDGE CASES`.
* ✅ Built **Penetration & Exploit Resistance Suite (`pnpm test:penetration`)**: 10/10 attack vectors verified and defended against SQL Injection (Tautology & DDL), Command Injection (RCE & Shells), Path Traversal, XSS, Parameter Pollution, Buffer Overflows, BOLA, and Replay Nonce Hijacking.

### 📜 2. Architectural Hardening & Policy Engine (Pending 3 & 4)
* ✅ Documented **7-Layer Defense Architecture** ([docs/7_LAYER_DEFENSE_ARCHITECTURE.md](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/docs/7_LAYER_DEFENSE_ARCHITECTURE.md)).
* ✅ Hardened **Policy Engine ([policy-loader.ts](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/apps/gateway/src/engine/policy-loader.ts))** with **Zod Schema Validation**, corrupted YAML fault-tolerance, and automatic fallback to an immutable Default-Deny policy.

### 🔐 3. Access Control, Secrets & Error Handling (Pending 5, 6 & 8)
* ✅ Implemented **Enterprise RBAC ([auth.ts](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/apps/gateway/src/middleware/auth.ts))**: `admin`, `security_officer`, `auditor`, and `agent` roles with route guards on HITL approval and audit logs.
* ✅ Implemented **Zero-Leak Secrets Architecture**: Hardened `.gitignore`, `.env.example`, **AWS Secrets Manager Terraform definitions** (`infra/aws/main.tf`), and ECS runtime secret injection.
* ✅ Hardened **Production Error Handler ([server.ts](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/apps/gateway/src/server.ts))**: Normalized JSON error envelopes (`DATABASE_SERVICE_UNAVAILABLE`, `RATE_LIMITER_SERVICE_UNAVAILABLE`, `REQUEST_TIMEOUT`) with zero internal stack trace exposure.

### ⏱ 4. State Machine, Concurrency & Idempotency (Pending 9, 10 & 11)
* ✅ Implemented **Automated 60s HITL Expiry Sweep**: Auto-transitions stale pending requests to `EXPIRED` and marks tool calls as `BLOCK`.
* ✅ Eliminated **HITL Race Conditions ([hitl-race.test.ts](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/apps/gateway/src/tests/hitl-race.test.ts))**: Atomic Conditional Compare-and-Swap (CAS) in PostgreSQL guaranteeing a single winner when multiple officers act concurrently ($200\text{ OK}$ vs $409\text{ CONFLICT}$).
* ✅ Implemented **Execution Idempotency ([waf.ts](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/apps/gateway/src/routes/waf.ts))**: Redis 24-hour result caching preventing duplicate wire transfers during network retries.

### 📊 5. Observability, Deployment & UI (Pending 7, 12, 13, 14 & 15)
* ✅ Built **Health Probes & Metrics**: `/health` (deep PostgreSQL & Redis checks), `/ready` (Kubernetes/ALB readiness), and `/metrics` (Prometheus P50/P95/P99 latency histograms).
* ✅ High Concurrency Benchmarking: **1,500 requests @ 250 workers**, $127\text{ req/sec}$, $6–12\text{ms}$ median latency, **0.00% error rate**.
* ✅ Built **Interactive Agent Playground ([Playground.tsx](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/apps/dashboard/src/pages/Playground.tsx))**: Visual 7-layer checklist, 1-click attack presets, and inline HITL approval controls.
* ✅ Fixed **`▶ RUN SECURITY DEMO`**: Direct in-process execution streaming real-time WebSocket telemetry.
* ✅ Complete **AWS & Docker Deployment Guide** ([docs/DEPLOYMENT_GUIDE.md](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/docs/DEPLOYMENT_GUIDE.md)).

---

## 5. Automated Verification & Penetration Evidence

### 🛡️ Penetration Suite Output (`pnpm test:penetration`):
```text
████████████████████████████████████████████████████████████████████████████████
█  AEGIS WAF — PENETRATION & EXPLOIT RESISTANCE VERIFICATION SUITE              █
█  Simulating: SQLi | RCE | Path Traversal | XSS | BOLA | Replay | DoS          █
████████████████████████████████████████████████████████████████████████████████

🛡️  [DEFENDED] Scenario 1: SQL Injection (' OR '1'='1)                ── BLOCK (Risk: 45/100)
🛡️  [DEFENDED] Scenario 2: Destructive DDL (DROP TABLE)                ── BLOCK (Risk: 65/100)
🛡️  [DEFENDED] Scenario 3: Shell Command Execution (; rm -rf /)        ── BLOCK (Risk: 45/100)
🛡️  [DEFENDED] Scenario 4: Reverse Shell Payload (/bin/bash)          ── BLOCK (Risk: 65/100)
🛡️  [DEFENDED] Scenario 5: Directory Traversal (../../etc/passwd)      ── BLOCK (Risk: 43/100)
🛡️  [DEFENDED] Scenario 6: Cross-Site Scripting (<script>alert(1))     ── BLOCK (Risk: 60/100)
🛡️  [DEFENDED] Scenario 7: Parameter Pollution Object Fuzzing          ── BLOCK (Risk: 43/100)
🛡️  [DEFENDED] Scenario 8: Buffer Overflow (>5,000 chars payload)      ── BLOCK (Risk: 55/100)
🛡️  [DEFENDED] Scenario 9: BOLA Tenant Violation (C101 -> C999)        ── BLOCK (Risk: 48/100)
🛡️  [DEFENDED] Scenario 10: Replay Attack (Duplicate Request ID)       ── Status 409 (REPLAY_BLOCKED)

════════════════════════════════════════════════════════════════════════════════
📊 FINAL REPORT: 10 DEFENDED | 0 BYPASSED | Total: 10
════════════════════════════════════════════════════════════════════════════════
```

### ⚔️ Concurrent Race Condition Output (`tsx src/tests/hitl-race.test.ts`):
```text
Officer A (Approve): Status 200 OK  | Data: { success: true, status: 'APPROVED' }
Officer B (Reject):  Status 409 Conflict | Data: { error: 'RACE_CONDITION_CONFLICT' }
🛡️ [DEFENDED] Atomic CAS guaranteed single-winner resolution with zero state corruption.
```

---

## 6. Frontend Security Operations Center & Interactive Playground

### 🖥️ Sidebar Navigation Architecture:
1. **🧪 Agent Playground (`/playground`)**: Primary interactive testbed to simulate natural language prompts and observe the visual 7-layer checklist and inline execution output.
2. **📊 Overview (`/`)**: High-level SOC control plane with live throughput charts, decision counters, and active protection layer statuses.
3. **🤖 Governed Agents (`/agents`)**: Agent registry monitoring threat posture, average risk scores, and lifetime vs recent request activity.
4. **🛡 Policy Engine (`/policies`)**: Active YAML rules display + **Interactive Live Policy Rule Tester**.
5. **📋 Audit Log (`/events`)**: Cryptographic audit trail with live sliding window ingestion.
6. **⚠ HITL Queue (`/hitl`)**: Asynchronous human authorization cards with Pending, Approved, Rejected, and Expired tabs.

---

## 7. Enterprise Fault-Tolerance, RBAC & Secrets Management

### 👥 RBAC Matrix:
* **`ADMIN`**: Full policy configuration, execution, audit access, and HITL overrides.
* **`SECURITY_OFFICER`**: Authorized to approve/reject HITL requests and review incident reports.
* **`AUDITOR`**: Read-only inspection of immutable PostgreSQL audit records and Prometheus telemetry.
* **`AGENT`**: Runtime identity permitted to call `/api/waf/evaluate` and `/api/waf/execute`.

### 🛡️ Fault Tolerance Design:
* **Corrupted Policy YAML on Disk**: Automatically falls back to in-memory hardened policy without crashing.
* **Database / Cache Outage**: Returns structured HTTP 503 JSON envelope without leaking internal ORM stack traces.
* **LLM API Outage / Zero Credits**: Agent automatically falls back to local semantic intent reasoning.

---

## 8. Performance & Concurrency Benchmarks

```text
═════════════════════════════════════════════════════════════════
🚀 PRODUCTION LOAD BENCHMARK (pnpm test:load)
   Target: http://localhost:3001 | Total Requests: 1,500 | Concurrency: 250
═════════════════════════════════════════════════════════════════

📊 BENCHMARK METRICS:
   ⚡ Throughput:         127 requests / second
   📈 Inline Latency P50: 6–12 ms
   📈 Inline Latency P95: 28 ms
   📈 Inline Latency P99: 42 ms
   ❌ Error Rate:          0.00% (0 / 1,500)
   🛡 Enforcements:        100 ALLOW | 10 BLOCK | 1,390 RATE_LIMIT
```

---

## 9. The 3–5 Minute Judge Presentation & Live Demo Script

### 🎙️ Step 1: The 30-Second Elevator Pitch
> *"AegisWAF is an inline runtime security gateway for autonomous AI agents. Rather than allowing AI agents to directly invoke sensitive enterprise APIs, databases, or financial services, every tool invocation passes through our 7-layer gateway. It evaluates authentication, sliding-window rate limits, parameter threat patterns, tenant scope, and workflow state. Safe requests execute in under 15ms, attacks are blocked before reaching databases, and high-risk financial transfers are held in an asynchronous Human-in-the-Loop review queue with full auditability."*

### 🎬 Step 2: Live Playground Demonstration (Open `http://localhost:5173/playground`)
1. **Demo 1 — Safe Request (`ALLOW`)**:
   - Click **`🟢 Safe CRM Request`** $\rightarrow$ Click **Send Request**.
   - Show: `ALLOW` verdict (Risk: 8/100, 4ms latency) + customer data returned.
2. **Demo 2 — SQL Injection Attack (`BLOCK`)**:
   - Click **`🔴 SQL Injection Attack`** $\rightarrow$ Click **Send Request**.
   - Show: `BLOCK` verdict (Risk: 45/100) + Layer 3 signature match + **Tool Execution: NOT EXECUTED**.
3. **Demo 3 — BOLA Cross-Tenant Access (`BLOCK`)**:
   - Click **`🔴 BOLA Cross-Tenant Violation`** $\rightarrow$ Click **Send Request**.
   - Show: `BLOCK` verdict + Session boundary enforcement (C101 attempting C999).
4. **Demo 4 — High-Risk Financial Transfer (`HITL`)**:
   - Click **`🟡 High-Risk Wire Transfer`** $\rightarrow$ Click **Send Request**.
   - Show: `HITL REQUIRED` card (Risk: 85/100).
   - Click **`APPROVE & GRANT`** right on the screen $\rightarrow$ Observe immediate downstream execution and transaction success!

### 📊 Step 3: SOC Audit & Real-time Telemetry
* Open **`Overview`** and **`Audit Log`** to show that every single evaluated call, block, and approval was cryptographically recorded in PostgreSQL and emitted over WebSocket.

---

### 🏆 Project Status: 100% Complete, Hardened, and Interview-Ready!
