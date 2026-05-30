# ============================================================
# modules/keyvault/main.tf — Azure Key Vault
#
# PURPOSE:
#   Canonical store for all application secrets (JWT secret key,
#   Google OAuth client ID/secret, Stripe API keys, database
#   password, etc.).
#
# SECRET FLOW:
#   Operator stores secrets in Key Vault
#     └─► Operator copies values into GitHub Actions repository secrets
#           └─► GitHub Actions workflow reads secrets at deploy time
#                 └─► Workflow writes `kubectl create secret` → K8s `app-secrets`
#                       └─► Backend pods mount app-secrets as env vars
#
#   Pods do NOT read directly from Key Vault at runtime.  This keeps
#   the runtime path simple (no managed identity on pods required for
#   MVP) while Key Vault remains the source of truth for humans.
#
# SKU — Standard:
#   Supports secrets, keys, and certificates.  Premium adds HSM-backed
#   keys; not required for this application.
#
# NAMING CONSTRAINT:
#   Key Vault names: 3-24 characters, alphanumeric + hyphens only,
#   globally unique.  We strip hyphens and truncate to 24 chars.
#
# SOFT DELETE:
#   7-day retention with purge_protection_enabled = false allows
#   a hard delete via the portal/CLI during development iterations.
#   Enable purge_protection for production compliance requirements.
# ============================================================

# Look up the current caller's object_id so we can grant the
# deploying principal (GitHub Actions OIDC service principal) full
# secret access.  Without this, Terraform cannot set secrets even
# if it created the vault.
data "azurerm_client_config" "current" {}

# The Key Vault instance.
resource "azurerm_key_vault" "this" {
  name                       = substr(replace("kv-${var.project_name}-${var.environment}", "-", ""), 0, 24)
  location                   = var.location
  resource_group_name        = var.resource_group_name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7     # minimum; increase for stricter environments
  purge_protection_enabled   = false # set true if CMDB/compliance requires it
  tags                       = var.tags
}

# Access policy for the deploying principal (GitHub Actions OIDC app).
# Grants all secret lifecycle operations so that CI/CD can read, write,
# and rotate secrets programmatically via `az keyvault secret set`.
# Role-based access (RBAC) is an alternative; access policies are used
# here for simpler setup.
resource "azurerm_key_vault_access_policy" "current" {
  key_vault_id = azurerm_key_vault.this.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azurerm_client_config.current.object_id # GitHub Actions OIDC SP

  secret_permissions = [
    "Get",
    "List",
    "Set",
    "Delete",
    "Purge",
    "Recover"
  ]
}
