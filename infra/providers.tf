# ============================================================
# providers.tf — Terraform version constraints, provider
# declarations, and remote state backend configuration.
#
# WHY A REMOTE BACKEND?
#   Terraform state tracks which real Azure resources exist.
#   Storing state in Azure Blob Storage instead of locally:
#     • allows multiple engineers / CI runs to share the same
#       state without conflicts (state locking via blob leases);
#     • prevents accidental deletion of the local .tfstate file;
#     • enables GitHub Actions to run Terraform without checking
#       the state file into version control.
#
# BACKEND RESOURCES (created once, outside this Terraform root):
#   Resource Group : rg-locationshared-tfstate
#   Storage Account: stlcsharedtfstate
#   Container      : tfstate
#   Blob key       : passed at `terraform init` time via
#                    -backend-config="key=dev.terraform.tfstate"
#                    (see deploy-dev.yml / deploy-prod.yml)
# ============================================================

terraform {
  # Minimum Terraform version required. 1.7.x introduced several
  # quality-of-life improvements used across this root module.
  required_version = ">= 1.7.0"

  required_providers {
    # azurerm — the official HashiCorp provider for Azure Resource Manager.
    # ~> 3.114 allows patch upgrades (3.114.x) but not major/minor bumps,
    # keeping behaviour stable while allowing security patches.
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.114"
    }

    # random — used in the ACR module to append a unique 5-character suffix
    # to the registry name, satisfying the global-uniqueness requirement.
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }

    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }

    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.15"
    }
  }

  # Remote backend — Azure Blob Storage.
  # The `key` argument is intentionally omitted here so that
  # each environment (dev / prod) supplies its own state file name
  # at `terraform init` time:
  #   terraform init -backend-config="key=dev.terraform.tfstate"
  # This keeps dev and prod state completely isolated in the same
  # storage container without requiring separate backends.
  backend "azurerm" {
    resource_group_name  = "rg-locationshared-tfstate"
    storage_account_name = "stlcsharedtfstate"
    container_name       = "tfstate"
    # key is passed at init time via -backend-config="key=<env>.terraform.tfstate"
  }
}

# azurerm provider configuration.
# Authentication is performed via GitHub Actions OIDC (federated identity) —
# no client secret is stored. The provider reads ARM_CLIENT_ID,
# ARM_TENANT_ID, ARM_SUBSCRIPTION_ID, and ARM_USE_OIDC from the
# environment, which the GitHub Actions workflow sets before running
# Terraform commands.
# features {} is required even when empty; it enables the default
# behaviour for all resource lifecycle features.
provider "azurerm" {
  features {}
}

provider "kubernetes" {
  host                   = module.aks.kube_host
  client_certificate     = base64decode(module.aks.kube_client_certificate)
  client_key             = base64decode(module.aks.kube_client_key)
  cluster_ca_certificate = base64decode(module.aks.kube_cluster_ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = module.aks.kube_host
    client_certificate     = base64decode(module.aks.kube_client_certificate)
    client_key             = base64decode(module.aks.kube_client_key)
    cluster_ca_certificate = base64decode(module.aks.kube_cluster_ca_certificate)
  }
}
