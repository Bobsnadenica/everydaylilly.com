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

variable "gallery_test_prefix" {
  description = "Prefix inside the gallery bucket for the test-only gallery files."
  type        = string
  default     = "test"
}

variable "gallery_public_base_url" {
  description = "Public base URL that viewers use for the CloudFront gallery distribution."
  type        = string
}

variable "gallery_signed_url_ttl_seconds" {
  description = "Lifetime in seconds for the signed gallery image URLs returned by the backend. Defaults to 7 days for better browser caching."
  type        = number
  default     = 604800
}

variable "gallery_api_allowed_origins" {
  description = "Browser origins allowed to call the private gallery manifest API through CloudFront."
  type        = list(string)
  default = [
    "https://www.everydaylilly.com",
    "http://localhost:8000"
  ]
}

variable "cognito_login_captcha_rate_limit" {
  description = "Per-IP request rate for hidden CAPTCHA on Cognito managed login endpoints. AWS WAF requires a minimum of 10."
  type        = number
  default     = 10
}

variable "cognito_login_captcha_evaluation_window_sec" {
  description = "Evaluation window in seconds for the Cognito managed login CAPTCHA rate rule."
  type        = number
  default     = 60
}

variable "cognito_login_captcha_immunity_time_sec" {
  description = "How long a solved Cognito managed login CAPTCHA stays valid for that browser session."
  type        = number
  default     = 900
}

variable "cognito_login_timeout_rate_limit" {
  description = "Per-IP request rate that upgrades Cognito managed login abuse from CAPTCHA to a temporary block timeout."
  type        = number
  default     = 25
}

variable "cognito_login_timeout_evaluation_window_sec" {
  description = "Evaluation window in seconds for the Cognito managed login temporary block rule."
  type        = number
  default     = 300
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
