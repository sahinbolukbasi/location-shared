# ============================================================
# modules/acr/outputs.tf
# ============================================================
# Values exported from the ACR module.
#
# Consumption map:
#   acr_id           → module.aks (used in the AcrPull role assignment scope)
#   acr_name         → root outputs.tf → CI/CD: az acr login --name
#   acr_login_server → root outputs.tf → CI/CD: image tag prefix
#                      e.g. <acr_login_server>/location-shared-backend:<sha>
# ============================================================

output "acr_id" {
  description = "Resource ID of the Azure Container Registry."
  value       = azurerm_container_registry.this.id
}

output "acr_name" {
  description = "Name of the Azure Container Registry (includes random suffix)."
  value       = azurerm_container_registry.this.name
}

output "acr_login_server" {
  description = "Login server FQDN for the ACR, used as the Docker registry host in image references."
  value       = azurerm_container_registry.this.login_server
}
