# 🚀 AegisWAF (PS-5.1) — Production & Cloud Deployment Guide

AegisWAF is designed with cloud-native, containerized architecture that supports **Zero-Downtime Multi-Stage Docker Builds**, **Single-Command Docker Compose Stacks**, and **Production AWS ECS Fargate Infrastructure as Code (Terraform)**.

---

## 🏛️ Production Deployment Topology

```text
                                Internet / Clients
                                        │
                         ┌──────────────▼──────────────┐
                         │   AWS Application LB (ALB)   │
                         │    (SSL / TLS Termination)   │
                         └──────┬──────────────┬───────┘
                                │              │
                    Path: /api/*, /events      Path: /* (Web UI)
                                │              │
                                ▼              ▼
                    ┌──────────────────┐  ┌──────────────────┐
                    │  ECS Fargate:    │  │  ECS Fargate /   │
                    │  AegisWAF Gateway│  │  S3 + CloudFront │
                    │  (Port 3001)     │  │  (Dashboard Nginx│
                    └─────────┬────────┘  └──────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌───────────────────────────┐           ┌───────────────────────────┐
│   Amazon ElastiCache      │           │      Amazon RDS           │
│   Redis (Sliding Window)  │           │  PostgreSQL (Multi-AZ)    │
│   Port 6379               │           │  Audit Trail & Policies   │
└───────────────────────────┘           └───────────────────────────┘
```

---

## 🐳 1. Single-Command Local & On-Premise Deployment (Docker Compose)

The entire 5-service ecosystem runs in an isolated virtual bridge network (`aegis-network`):

```bash
# Build and launch all 5 microservices in background
docker compose up --build -d

# Verify all containers are healthy
docker compose ps
```

### Containers Provisioned:
1. **`aegis-postgres`** (PostgreSQL 16 Alpine): Port `5433:5432` — Persistent audit records & identity registry.
2. **`aegis-redis`** (Redis 7 Alpine): Port `6379:6379` — Sliding-window counters, sequence graph, and idempotency cache.
3. **`aegis-gateway`** (Fastify + TypeScript): Port `3001:3001` — 7-Layer WAF Policy & Risk Engine.
4. **`aegis-dashboard`** (Nginx + React Vite): Port `5173:80` — Security Operations Center UI.
5. **`aegis-agent`** (Autonomous AI Agent): Port `3002:3002` — Tool selection & conversational execution.

---

## ☁️ 2. AWS Cloud Deployment (Terraform + ECS Fargate)

Terraform definitions are structured under **`infra/aws/`**:

### Files:
* **[infra/aws/main.tf](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/infra/aws/main.tf)**: Provisions **AWS Secrets Manager**, IAM Execution Roles, and least-privilege security policies.
* **[infra/aws/ecs.tf](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/infra/aws/ecs.tf)**: Provisions **ECS Cluster**, **Fargate Task Definitions**, **ECR Repositories**, and CloudWatch log groups.
* **[infra/aws/variables.tf](file:///c:/Users/valin/OneDrive/Dokumen/PS_5.1_Agent_WAF/infra/aws/variables.tf)**: Configures multi-region options (`ap-south-1`) and sensitive variable masking.

### Step-by-Step AWS Deployment Commands:

```bash
# 1. Authenticate Docker with Amazon ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com

# 2. Build and Push Gateway Container Image
docker build -f docker/Dockerfile.gateway -t aegis-waf-gateway .
docker tag aegis-waf-gateway:latest <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/aegis-waf-gateway:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/aegis-waf-gateway:latest

# 3. Initialize and Apply Terraform Infrastructure
cd infra/aws
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

---

## 🔒 3. Cloud Production Hardening Checklist

| Domain | Cloud Production Standard | AegisWAF Implementation |
| :--- | :--- | :--- |
| **Secrets & Keys** | No plain text in Git or Dockerfiles | Injected dynamically from **AWS Secrets Manager** into ECS RAM |
| **Data Scope Isolation** | Multi-tenant tenant boundary (BOLA) | Session customer ID binding strictly validated in **Layer 4** |
| **High Availability** | Multi-AZ resilient clustering | ECS Fargate autoscaling with Multi-AZ RDS PostgreSQL |
| **Observability** | Prometheus time-series & Health checks | `/health`, `/ready`, and `/metrics` standard endpoints |
| **Network Security** | VPC private subnets | Database and Redis containers isolated inside private VPC subnets |

---

## 🎙️ 30-Second Interview Explanation for Deployment:

> *"AegisWAF is designed cloud-native for AWS. The core gateway runs as a containerized microservice on ECS Fargate behind an Application Load Balancer. State is decoupled into Amazon RDS PostgreSQL for immutable audit logging and Amazon ElastiCache Redis for sub-10ms sliding-window rate limiting. All sensitive API keys and database credentials are managed via AWS Secrets Manager with zero secrets committed to source control."*
