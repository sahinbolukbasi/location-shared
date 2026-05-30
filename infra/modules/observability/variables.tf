# ============================================================
# modules/observability/variables.tf
# ============================================================
# Input variables for the Log Analytics + Application Insights module.
#
# All five variables are required — no defaults.
# The module creates two tightly-coupled resources:
#   1. Log Analytics Workspace  (law-<project_name>-<environment>)
#   2. Application Insights     (appi-<project_name>-<environment>)
# App Insights is workspace-based, meaning all telemetry is stored in
# the same LAW, enabling unified KQL queries across infrastructure
# logs (AKS OMS agent) and application traces (App Insights SDK).
# ============================================================

variable "project_name" {
  type        = string
  description = "Project short name used as a prefix in observability resource names."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev or prod)."
}

variable "location" {
  type        = string
  description = "Azure region in which Log Analytics and Application Insights are created."
}

variable "resource_group_name" {
  type        = string
  description = "Name of the resource group in which observability resources are created."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Resource tags to apply to all observability resources."
}
