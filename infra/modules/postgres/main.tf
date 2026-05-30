# ============================================================
# modules/postgres/main.tf — PostgreSQL 16 Flexible Server
#
# PURPOSE:
#   Provisions the relational database used by the FastAPI backend.
#   Contains three resources:
#     1. The server itself (azurerm_postgresql_flexible_server)
#     2. The application database (azurerm_postgresql_flexible_server_database)
#     3. A firewall rule that allows connections from Azure services
#
# REGION NOTE:
#   This module is deployed to var.location, which in the root module is
#   set to var.postgres_location (northeurope) rather than the primary
#   location (westeurope).  This is a quota restriction on the Startup
#   Credit subscription; see infra/main.tf and infra/variables.tf for
#   detailed explanation.
#
# SKU — B_Standard_B1ms (Burstable, 1 vCore, 2 GB RAM):
#   Lowest-cost Flexible Server tier; suitable for development and
#   low-traffic production.  Upgrade to General Purpose (D-series) when
#   sustained query load exceeds burstable baseline.
#
# STORAGE — 32 GB:
#   Minimum configurable size; auto-grow not enabled.  Monitor via
#   Azure Monitor "storage_percent" metric and resize manually.
#
# NETWORKING — Public access (no VNet delegation):
#   delegated_subnet_id = null → public endpoint is used.
#   The firewall rule below restricts access to Azure services only
#   (start/end 0.0.0.0 is the Azure "allow Azure services" sentinel).
#   For production, consider VNet injection with a private DNS zone.
#
# AVAILABILITY ZONE:
#   Azure assigns an AZ automatically at creation.  Because we do not
#   enable high-availability (which would allow zone selection), the
#   `zone` attribute drifts on every plan.  The lifecycle ignore_changes
#   suppresses this harmless drift.
# ============================================================

# PostgreSQL Flexible Server — the database engine.
resource "azurerm_postgresql_flexible_server" "this" {
  name                   = "pg-${var.project_name}-${var.environment}"
  resource_group_name    = var.resource_group_name
  location               = var.location # northeurope (see module call in main.tf)
  version                = "16"         # PostgreSQL major version
  delegated_subnet_id    = null         # null = public endpoint, not VNet-injected
  private_dns_zone_id    = null         # required null when not using private networking
  administrator_login    = var.admin_username
  administrator_password = var.admin_password # sensitive; supplied from GitHub Actions secret
  storage_mb             = 32768              # 32 GB — minimum; increase when data grows
  sku_name               = "B_Standard_B1ms"  # burstable 1vCore/2GB; cheap for dev + low traffic
  tags                   = var.tags

  lifecycle {
    # Azure assigns an availability zone at creation; it cannot be changed
    # without enabling HA. Ignore drift so `apply` never tries to update it.
    ignore_changes = [zone]
  }
}

# Application database — the schema that the FastAPI backend uses.
# charset UTF8 + en_US.utf8 collation are standard for web applications.
# The database name "location_shared" matches DATABASE_URL in all
# deployment environments.
resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = "location_shared" # matches DATABASE_URL in docker-compose + K8s secret
  server_id = azurerm_postgresql_flexible_server.this.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Firewall rule — allows Azure-internal services to reach the server.
# The sentinel value 0.0.0.0/0.0.0.0 is a special Azure rule meaning
# "allow traffic from all Azure IP ranges" (not the public internet).
# This is necessary for AKS pods (Azure-hosted) to reach PostgreSQL.
#
# PRODUCTION RECOMMENDATION: Replace with VNet injection + private
# DNS zone to restrict access to the AKS VNet only.
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.this.id
  start_ip_address = "0.0.0.0" # Azure "allow Azure services" sentinel — not public internet
  end_ip_address   = "0.0.0.0"
}
