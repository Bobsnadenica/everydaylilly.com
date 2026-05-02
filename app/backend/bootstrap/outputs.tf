output "terraform_state_bucket_name" {
  description = "Bucket name to use for the Terraform S3 backend."
  value       = aws_s3_bucket.terraform_state.bucket
}

output "terraform_backend_init_example" {
  description = "Example terraform init flags for the live stack."
  value       = <<-EOT
    terraform init \
      -backend-config="bucket=${aws_s3_bucket.terraform_state.bucket}" \
      -backend-config="key=live/prod/terraform.tfstate" \
      -backend-config="region=${var.aws_region}" \
      -backend-config="use_lockfile=true"
  EOT
}
