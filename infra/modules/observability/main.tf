# ============================================================
# modules/observability/main.tf — Log Analytics + Application Insights
#
# PURPOSE:
#   Centralises all telemetry for the application and the AKS cluster.
#
# HOW DATA FLOWS:
#   AKS cluster (OMS agent)
#     └─► Log Analytics Workspace  — container logs, node metrics,
#                                    Kubernetes events
#   Backend application (optional SDK)
#     └─► Application Insights     — request traces, exceptions,
#                                    dependency calls, custom metrics
#
# Log Analytics Workspace:
#   SKU "PerGB2018" — pay-per-GB ingestion; 30-day retention keeps
#   operational cost low while providing enough history for incident
#   investigation.  Increase retention for compliance requirements.
#
# Application Insights:
#   Workspace-based mode (workspace_id set) — the modern approach
#   that stores all data in the Log Analytics Workspace, enabling
#   cross-service KQL queries in a single place.
#   application_type = "web" covers both the REST API and any
#   browser-side instrumentation.
# ============================================================

# Log Analytics Workspace — receives all AKS container logs and
# Kubernetes metrics via the OMS agent configured in the AKS module.
resource "azurerm_log_analytics_workspace" "this" {
  name                = "law-${var.project_name}-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018" # pay-per-GB; most cost-effective for variable log volume
  retention_in_days   = 30          # 30 days free tier; increase for audit/compliance needs
  tags                = var.tags
}

# Application Insights — linked to the Log Analytics Workspace above
# (workspace-based mode).  The instrumentation key / connection string
# can be added to the Kubernetes `app-secrets` Secret so the backend
# sends traces automatically.
resource "azurerm_application_insights" "this" {
  name                = "appi-${var.project_name}-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  workspace_id        = azurerm_log_analytics_workspace.this.id # workspace-based (modern) mode
  application_type    = "web"
  tags                = var.tags
}
