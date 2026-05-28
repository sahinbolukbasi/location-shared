locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = merge(var.tags, {
    project     = var.project_name
    environment = var.environment
    managed-by  = "terraform"
  })
}

resource "azurerm_resource_group" "main" {
  name     = "rg-${local.name_prefix}"
  location = var.location
  tags     = local.common_tags
}

module "acr" {
  source              = "./modules/acr"
  project_name        = var.project_name
  environment         = var.environment
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

module "observability" {
  source              = "./modules/observability"
  project_name        = var.project_name
  environment         = var.environment
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

module "keyvault" {
  source              = "./modules/keyvault"
  project_name        = var.project_name
  environment         = var.environment
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

module "postgres" {
  source                  = "./modules/postgres"
  project_name            = var.project_name
  environment             = var.environment
  location                = var.location
  resource_group_name     = azurerm_resource_group.main.name
  admin_username          = var.postgres_admin_username
  admin_password          = var.postgres_admin_password
  tags                    = local.common_tags
}

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
