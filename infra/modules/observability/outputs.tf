# ============================================================
# modules/observability/outputs.tf
# ============================================================
# Values exported from the observability module.
#
# log_analytics_workspace_id
#   Consumed by module.aks (oms_agent addon) so container logs
#   are streamed to the correct workspace automatically.
#
# application_insights_connection_string
#   Marked sensitive=true — Terraform will not print it in plan/apply
#   output. If it needs to reach a pod, inject via a Kubernetes secret
#   (e.g. add it to the kubectl secret upsert step in the CI workflow).
# ============================================================

output "log_analytics_workspace_id" {
  description = "Resource ID of the Log Analytics workspace (passed to the AKS OMS agent addon)."
  value       = azurerm_log_analytics_workspace.this.id
}

output "application_insights_connection_string" {
  description = "Application Insights connection string. Marked sensitive — inject via Kubernetes secret."
  value       = azurerm_application_insights.this.connection_string
  sensitive   = true
}
