locals {
  prefix            = "${var.project_slug}-${var.environment}"
  gallery_origin_id = "${local.prefix}-gallery-origin"
  tags = merge(
    {
      Project     = "EverydayLilly"
      Component   = "private-photo-backend"
      Environment = var.environment
      ManagedBy   = "Terraform"
    },
    var.tags
  )
}
