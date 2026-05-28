resource "random_string" "suffix" {
  length  = 5
  special = false
  upper   = false
}

resource "azurerm_container_registry" "this" {
  name                = substr(replace("${var.project_name}${var.environment}${random_string.suffix.result}", "-", ""), 0, 50)
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "Basic"
  admin_enabled       = false
  tags                = var.tags
}
