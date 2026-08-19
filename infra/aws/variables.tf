variable "aws_region" {
  type        = string
  default     = "ap-south-1"
  description = "Primary AWS deployment region"
}

variable "db_username" {
  type        = string
  default     = "aegis_admin"
  description = "RDS PostgreSQL master username"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "RDS PostgreSQL master password (must be passed securely)"
}

variable "db_name" {
  type        = string
  default     = "aegis_waf_prod"
  description = "RDS PostgreSQL database name"
}

variable "jwt_secret" {
  type        = string
  sensitive   = true
  description = "Cryptographic JWT session signing secret"
}

variable "openai_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "OpenAI API Key for Agent LLM inference"
}

variable "groq_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Groq API Key for fast LLaMA inference"
}

variable "xai_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "xAI Grok API Key"
}
