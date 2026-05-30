# ============================================================
# modules/postgres/variables.tf
# ============================================================
# Input variables for the PostgreSQL Flexible Server module.
#
# IMPORTANT — admin_password:
#   Marked sensitive=true so Terraform never prints the value in
#   plan or apply output.  It is supplied at runtime only:
#     • In CI: via -var=postgres_admin_password=${{ secrets.POSTGRES_ADMIN_PASSWORD_* }}
#     • Locally: via TF_VAR_postgres_admin_password environment variable
#   Never hardcode a password in any .tfvars file.
#
# IMPORTANT — location:
#   Intentionally receives var.postgres_location from the root module
#   (northeurope), NOT var.location (westeurope).  PostgreSQL Flexible
#   Server is not available on Azure Startup Credits in westeurope.
#   See infra/variables.tf for the full explanation.
# ============================================================

variable "project_name" {
  type        = string
  description = "Project short name used as a prefix in the server resource name."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev or prod)."
}

variable "location" {
  type        = string
  description = "Azure region for the PostgreSQL Flexible Server. Passed from the root module via var.postgres_location."
}

variable "resource_group_name" {
  type        = string
  description = "Name of the resource group in which the PostgreSQL server is created."
}

variable "admin_username" {
  type        = string
  description = "Administrator login name for the PostgreSQL Flexible Server."
}

variable "admin_password" {
  type        = string
  sensitive   = true
  description = "Administrator password for the PostgreSQL Flexible Server. Must be passed at runtime and never stored in source control."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Resource tags to apply to the PostgreSQL server and database."
}
