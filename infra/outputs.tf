output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "aks_name" {
  value = module.aks.cluster_name
}

output "acr_name" {
  value = module.acr.acr_name
}

output "acr_login_server" {
  value = module.acr.acr_login_server
}

output "postgres_fqdn" {
  value = module.postgres.server_fqdn
}

output "keyvault_name" {
  value = module.keyvault.keyvault_name
}
