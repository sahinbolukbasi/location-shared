# ============================================================
# modules/postgres/outputs.tf
# ============================================================
# Values exported from the PostgreSQL module.
#
# server_fqdn
#   Consumed by root outputs.tf → CI/CD workflow, which assembles:
#     DATABASE_URL = "postgresql+psycopg://<user>:<pass>@<fqdn>:5432/location_shared"
#   This URL is then stored in the Kubernetes Secret 'app-secrets'
#   and mounted into every backend pod as an environment variable.
#
# database_name
#   Always "location_shared".  Exposed as an output so callers do
#   not need to hardcode the database name when constructing URLs.
# ============================================================

output "server_fqdn" {
  description = "Fully-qualified domain name of the PostgreSQL Flexible Server (used in DATABASE_URL)."
  value       = azurerm_postgresql_flexible_server.this.fqdn
}

output "database_name" {
  description = "Name of the application database created on the server."
  value       = azurerm_postgresql_flexible_server_database.app.name
}
