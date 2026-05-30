# ============================================================
# modules/aks/variables.tf
# ============================================================
# Input variables for the AKS module.
#
# Two variables create cross-module dependencies and must be
# read carefully:
#   acr_id                    — wired from module.acr.acr_id so that
#                               the AcrPull role assignment is scoped
#                               to the exact registry Terraform created.
#   log_analytics_workspace_id — wired from module.observability so that
#                               the OMS agent addon on the cluster ships
#                               container logs to the correct workspace.
# ============================================================

variable "project_name" {
  type        = string
  description = "Project short name used as a prefix in the cluster resource name."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev or prod)."
}

variable "location" {
  type        = string
  description = "Azure region in which the AKS cluster is created."
}

variable "resource_group_name" {
  type        = string
  description = "Name of the resource group in which the AKS cluster is created."
}

variable "node_count" {
  type        = number
  description = "Number of nodes in the user node pool."
}

variable "node_vm_size" {
  type        = string
  description = "VM SKU for the user node pool (e.g. 'Standard_D4s_v5')."
}

variable "acr_id" {
  type        = string
  description = "Resource ID of the ACR instance. Used to assign the AcrPull role to the kubelet identity."
}

variable "log_analytics_workspace_id" {
  type        = string
  description = "Resource ID of the Log Analytics workspace used for the OMS agent addon."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Resource tags to apply to the AKS cluster."
}
