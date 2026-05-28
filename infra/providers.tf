terraform {
  required_version = ">= 1.7.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.114"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "azurerm" {
    resource_group_name  = "rg-locationshared-tfstate"
    storage_account_name = "stlcsharedtfstate"
    container_name       = "tfstate"
    # key is passed at init time via -backend-config="key=<env>.terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}
