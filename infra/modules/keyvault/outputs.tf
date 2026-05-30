# ============================================================
# modules/keyvault/outputs.tf
# ============================================================
# Values exported from the Key Vault module.
#
# keyvault_id   — available for policy assignments and diagnostics
# keyvault_name — available for `az keyvault secret set` commands
# keyvault_uri  — the HTTPS endpoint applications use to READ secrets
#                 format: https://<vault-name>.vault.azure.net/
#                 currently not piped into the app; secrets are loaded
#                 via kubectl Secrets directly (not via SDK at runtime).
# ============================================================

output "keyvault_id" {
  description = "Resource ID of the Key Vault instance."
  value       = azurerm_key_vault.this.id
}

output "keyvault_name" {
  description = "Name of the Key Vault instance."
  value       = azurerm_key_vault.this.name
}

output "keyvault_uri" {
  description = "Vault URI used to access Key Vault secrets and keys."
  value       = azurerm_key_vault.this.vault_uri
}
