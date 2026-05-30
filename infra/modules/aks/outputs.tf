# ============================================================
# modules/aks/outputs.tf
# ============================================================
# Values exported from the AKS module.
#
# Both outputs flow to root outputs.tf and are consumed by CI/CD:
#   cluster_name → az aks get-credentials --name <cluster_name>
#   cluster_id   → available for future resource dependencies
#                  (e.g. AKS-scoped policy assignments)
# ============================================================

output "cluster_name" {
  description = "Name of the AKS cluster."
  value       = azurerm_kubernetes_cluster.this.name
}

output "cluster_id" {
  description = "Resource ID of the AKS cluster."
  value       = azurerm_kubernetes_cluster.this.id
}

output "kube_host" {
  description = "Kubernetes API server endpoint for the AKS cluster."
  value       = azurerm_kubernetes_cluster.this.kube_config[0].host
}

output "kube_client_certificate" {
  description = "Base64-encoded client certificate from AKS kubeconfig."
  value       = azurerm_kubernetes_cluster.this.kube_config[0].client_certificate
  sensitive   = true
}

output "kube_client_key" {
  description = "Base64-encoded client key from AKS kubeconfig."
  value       = azurerm_kubernetes_cluster.this.kube_config[0].client_key
  sensitive   = true
}

output "kube_cluster_ca_certificate" {
  description = "Base64-encoded cluster CA certificate from AKS kubeconfig."
  value       = azurerm_kubernetes_cluster.this.kube_config[0].cluster_ca_certificate
  sensitive   = true
}
