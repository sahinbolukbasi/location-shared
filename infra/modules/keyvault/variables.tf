# ============================================================
# modules/keyvault/variables.tf
# ============================================================
# Input variables for the Key Vault module.
#
# Key Vault names must be globally unique and 3-24 characters.
# The name is formed as: kv-<project_name>-<environment>
# If that exceeds 24 chars the plan will fail — keep project_name short.
#
# Note: there is no variable for the deployer object ID because the
# access policy in main.tf uses data.azurerm_client_config.current.object_id
# (the identity Terraform is running as — OIDC service principal in CI).
# ============================================================

variable "project_name" {
  type        = string
  description = "Project short name used as a prefix in the Key Vault resource name."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev or prod)."
}

variable "location" {
  type        = string
  description = "Azure region in which the Key Vault is created."
}

variable "resource_group_name" {
  type        = string
  description = "Name of the resource group in which the Key Vault is created."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Resource tags to apply to the Key Vault."
}
