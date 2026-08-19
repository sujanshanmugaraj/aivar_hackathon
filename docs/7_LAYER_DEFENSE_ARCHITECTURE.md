# 🛡️ AegisWAF: The 7-Layer Defense Architecture

AegisWAF (PS-5.1) enforces a deterministic, high-speed (sub-15ms) multi-stage inspection pipeline on every autonomous AI agent tool call before execution reaches upstream databases, CRM APIs, or financial services.

---

## ⚡ The 30-Second Judge Elevator Pitch

> *"AegisWAF is an inline runtime security gateway for AI agents that intercepts every tool invocation through a 7-layer pipeline:
> First, it authenticates the agent and deduplicates the nonce to prevent replay attacks.
> Second, it enforces atomic sliding-window rate limits in Redis.
> Third, it sanitizes parameters and runs regex threat filters against SQL injection, RCE, and XSS.
> Fourth, it enforces tenant session boundaries to stop BOLA data leaks.
> Fifth, it checks state machine sequence prerequisites.
> Sixth, it computes a composite 0–100 risk score with anomaly weighting.
> Finally, in layer seven, safe operations proceed, attacks are blocked, and high-risk financial transfers are paused in an asynchronous Human-in-the-Loop approval queue."*

---

## 📐 The 7 Layers — Technical Breakdown & Code Reference

```text
  [ AI AGENT TOOL CALL ]
           │
  ┌────────▼────────────────────────────────────────────────────────┐
  │ Layer 1: Authentication & Nonce Replay Defense                 │
  │ (auth.ts & waf.ts: SHA-256 Agent Key + Duplicate UUID Check)   │
  └────────┬────────────────────────────────────────────────────────┘
           │
  ┌────────▼────────────────────────────────────────────────────────┐
  │ Layer 2: Redis Sliding-Window Rate Limiting                     │
  │ (rate-limit.ts: Lua-based atomic sliding window per tool)       │
  └────────┬────────────────────────────────────────────────────────┘
           │
  ┌────────▼────────────────────────────────────────────────────────┐
  │ Layer 3: Parameter Threat Detection & PII Sanitization          │
  │ (parameter-validation.ts: SQLi, RCE, Traversal, XSS & Redaction)│
  └────────┬────────────────────────────────────────────────────────┘
           │
  ┌────────▼────────────────────────────────────────────────────────┐
  │ Layer 4: Data Scope & Multi-Tenant Isolation (BOLA)            │
  │ (data-scope.ts: Session Customer ID binding)                   │
  └────────┬────────────────────────────────────────────────────────┘
           │
  ┌────────▼────────────────────────────────────────────────────────┐
  │ Layer 5: Sequence State Graph & Prerequisites                   │
  │ (sequence.ts: Enforces prerequisite tool call ordering)         │
  └────────┬────────────────────────────────────────────────────────┘
           │
  ┌────────▼────────────────────────────────────────────────────────┐
  │ Layer 6: Multi-Factor Weighted Risk Engine                      │
  │ (risk-engine.ts: Base tool sensitivity + rule penalties 0-100)  │
  └────────┬────────────────────────────────────────────────────────┘
           │
  ┌────────▼────────────────────────────────────────────────────────┐
  │ Layer 7: Human-in-the-Loop (HITL) & Two-Phase Execution Gate    │
  │ (hitl.ts & waf.ts: Compliance Approval + evaluate/execute check)│
  └────────┬────────────────────────────────────────────────────────┘
           │
   ┌───────┴───────────────┬──────────────────────┐
   ▼                       ▼                      ▼
 ALLOW (0–50)         HITL (51–90)           BLOCK (91–100)
 Tool Executes        Paused for Human Sign   Execution Denied &
 & Logged to DB       in SOC Console         Logged in Audit Trail
```

---

### Detailed Layer Specifications:

#### 1. Layer 1 — Authentication & Nonce Replay Defense
* **Source Files**: `apps/gateway/src/middleware/auth.ts`, `apps/gateway/src/routes/waf.ts`
* **Mechanism**: Every agent request must carry a Bearer token hashed with SHA-256 and matched against authorized agent profiles in PostgreSQL. Concurrently, every `requestId` (UUIDv4) is checked in PostgreSQL to detect and reject replay attacks ($409\text{ REPLAY\_ATTACK\_DETECTED}$).

#### 2. Layer 2 — Redis Sliding-Window Rate Limiting
* **Source File**: `apps/gateway/src/engine/rules/rate-limit.ts`
* **Mechanism**: Atomic sliding-window logs executed in Redis via Lua scripts. Enforces burst and hourly quotas per tool (e.g. `transfer_money`: 5 req/hour, `search_customer`: 30 req/min). Breaches immediately throttle with $429\text{ RATE\_LIMIT}$.

#### 3. Layer 3 — Parameter Threat Detection & PII Sanitization
* **Source File**: `apps/gateway/src/engine/rules/parameter-validation.ts`
* **Mechanism**: Deeply traverses request parameters to mask sensitive credentials (`password`, `token`, `ssn`) and scans values against compiled regex signatures for SQL Injection (`DROP`, `UNION SELECT`, `' OR '1'='1`), Command Injection (`rm -rf`, `/bin/bash`), Path Traversal (`../`), and XSS (`<script>`).

#### 4. Layer 4 — Data Scope & Multi-Tenant Isolation (BOLA)
* **Source File**: `apps/gateway/src/engine/rules/data-scope.ts`
* **Mechanism**: Protects against Broken Object Level Authorization (OWASP API1 / LLM02). Verifies that customer IDs requested in tool parameters strictly match the authenticated user's session boundary (`C101` cannot read or modify `C999`).

#### 5. Layer 5 — Sequence State Graph & Prerequisites
* **Source File**: `apps/gateway/src/engine/rules/sequence.ts`
* **Mechanism**: Enforces conversational state machine prerequisites in Redis. Dangerous state-mutating actions (such as `update_customer`, `delete_customer`, or `transfer_money`) are strictly blocked unless a read action (`get_customer`) was legitimately authorized earlier in the same session.

#### 6. Layer 6 — Multi-Factor Weighted Risk Engine (0–100)
* **Source File**: `apps/gateway/src/engine/risk-engine.ts`
* **Mechanism**: Calculates a deterministic composite risk score:
  $$\text{Score} = \text{Base Sensitivity} + \sum \text{Rule Violation Penalties} + \text{Payload / Amount Anomalies}$$
  - Rates: `0–50` $\rightarrow$ `ALLOW`, `51–90` $\rightarrow$ `HITL`, `91–100` $\rightarrow$ `BLOCK`.

#### 7. Layer 7 — Human-in-the-Loop (HITL) & Two-Phase Execution Gate
* **Source Files**: `apps/gateway/src/routes/hitl.ts`, `apps/gateway/src/routes/waf.ts`
* **Mechanism**: High-risk financial operations are held in a `PENDING` state in PostgreSQL and pushed live to the SOC Dashboard via WebSocket. Upstream execution requires explicit reviewer sign-off, and the execution endpoint enforces cryptographic two-phase verification (`evaluate` $\rightarrow$ `execute`).
