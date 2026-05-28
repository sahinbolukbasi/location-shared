resource "azurerm_postgresql_flexible_server" "this" {
  name                   = "pg-${var.project_name}-${var.environment}"
  resource_group_name    = var.resource_group_name
  location               = "northeurope"
  version                = "16"
  delegated_subnet_id    = null
  private_dns_zone_id    = null
  administrator_login    = var.admin_username
  administrator_password = var.admin_password
  storage_mb             = 32768
  sku_name               = "B_Standard_B1ms"
  tags                   = var.tags

  lifecycle {
    # Azure assigns an availability zone at creation; it cannot be changed
    # without enabling HA. Ignore drift so apply never tries to update it.
    ignore_changes = [zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = "location_shared"
  server_id = azurerm_postgresql_flexible_server.this.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.this.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}
