# ─────────────────────────────────────────────────────────────
# AegisWAF ECS Fargate & Cloud Architecture
# ─────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "aegis_cluster" {
  name = "aegis-waf-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "gateway_task" {
  family                   = "aegis-waf-gateway"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "gateway"
      image     = "${aws_ecr_repository.gateway_repo.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 3001
          hostPort      = 3001
        }
      ]
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${aws_secretsmanager_secret.aegis_waf_secrets.arn}:DATABASE_URL::"
        },
        {
          name      = "REDIS_URL"
          valueFrom = "${aws_secretsmanager_secret.aegis_waf_secrets.arn}:REDIS_URL::"
        },
        {
          name      = "JWT_SECRET"
          valueFrom = "${aws_secretsmanager_secret.aegis_waf_secrets.arn}:JWT_SECRET::"
        },
        {
          name      = "OPENAI_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.aegis_waf_secrets.arn}:OPENAI_API_KEY::"
        },
        {
          name      = "GROQ_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.aegis_waf_secrets.arn}:GROQ_API_KEY::"
        },
        {
          name      = "XAI_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.aegis_waf_secrets.arn}:XAI_API_KEY::"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/aegis-waf-gateway"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}

resource "aws_ecr_repository" "gateway_repo" {
  name                 = "aegis-waf-gateway"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}
