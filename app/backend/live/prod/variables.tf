variable "aws_region" {
  description = "Primary AWS region for Cognito and S3."
  type        = string
  default     = "eu-central-1"
}

variable "project_slug" {
  description = "Short slug used in resource names."
  type        = string
  default     = "everyday-lilly-vault"
}

variable "environment" {
  description = "Environment suffix for resource naming."
  type        = string
  default     = "prod"
}

variable "auth_callback_urls" {
  description = "Allowed Cognito callback URLs."
  type        = list(string)
}

variable "auth_logout_urls" {
  description = "Allowed Cognito logout URLs."
  type        = list(string)
}

variable "cognito_domain_prefix" {
  description = "Unique Cognito hosted UI domain prefix."
  type        = string
}

variable "archive_transition_days" {
  description = "Days before archive uploads transition to DEEP_ARCHIVE."
  type        = number
  default     = 7
}

variable "gallery_month_prefix" {
  description = "Prefix inside the gallery bucket for the flat numeric gallery files."
  type        = string
  default     = "months"
}

variable "price_class" {
  description = "CloudFront price class."
  type        = string
  default     = "PriceClass_100"

  validation {
    condition = contains(
      ["PriceClass_All", "PriceClass_200", "PriceClass_100"],
      var.price_class
    )
    error_message = "price_class must be one of PriceClass_100, PriceClass_200, or PriceClass_All."
  }
}

variable "tags" {
  description = "Extra tags to add to all resources."
  type        = map(string)
  default     = {}
}
