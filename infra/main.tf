# ============================================================
# main.tf — Root Terraform module.
#
# This file is the entry point for all Azure resource provisioning.
# It defines shared locals, creates the main resource group, and
# calls five child modules that each own a distinct concern:
#
#   acr          → Azure Container Registry (image storage)
#   observability → Log Analytics + Application Insights
#   keyvault     → Key Vault (application secret store)
#   postgres     → PostgreSQL Flexible Server + database
#   aks          → AKS cluster + node pools + ACR pull RBAC
#
# DEPENDENCY ORDER (implicit, Terraform resolves automatically):
#   resource_group → acr, observability, keyvault, postgres
#   acr + observability → aks
#
# HOW TO APPLY:
#   terraform init -backend-config="key=dev.terraform.tfstate"
#   terraform apply -var-file=environments/dev.tfvars
# ============================================================

locals {
  # name_prefix is prepended to every resource name so that
  # resources from different environments (dev / prod) can
  # coexist in the same subscription without name collisions.
  # Example: "locationshared-dev", "locationshared-prod"
  name_prefix = "${var.project_name}-${var.environment}"

  # common_tags are merged onto every resource to enable cost
  # attribution, filtering in the Azure portal, and compliance
  # scanning.  Consumers can add extra tags via var.tags.
  common_tags = merge(var.tags, {
    project     = var.project_name
    environment = var.environment
    managed-by  = "terraform"
  })
}

# ── Resource Group ────────────────────────────────────────────
# All application resources live in a single resource group per
# environment (e.g. rg-locationshared-dev).  This simplifies
# access control (one IAM scope), cost reporting, and teardown
# (`terraform destroy` removes everything at once).
#
# NOTE: The PostgreSQL state backend resource group
# (rg-locationshared-tfstate) is NOT managed here — it is
# provisioned once manually so that Terraform state is never
# inside a group that Terraform itself could accidentally delete.
resource "azurerm_resource_group" "main" {
  name     = "rg-${local.name_prefix}"
  location = var.location
  tags     = local.common_tags
}

# ── ACR module ───────────────────────────────────────────────
# Provisions the Azure Container Registry where backend and
# frontend Docker images are pushed by GitHub Actions and pulled
# by AKS pods.  The AKS module receives acr_id from this module
# to create the AcrPull role assignment.
module "acr" {
  source              = "./modules/acr"
  project_name        = var.project_name
  environment         = var.environment
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# ── Observability module ──────────────────────────────────────
# Provisions Log Analytics Workspace and Application Insights.
# AKS sends container logs to Log Analytics via its OMS agent.
# The backend can also send traces/metrics to Application Insights
# using the APPINSIGHTS_INSTRUMENTATIONKEY secret.
module "observability" {
  source              = "./modules/observability"
  project_name        = var.project_name
  environment         = var.environment
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# ── Key Vault module ──────────────────────────────────────────
# Provisions an Azure Key Vault for storing application secrets
# (e.g. Stripe keys, Google OAuth credentials, JWT secret).
# Kubernetes pods do NOT read from Key Vault directly at runtime;
# instead, GitHub Actions reads secrets from GitHub Secrets and
# injects them into the Kubernetes `app-secrets` Secret object
# during each deployment run.  Key Vault remains the canonical
# store for human-managed secrets that feed GitHub Secrets.
module "keyvault" {
  source              = "./modules/keyvault"
  project_name        = var.project_name
  environment         = var.environment
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# ── PostgreSQL module ─────────────────────────────────────────
# Provisions PostgreSQL 16 Flexible Server and the application
# database.
#
# WHY postgres_location ≠ location?
#   The Startup Credit subscription has a quota restriction that
#   prevents provisioning PostgreSQL Flexible Server in
#   westeurope. northeurope is quota-available and sufficiently
#   close in latency.  All other resources stay in westeurope.
#   The variable is kept separate (var.postgres_location) to make
#   this intentional divergence explicit and easy to change.
module "postgres" {
  source              = "./modules/postgres"
  project_name        = var.project_name
  environment         = var.environment
  location            = var.postgres_location # ← intentionally different from var.location
  resource_group_name = azurerm_resource_group.main.name
  admin_username      = var.postgres_admin_username
  admin_password      = var.postgres_admin_password
  tags                = local.common_tags
}

# ── AKS module ────────────────────────────────────────────────
# Provisions the AKS cluster, a dedicated user node pool, and
# grants the cluster's kubelet identity AcrPull access so pods
# can pull images from ACR without any stored credentials.
#
# acr_id                     → used to scope the AcrPull role assignment
# log_analytics_workspace_id → wired into the OMS agent add-on so
#                              Kubernetes logs/metrics flow to Azure Monitor
module "aks" {
  source                     = "./modules/aks"
  project_name               = var.project_name
  environment                = var.environment
  location                   = var.location
  resource_group_name        = azurerm_resource_group.main.name
  node_count                 = var.aks_node_count
  node_vm_size               = var.aks_node_vm_size
  acr_id                     = module.acr.acr_id
  log_analytics_workspace_id = module.observability.log_analytics_workspace_id
  tags                       = local.common_tags
}
