# 🛡️ AegisWAF (PS-5.1) — Zero-Trust Runtime Control Plane & Policy Guard for Autonomous AI Agents



### **Author:** Sujan S  
### **Roll Number:** 22PD35  
### **Course:** MSc Data Science — PSG College of Technology  
 


---

## 🔗 Live Production Deployment Links


##  **Live SOC Dashboard**  [https://aegis-dashboard-u2x2.onrender.com](https://aegis-dashboard-u2x2.onrender.com) 


---

## 🎬 Project Demo Video & Walkthrough

> 📺 **Video Walkthrough Placeholder**  
> *A full video demonstration walking through the real-time NLP intent engine, 7-layer defense interception, SQL injection mitigation, BOLA cross-tenant blocking, and HITL compliance resolution will be linked here.*

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                        │
│                                🎬 DEMO VIDEO PLAYBACK                                  │
│                                                                                        │
│                  [ https://www.youtube.com/watch?v=YOUR_DEMO_VIDEO_ID ]                │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Complete Technology Stack

| Layer | Technologies Used | Description |
|---|---|---|
| **Frontend Dashboard** | React 18, Vite, TypeScript, TailwindCSS, Lucide Icons, Recharts | High-performance SOC dashboard with responsive mobile drawer navigation and real-time charts |
| **WAF Runtime Gateway** | Node.js (v20), Fastify, TypeScript, Zod | Low-latency (4–10ms) HTTP/REST API gateway and 7-layer security evaluation engine |
| **Realtime Telemetry** | WebSocket (`ws`), Server-Sent Events (SSE) | Live streaming event bus broadcasting every interception event to connected SOC clients |
| **Primary Database** | PostgreSQL 16 (Render Managed), Prisma ORM | Persistent storage for agent identities, tool calls, HITL requests, and audit logs |
| **Cache & State Engine** | Redis 7 (Upstash Serverless), `ioredis` | Microsecond atomic Lua sliding-window rate limiting, sequence graphs, and anti-replay nonces |
| **Autonomous AI Agent** | TypeScript, LangChain Function Calling, Rule-based NLP | Autonomous customer support and financial agents executing tools under zero-trust governance |
| **Containerization** | Docker, Docker Compose, Alpine Linux Multi-stage Builds | Production-hardened lightweight containers with non-root security execution |
| **Cloud Hosting** | Render (Web Service + Static Site), Upstash Redis | $0 Free-Tier multi-service deployment with continuous Git delivery |
| **Testing & Verification** | Vitest, TSX, Custom Penetration & Invariant Suites | 100% automated invariant suites and penetration attack resistance test harnesses |



---

## 🎯 1. Problem Statement (PS-5.1) & Challenge Context

### The Vulnerability with Autonomous AI Agents
Modern Large Language Models (LLMs) are increasingly deployed as autonomous agents equipped with function-calling capabilities (tools) to interact directly with sensitive enterprise backends—such as executing SQL queries, querying customer PII, transferring funds, updating records, or sending emails.

However, LLM agents suffer from critical zero-day vulnerabilities:
* **Prompt Injections & Jailbreaks (OWASP LLM01):** Adversarial prompts can trick an LLM into selecting destructive tools (e.g., executing `DROP TABLE`, running reverse shells, or issuing high-volume delete requests).
* **Broken Object Level Authorization / BOLA (OWASP LLM02 / API1):** An authenticated agent operating on behalf of Tenant A (`C101`) can hallucinate or be coerced into querying confidential records belonging to Tenant B (`C999`).
* **Uncontrolled Rate Limiting & Resource Exhaustion (OWASP LLM04):** Malicious prompts or recursive agent loops can flood upstream APIs with thousands of calls, leading to denial of service or financial drainage.
* **Lack of State Machine Enforcement:** LLMs lack inherent transactional state awareness and may attempt destructive operations (e.g. `delete_customer` or `transfer_money`) without prerequisite verification steps (e.g. `get_customer`).
* **Absence of Auditability & Compliance Holds:** Regulated industries require immutable cryptographic audit logs and Human-in-the-Loop (HITL) authorization gates for high-stakes actions.

### The Solution: AegisWAF
**AegisWAF (PS-5.1)** is an inline, zero-trust runtime security proxy. Positioned strictly between AI Agents and upstream services, every single tool call is intercepted and evaluated across a sub-10ms **7-Layer Policy Pipeline**. Safe requests proceed (`ALLOW`), cyber threats and BOLA attacks are terminated immediately (`BLOCK`), volumetric bursts are throttled (`RATE_LIMIT`), and high-risk operations are held in an asynchronous **Human-in-the-Loop (`HITL`)** review queue.

---

## 🏛️ 2. Executive Architecture & System Topology

```
                              ┌──────────────────────────────────┐
                              │       END-USER / ATTACKER        │
                              └─────────────────┬────────────────┘
                                                │ Natural Language
                                                ▼
                              ┌──────────────────────────────────┐
                              │      🤖 AUTONOMOUS AI AGENT      │
                              │   Intent Parsing & Tool Call     │
                              └─────────────────┬────────────────┘
                                                │ POST /api/waf/evaluate
                                                ▼
     ╔═══════════════════════════════════════════════════════════════════════════════╗
     ║                        🛡️ AEGIS WAF RUNTIME GATEWAY                           ║
     ║                                                                               ║
     ║  [Layer 1] Agent Authentication & Anti-Replay Nonce (SHA-256 / UUID)          ║
     ║  [Layer 2] Redis Sliding-Window Rate Limiter (Atomic Lua Script)              ║
     ║  [Layer 3] Parameter Threat & PII Guard (Regex Signatures: SQLi, RCE, Path)   ║
     ║  [Layer 4] BOLA Multi-Tenant Boundary (Session Scope Binding)                 ║
     ║  [Layer 5] Sequence State Graph (Prerequisite Workflow Graph in Redis)        ║
     ║  [Layer 6] Weighted Composite Risk Engine (Deterministic 0-100 Scoring)       ║
     ║  [Layer 7] Human-in-the-Loop (HITL) Governance Gate (Compliance Hold)         ║
     ╚══════════════════════╦═══════════════════════╦════════════════════════════════╝
                            ║                       ║
            ┌───────────────▼──────────┐   ┌────────▼────────────────┐
            │      🟢 ALLOW            │   │      🟡 HITL QUEUE      │
            │  Two-Phase Authorized    │   │  Asynchronous Hold      │
            │  Execution Token         │   │  [APPROVE] / [REJECT]   │
            └───────────────┬──────────┘   └────────┬────────────────┘
                            │                       │ (Upon Approval)
                            └───────────┬───────────┘
                                        │
                                        ▼
                       ┌─────────────────────────────────┐
                       │  🗄️ UPSTREAM TOOLS & ENTERPRISE  │
                       │  PostgreSQL CRM / Banking APIs  │
                       └─────────────────────────────────┘
```

---

## 🛡️ 3. The 7-Layer Defense Pipeline (In-Depth Technical Breakdown)

```
[Incoming Tool Call] ─► L1: Auth & Nonce ─► L2: Rate Limit ─► L3: Threat Guard ─► L4: BOLA ─► L5: Sequence ─► L6: Risk Engine ─► L7: HITL ─► [Execute]
```

### 🔹 Layer 1: Agent Authentication & Anti-Replay Nonce
* **Mechanism:** Validates incoming agent Bearer tokens against SHA-256 hashed secrets in the registry. Each request must contain a unique `requestId` (UUIDv4) that is tracked in Redis with a 24-hour TTL.
* **Defense:** Prevents unauthorized rogue agents from invoking tools and eliminates Replay Attacks ($409\text{ REPLAY\_ATTACK\_DETECTED}$).

### 🔹 Layer 2: Redis Sliding-Window Rate Limiter
* **Mechanism:** Executes microsecond-accurate atomic Lua scripts in Redis using a sliding timestamp log ($O(1)$ complexity).
* **Defense:** Throttles aggressive bursts per agent and per tool sensitivity (e.g., maximum 5 financial wire transfers per hour), returning $429\text{ RATE\_LIMIT}$.

### 🔹 Layer 3: Parameter Threat & PII Guard
* **Mechanism:** Deep recursive inspection of all JSON payload keys and values against compiled threat signature tables:
  * **SQL Injection:** `' OR '1'='1`, `UNION SELECT`, `DROP TABLE`, `--`, `;`
  * **Command Injection / RCE:** `; rm -rf`, `/bin/bash`, `| nc`, `curl | sh`
  * **Path Traversal:** `../`, `/etc/passwd`, `C:\Windows\System32`
  * **XSS / HTML Injection:** `<script>`, `onerror=`, `javascript:`
  * **PII Redaction:** Automatic cryptographic masking of SSN, Credit Cards, and Passwords.
* **Defense:** Intercepts payload exploits before they ever reach upstream application code.

### 🔹 Layer 4: BOLA / Data Scope & Tenant Isolation
* **Mechanism:** Extracts authenticated session tenant context (`session.customerId = C101`) and enforces strict invariant bounds across all tool arguments.
* **Defense:** Blocks OWASP LLM02 Broken Object Level Authorization if an agent in session `C101` attempts to access or mutate records for customer `C999`.

### 🔹 Layer 5: Sequence State Graph
* **Mechanism:** Stateful graph tracking in Redis verifying that dangerous operations follow mandatory pre-requisites.
* **Defense:** Disallows `delete_customer` or `transfer_money` without an authenticated and verified `get_customer` lookup within the preceding session window.

### 🔹 Layer 6: Weighted Composite Risk Engine
* **Mechanism:** Deterministic, multi-variable heuristic risk scoring function ($0–100$):
  $$\text{Risk} = \text{Base Tool Risk} + \text{Monetary Weight} + \text{Payload Anomaly} + \text{Tenant Violation Penalty} + \text{Sequence Penalty}$$
* **Thresholds:**
  * **$0 - 30$:** `LOW RISK` $\rightarrow$ Immediate `ALLOW`
  * **$31 - 50$:** `ELEVATED` $\rightarrow$ Policy Evaluation
  * **$51 - 90$:** `HIGH RISK` $\rightarrow$ Escalate to `HITL` Queue
  * **$91 - 100$:** `CRITICAL THREAT` $\rightarrow$ Immediate `BLOCK`

### 🔹 Layer 7: Human-in-the-Loop (HITL) Governance Gate
* **Mechanism:** Suspends high-risk actions in PostgreSQL with atomic Compare-and-Swap (CAS) resolution. Security officers review pending calls via WebSocket telemetry and issue signed cryptographic approvals or rejections. Includes automated 60-second expiry sweeps.

---

## 🧠 4. Real-Time NLP Intent Engine

AegisWAF includes a sub-millisecond, deterministic **NLP Intent Detection Engine** (`POST /api/system/nlp-parse`). Users can type natural language instructions, and the engine extracts structured tool intent, agent assignments, and parameters without depending on third-party LLM APIs:

```
"Transfer ₹25,000 to Acme Corp"  ──►  Agent: finance-agent
                                      Tool: transfer_money
                                      Parameters: { "to": "Acme Corp", "amount": 25000 }
                                      Confidence: 97%
```

---

## 📸 5. Visual Walkthrough & Live Production Screenshots

The following live screenshots demonstrate AegisWAF actively running and defending upstream systems on the production Render deployment.

---

### 1. Security Operations Center Overview
Real-time control plane featuring live WebSocket stream connection status (`LIVE WS`), total request counters, decision distributions (ALLOW / BLOCK / HITL / RATE_LIMIT), median latency gauges, and active 7-layer defense telemetry.

![Overview Dashboard](docs/screenshots/overview_dashboard.png)

---

### 2. Real-Time NLP Intent Detection in Playground
As the end-user types natural language prompts, the NLP engine runs debounced real-time analysis, displaying `AI parsing intent...` before auto-selecting the target agent, tool name, and formatted JSON parameters.

![NLP Intent Detection](docs/screenshots/nlp_intent_detection.png)

---

### 3. Scenario 1 — Legitimate CRM Lookup (`ALLOW`)
* **Input:** `Get customer C101 profile`  
* **Verdict:** `ALLOW` (Risk: **8/100**, Latency: **5ms**). All 6 active WAF layers pass cleanly. Upstream CRM returns Alice Johnson's customer profile with zero false positives.

![Scenario 1 - ALLOW](docs/screenshots/test_01_allow.png)

---

### 4. Scenario 2 — SQL Injection Attack Defense (`BLOCK`)
* **Input:** `Search customer where name is ' OR 1=1 --`  
* **Verdict:** `BLOCK` (Risk: **45/100**). **Layer 3 (Parameter Threat Guard)** triggers immediately on the tautology signature. Upstream tool execution is **Terminated by WAF** before reaching PostgreSQL.

![Scenario 2 - SQLi BLOCK](docs/screenshots/test_02_sqli_block.png)

---

### 5. Scenario 3 — BOLA Cross-Tenant Violation (`BLOCK`)
* **Input:** `Access confidential profile for customer C999`  
* **Verdict:** `BLOCK` (Risk: **48/100**). **Layer 4 (BOLA Tenant Boundary)** intercepts the request. The session is bound to tenant `C101`, preventing unauthorized cross-tenant data leakage (OWASP LLM02).

![Scenario 3 - BOLA BLOCK](docs/screenshots/test_03_bola_block.png)

---

### 6. Scenario 4 — Redis Sliding-Window Rate Limit (`RATE_LIMIT`)
* **Input:** `Transfer ₹25,000 to Acme Corp` (during active burst)  
* **Verdict:** `RATE_LIMIT` (Risk: **100/100 CRITICAL**). **Layer 2 (Redis Sliding-Window)** enforces quota limits (`9/5 calls in 3600s window`), throttling aggressive agent loops within 2ms.

![Scenario 4 - Rate Limit](docs/screenshots/test_04_rate_limit.png)

---

### 7. Scenario 4b — High-Risk Financial Wire Transfer (`HITL Pending`)
* **Input:** High-value wire transfer request  
* **Verdict:** `HITL` (Risk: **85/100**). High monetary value escalates the action to compliance review. The interface presents interactive **[APPROVE]** and **[REJECT]** buttons for authorized compliance officers.

![Scenario 4b - HITL Pending](docs/screenshots/test_04_hitl_pending.png)

---

### 8. Scenario 4b — Compliance Officer Approval (`HITL -> ALLOW`)
Upon clicking **APPROVE**, the compliance officer's cryptographic token authorizes the transaction, transitioning the decision to `ALLOW` and triggering safe downstream execution.

![Scenario 4b - HITL Approved](docs/screenshots/test_04_hitl_approved.png)

---

### 9. Central Human-in-the-Loop (HITL) Governance Queue
Dedicated compliance portal (`/hitl`) displaying pending review items, risk scores, parameter breakdowns, and resolution history with single-winner atomic locking.

![HITL Queue](docs/screenshots/test_05_hitl_queue.png)

---

### 10. Dynamic Policy Engine & Rule Inspector
Visual policy manager (`/policies`) rendering active YAML rules, tenant boundary definitions, sensitivity tiers, and the interactive live policy testing simulator.

![Policy Engine](docs/screenshots/policies_page.png)

---

## 📦 6. Monorepo Structure & Microservices

```text
PS_5.1_Agent_WAF/
├── apps/
│   ├── gateway/                  # 🛡️ Core Fastify + TypeScript WAF Gateway
│   │   ├── prisma/               # PostgreSQL schema & migrations
│   │   └── src/
│   │       ├── audit/            # Cryptographic audit service
│   │       ├── engine/           # 7-Layer Interceptor & Demo Runner
│   │       ├── middleware/       # RBAC Auth & Bearer validation
│   │       ├── observability/    # Prometheus metrics & latency gauges
│   │       ├── realtime/         # WebSocket event bus (ws)
│   │       ├── routes/           # /api/waf, /api/hitl, /api/system
│   │       └── rules/            # Rate limit, BOLA, sequence, params
│   ├── dashboard/                # 📊 React 18 + Vite + TailwindCSS SOC Portal
│   │   └── src/
│   │       ├── components/       # Metric cards, drawer sidebar, badges
│   │       └── pages/            # Overview, Playground, HITL, Policies, Audit
│   └── agent/                    # 🤖 Autonomous AI Agent (LangChain / Semantic)
│       └── src/
│           ├── simulations/      # Normal & attack simulation scripts
│           └── tools/            # Enterprise CRM and banking tools
├── docker/                       # 🐳 Multi-stage Alpine Dockerfiles
├── docs/                         # 📚 Comprehensive architecture reports & screenshots
│   ├── screenshots/              # Annotated production test evidence
│   ├── 7_LAYER_DEFENSE_ARCHITECTURE.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── END_TO_END_MASTER_REPORT.md
│   └── LIVE_TEST_REPORT.md
├── infra/                        # ☁️ Cloud Configuration
├── docker-compose.yml            # 🐳 1-Command local cluster deployment
├── package.json                  # PNPM Workspace root
└── render.yaml                   # 🚀 Render cloud infrastructure blueprint
```

---

## 🧪 7. Automated Verification & Penetration Test Evidence

AegisWAF includes automated end-to-end invariant and penetration test suites:

### 1. Invariant Defense Suite (`pnpm test:comprehensive`)
```text
✔ Layer 1: Valid Agent Token & Nonce Accepted
✔ Layer 1: Replayed Request ID Rejected (409 Conflict)
✔ Layer 2: Normal Call Rate Allowed
✔ Layer 2: Burst Call Rate Throttled (429 Rate Limit)
✔ Layer 3: Legitimate Query Allowed
✔ Layer 3: SQL Injection Tautology Blocked
✔ Layer 3: Shell Command Injection Blocked
✔ Layer 4: Same-Tenant Data Scoping Allowed
✔ Layer 4: Cross-Tenant BOLA Access Blocked
✔ Layer 5: Correct Sequence (get -> update) Allowed
✔ Layer 5: Sequence Violation (delete without get) Blocked
✔ Layer 6: Composite Risk Score Accurately Calculated
✔ Layer 7: High-Risk Wire Transfer Escalated to HITL
✔ Layer 7: Atomic Compare-and-Swap Prevents Double Approval

18 passed, 0 failed (100% pass rate)
```

### 2. Penetration Resistance Verification (`pnpm test:penetration`)
```text
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

FINAL REPORT: 10 DEFENDED | 0 BYPASSED | Total: 10
```

---

## 🔐 8. Enterprise RBAC & Fault Tolerance

### Role-Based Access Control (RBAC) Matrix

| Role | Permissions & Access Scope |
|---|---|
| `admin` | Full system control, policy reload, agent registration, audit inspection |
| `security_officer` | HITL Queue resolution (`APPROVE` / `REJECT`), incident review |
| `auditor` | Read-only access to immutable PostgreSQL audit trails and metrics |
| `agent` | Runtime identity permitted to call `/api/waf/evaluate` and `/api/waf/execute` |

### Production Fault-Tolerance Guarantees
* **Corrupted Policy YAML:** Automatically falls back to an immutable, compiled in-memory Default-Deny policy without service interruption.
* **Database / Cache Outage:** Returns structured, normalized JSON HTTP 503 envelopes without exposing internal ORM stack traces or connection strings.
* **HITL Race Conditions:** Atomic PostgreSQL `UPDATE ... WHERE status = 'PENDING'` ensures strict single-winner resolution when multiple compliance officers review the same transaction simultaneously ($200\text{ OK}$ vs $409\text{ CONFLICT}$).

---

## 💻 9. Local Development & Quickstart

### Prerequisites
* **Node.js:** `v20.x` or higher
* **Package Manager:** `pnpm` (`v9.x`)
* **Docker & Docker Compose**

### Step 1: Clone and Install Dependencies
```bash
git clone https://github.com/sujanshanmugaraj/aivar_hackathon.git
cd aivar_hackathon
pnpm install
```

### Step 2: Configure Environment
```bash
cp .env.example .env
```

### Step 3: Run with Docker Compose (Single Command)
```bash
docker compose up --build -d
```
* **Dashboard:** `http://localhost:5173`
* **WAF Gateway:** `http://localhost:3001`
* **Autonomous Agent:** `http://localhost:3002`

### Step 4: Run Tests
```bash
pnpm test:comprehensive
pnpm test:penetration
```

---


