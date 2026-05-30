# ============================================================
# modules/acr/variables.tf
# ============================================================
# Input variables for the ACR module.
# The caller (infra/main.tf) passes all values explicitly.
# No variable in this module has a default — every value is
# required so accidental partial configurations fail fast.
# ============================================================

variable "project_name" {
  type        = string
  description = "Project short name used as a prefix in the registry resource name."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev or prod)."
}

variable "location" {
  type        = string
  description = "Azure region in which the Container Registry is created."
}

variable "resource_group_name" {
  type        = string
  description = "Name of the resource group in which the Container Registry is created."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Resource tags to apply to the Container Registry."
}
