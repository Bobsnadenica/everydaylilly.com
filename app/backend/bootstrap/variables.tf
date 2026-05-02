variable "aws_region" {
  description = "AWS region that will hold the Terraform state bucket."
  type        = string
  default     = "eu-central-1"
}

variable "terraform_state_bucket_name" {
  description = "Globally unique name for the Terraform state bucket."
  type        = string
}

variable "tags" {
  description = "Extra tags to add to bootstrap resources."
  type        = map(string)
  default     = {}
}
