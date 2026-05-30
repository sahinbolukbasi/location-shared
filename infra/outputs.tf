# ============================================================
# outputs.tf — Root-module outputs.
#
# These values are read by the GitHub Actions deployment workflow
# immediately after `terraform apply` using `terraform output -raw`.
# They are used to:
#   • tag and push Docker images to the correct ACR login server;
#   • run `az aks get-credentials` to configure kubectl;
#   • construct the DATABASE_URL for the Kubernetes secret;
#   • reference the resource group when performing az CLI operations.
#
# To view all outputs locally:
#   terraform output
# ============================================================

# Name of the resource group that holds all application resources.
# Used by the workflow to scope `az acr login` and `az aks get-credentials`.
output "resource_group_name" {
  description = "Name of the application resource group."
  value       = azurerm_resource_group.main.name
}

# Name of the AKS cluster (e.g. "aks-locationshared-dev").
# Used by the workflow: az aks get-credentials --name <value> ...
output "aks_name" {
  description = "Name of the AKS cluster."
  value       = module.aks.cluster_name
}

# Short name of the ACR instance (includes the random suffix, e.g. "locationshareddevabcde").
# Used by the workflow to authenticate: az acr login --name <value>
output "acr_name" {
  description = "Name of the Azure Container Registry (includes random suffix)."
  value       = module.acr.acr_name
}

# Fully-qualified login server hostname for the ACR
# (e.g. "locationshareddevabcde.azurecr.io").
# Used as the Docker image registry host when tagging and pushing images
# and as the prefix injected into Kubernetes manifests via `sed`.
output "acr_login_server" {
  description = "Login server FQDN for the ACR (used as Docker registry host)."
  value       = module.acr.acr_login_server
}

# FQDN of the PostgreSQL Flexible Server
# (e.g. "pg-locationshared-dev.postgres.database.azure.com").
# Used to construct DATABASE_URL in the `app-secrets` Kubernetes Secret:
#   postgresql+psycopg://<user>:<password>@<fqdn>:5432/location_shared
output "postgres_fqdn" {
  description = "Fully-qualified domain name of the PostgreSQL Flexible Server."
  value       = module.postgres.server_fqdn
}

# Key Vault name — referenced when manually syncing secrets between
# Key Vault and GitHub Secrets / Kubernetes Secrets.
output "keyvault_name" {
  description = "Name of the Key Vault instance."
  value       = module.keyvault.keyvault_name
}

output "finops_namespace" {
  description = "Namespace used for Helm-managed FinOps add-ons."
  value       = var.finops_namespace
}

output "opencost_enabled" {
  description = "Whether OpenCost Helm deployment is enabled."
  value       = var.enable_platform_helm && var.enable_opencost
}
