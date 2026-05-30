# ============================================================
# variables.tf — Input variable declarations for the root module.
#
# Values are supplied at plan/apply time via environment-specific
# .tfvars files:
#   environments/dev.tfvars   (used by deploy-dev.yml)
#   environments/prod.tfvars  (used by deploy-prod.yml)
#
# Sensitive variables (postgres_admin_password) are passed at
# runtime from GitHub Actions secrets — they are never committed
# to the repository and must NOT be given default values here.
# ============================================================

# ── Identity & Naming ─────────────────────────────────────────

# Short name that becomes the prefix for every Azure resource name.
# Kept lowercase and without special characters because it feeds into
# names that have global-uniqueness requirements (ACR, Key Vault).
variable "project_name" {
  type        = string
  description = "Project short name used as a prefix in all resource names (e.g. 'locationshared')."
}

# Selects the deployment target.  Validated to prevent typos from
# creating unintended environments.  Feeds into resource names and
# the Terraform state file key.
variable "environment" {
  type        = string
  description = "Deployment environment. Must be 'dev' or 'prod'."

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be 'dev' or 'prod'."
  }
}

# ── Regions ───────────────────────────────────────────────────

# Primary Azure region for all resources except PostgreSQL.
# westeurope is the closest region with sufficient AKS / ACR
# quota on the current subscription.
variable "location" {
  type        = string
  description = "Primary Azure region for most resources (e.g. 'westeurope')."
  default     = "westeurope"
}

# PostgreSQL is placed in a separate region because westeurope
# PostgreSQL Flexible Server is quota-restricted on the Startup
# Credit subscription. northeurope is quota-available.
# Having a dedicated variable makes the intentional divergence
# explicit and easy to update when the quota restriction is lifted.
variable "postgres_location" {
  type        = string
  description = "Azure region for the PostgreSQL Flexible Server. Defaults to 'northeurope' because westeurope is offer-restricted on the Startup Credit subscription."
  default     = "northeurope"
}

# ── AKS Node Pool ─────────────────────────────────────────────

# Number of nodes in the *user* node pool (workload pods).
# The system node pool always runs exactly 1 node (D2s_v5) to
# host Kubernetes system components only.
# dev=2, prod=3 (see environments/*.tfvars).
variable "aks_node_count" {
  type        = number
  description = "Number of nodes in the AKS user node pool."
  default     = 2
}

# VM SKU for user nodes. D4s_v5 provides 4 vCPU / 16 GB RAM,
# sufficient for the backend + frontend pods plus the HPA headroom.
variable "aks_node_vm_size" {
  type        = string
  description = "VM SKU for the AKS user node pool (e.g. 'Standard_D4s_v5')."
  default     = "Standard_D4s_v5"
}

# ── PostgreSQL ────────────────────────────────────────────────

# The admin login for the PostgreSQL server.
# Not sensitive, but kept as a variable to allow per-environment
# overrides without touching the module source.
variable "postgres_admin_username" {
  type        = string
  description = "Administrator login for the PostgreSQL Flexible Server."
}

# SENSITIVE — never set a default here.
# Passed at runtime by GitHub Actions from the repository secret
# POSTGRES_ADMIN_PASSWORD (deploy-dev.yml) / POSTGRES_ADMIN_PASSWORD (deploy-prod.yml).
# Running `terraform plan` locally requires exporting:
#   export TF_VAR_postgres_admin_password=<value>
variable "postgres_admin_password" {
  type        = string
  description = "Administrator password for the PostgreSQL Flexible Server. Passed at runtime — never committed."
  sensitive   = true
}

# ── Tags ──────────────────────────────────────────────────────

# Additional key/value tags merged with the common tags block in
# main.tf.  Useful for adding team-specific labels (e.g. cost centre)
# without modifying the core tagging strategy.
variable "tags" {
  type        = map(string)
  description = "Additional resource tags merged with the common tags applied to every resource."
  default     = {}
}

variable "enable_platform_helm" {
  type        = bool
  description = "Enable Helm-managed platform add-ons on AKS (FinOps/observability stack)."
  default     = true
}

variable "finops_namespace" {
  type        = string
  description = "Namespace where FinOps charts (OpenCost/KubeCost compatible stack) are deployed."
  default     = "finops"
}

variable "enable_opencost" {
  type        = bool
  description = "Enable OpenCost Helm release for Kubernetes cost visibility."
  default     = true
}

variable "opencost_chart_version" {
  type        = string
  description = "OpenCost Helm chart version pin for reproducible deployments."
  default     = "2.5.22"
}
