terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ─────────────────────────────────────────────────────────────
# AWS Secrets Manager — Secure Key Store for AegisWAF
# ─────────────────────────────────────────────────────────────
resource "aws_secretsmanager_secret" "aegis_waf_secrets" {
  name                    = "aegis-waf/production/secrets"
  description             = "Production API keys, database credentials, and cryptographic secrets for AegisWAF"
  recovery_window_in_days = 7

  tags = {
    Environment = "production"
    Application = "AegisWAF"
    Compliance  = "Aivar-Governed-Agent-Security"
  }
}

resource "aws_secretsmanager_secret_version" "aegis_waf_secrets_val" {
  secret_id = aws_secretsmanager_secret.aegis_waf_secrets.id
  secret_string = jsonencode({
    DATABASE_URL   = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${var.db_name}"
    REDIS_URL      = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
    JWT_SECRET     = var.jwt_secret
    OPENAI_API_KEY = var.openai_api_key
    GROQ_API_KEY   = var.groq_api_key
    XAI_API_KEY    = var.xai_api_key
  })
}

# ─────────────────────────────────────────────────────────────
# IAM Role for ECS Task Execution with Secrets Access
# ─────────────────────────────────────────────────────────────
resource "aws_iam_role" "ecs_execution_role" {
  name = "aegis-waf-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_base" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_policy" "secrets_access_policy" {
  name        = "aegis-waf-secrets-manager-access"
  description = "Allows AegisWAF ECS task to read production secrets at runtime"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = aws_secretsmanager_secret.aegis_waf_secrets.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_secrets_attach" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = aws_iam_policy.secrets_access_policy.arn
}
