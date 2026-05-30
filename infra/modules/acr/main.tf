# ============================================================
# modules/acr/main.tf — Azure Container Registry
#
# PURPOSE:
#   Provides a private Docker image registry.  The GitHub Actions
#   workflow pushes backend and frontend images here after every
#   successful build.  AKS pulls images from this registry using
#   the AcrPull role assignment created in the AKS module.
#
# SKU CHOICE — Basic:
#   Sufficient for a small-to-medium project:
#     • 10 GB included storage
#     • 2 concurrent builds
#     • No geo-replication (add Standard/Premium for multi-region HA)
#
# NAMING:
#   ACR names must be globally unique, alphanumeric, 5-50 characters.
#   We strip hyphens and append a random 5-char suffix to avoid
#   collisions across subscriptions.
# ============================================================

# Generates a 5-character random lowercase alphanumeric suffix.
# The suffix is stable after the first `apply` (stored in state),
# so the ACR name never changes between runs.
resource "random_string" "suffix" {
  length  = 5
  special = false
  upper   = false
}

# The ACR instance.
#   admin_enabled = false  — admin credentials are disabled; authentication
#                           uses RBAC (AcrPull / AcrPush roles) instead of
#                           a shared username/password.  This is the
#                           security best practice for production use.
resource "azurerm_container_registry" "this" {
  name                = substr(replace("${var.project_name}${var.environment}${random_string.suffix.result}", "-", ""), 0, 50)
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "Basic"
  admin_enabled       = false # RBAC-only access; admin credentials disabled
  tags                = var.tags
}
