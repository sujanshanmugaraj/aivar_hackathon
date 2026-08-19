-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('ALLOW', 'BLOCK', 'SHADOW_BLOCK', 'RATE_LIMIT', 'HITL');

-- CreateEnum
CREATE TYPE "HitlStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "api_key" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "role" TEXT NOT NULL DEFAULT 'agent',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "shadow_mode" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_calls" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "raw_parameters" JSONB NOT NULL,
    "sanitized_params" JSONB NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "decision" "Decision" NOT NULL,
    "shadow_mode" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "rules_evaluated" TEXT[],
    "matched_rules" TEXT[],
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "tool_call_id" TEXT NOT NULL,
    "event_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hitl_requests" (
    "id" TEXT NOT NULL,
    "tool_call_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "status" "HitlStatus" NOT NULL DEFAULT 'PENDING',
    "risk_score" INTEGER NOT NULL,
    "tool" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "reason" TEXT,
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "hitl_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_name_key" ON "agents"("name");

-- CreateIndex
CREATE UNIQUE INDEX "agents_api_key_key" ON "agents"("api_key");

-- CreateIndex
CREATE INDEX "sessions_agent_id_idx" ON "sessions"("agent_id");

-- CreateIndex
CREATE INDEX "policies_agent_id_idx" ON "policies"("agent_id");

-- CreateIndex
CREATE INDEX "policy_versions_policy_id_idx" ON "policy_versions"("policy_id");

-- CreateIndex
CREATE INDEX "tool_calls_agent_id_idx" ON "tool_calls"("agent_id");

-- CreateIndex
CREATE INDEX "tool_calls_session_id_idx" ON "tool_calls"("session_id");

-- CreateIndex
CREATE INDEX "tool_calls_decision_idx" ON "tool_calls"("decision");

-- CreateIndex
CREATE INDEX "tool_calls_created_at_idx" ON "tool_calls"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_tool_call_id_key" ON "audit_events"("tool_call_id");

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "hitl_requests_tool_call_id_key" ON "hitl_requests"("tool_call_id");

-- CreateIndex
CREATE INDEX "hitl_requests_status_idx" ON "hitl_requests"("status");

-- CreateIndex
CREATE INDEX "hitl_requests_agent_id_idx" ON "hitl_requests"("agent_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tool_call_id_fkey" FOREIGN KEY ("tool_call_id") REFERENCES "tool_calls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hitl_requests" ADD CONSTRAINT "hitl_requests_tool_call_id_fkey" FOREIGN KEY ("tool_call_id") REFERENCES "tool_calls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hitl_requests" ADD CONSTRAINT "hitl_requests_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

