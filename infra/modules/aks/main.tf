# ============================================================
# modules/aks/main.tf — Azure Kubernetes Service cluster
#
# PURPOSE:
#   Provisions the Kubernetes cluster that runs the backend and
#   frontend application pods, along with the required RBAC to
#   pull images from ACR without stored credentials.
#
# NODE POOL ARCHITECTURE (two pools):
#
#   "system" pool (1× Standard_D2s_v5, AzureLinux):
#     Hosts only Kubernetes system components (kube-system pods,
#     CoreDNS, metrics-server, etc.).
#     only_critical_addons_enabled = true enforces this — no
#     application workloads are scheduled here.
#     Kept at 1 node to minimise cost; not auto-scaled because
#     system component count is stable.
#
#   "user" pool (var.node_count × var.node_vm_size, AzureLinux):
#     Hosts all application Deployments (backend, frontend) and
#     their associated HPA-managed replicas.
#     Sized via tfvars: dev=2×D4s_v5, prod=3×D4s_v5.
#     Separation from the system pool ensures workload pods cannot
#     consume all resources and starve kube-system.
#
# SKU TIER — Free:
#   No SLA on the control plane.  Upgrade to "Standard" for a
#   99.5% control-plane uptime SLA in production.
#
# IDENTITY — SystemAssigned:
#   AKS manages its own service principal automatically.
#   The kubelet_identity (separate from the control-plane identity)
#   is used for the AcrPull role assignment below.
#
# NETWORK PROFILE — Azure CNI with Azure Network Policy:
#   Pods receive real VNet IPs (not overlay).  Azure Network Policy
#   enables Kubernetes NetworkPolicy objects enforced by the CNI.
#
# OIDC + WORKLOAD IDENTITY:
#   Enabled for future use — allows pods to authenticate to Azure
#   services (e.g. Key Vault) via service account tokens without
#   storing credentials.  Not actively used in MVP but costs nothing
#   to enable.
# ============================================================

# AKS cluster with system node pool.
resource "azurerm_kubernetes_cluster" "this" {
  name                = "aks-${var.project_name}-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = "${var.project_name}-${var.environment}"
  sku_tier            = "Free" # no control-plane SLA; upgrade to "Standard" for production SLA

  # ── System node pool ─────────────────────────────────────
  # Dedicated to Kubernetes system components only.
  # Application pods are scheduled on the separate "user" pool below.
  default_node_pool {
    name                         = "system"
    node_count                   = 1                 # fixed; system components don't need scaling
    vm_size                      = "Standard_D2s_v5" # 2 vCPU / 8 GB; sufficient for system pods
    os_disk_type                 = "Managed"
    os_sku                       = "AzureLinux" # lightweight, Azure-optimised OS
    only_critical_addons_enabled = true         # prevents user workloads on this pool
  }

  # SystemAssigned identity for the cluster control plane.
  # AKS uses this to manage load balancers, disks, and VNet resources.
  identity {
    type = "SystemAssigned"
  }

  # OMS agent — sends container stdout/stderr and Kubernetes events
  # to the Log Analytics Workspace provisioned by the observability module.
  oms_agent {
    log_analytics_workspace_id = var.log_analytics_workspace_id
  }

  # Azure CNI: pods get real VNet IP addresses.
  # azure network_policy enables enforcement of K8s NetworkPolicy objects.
  network_profile {
    network_plugin = "azure"
    network_policy = "azure"
  }

  # OIDC issuer + workload identity: enables pods to authenticate to
  # Azure AD via projected service account tokens (future use).
  workload_identity_enabled = true
  oidc_issuer_enabled       = true

  # local_account_disabled = false keeps the admin kubeconfig available,
  # which is needed for `az aks get-credentials --admin` in CI/CD.
  # Set to true and use Azure AD integration for stricter access control.
  local_account_disabled = false

  tags = var.tags

  # Azure automatically adds upgrade_settings to the default node pool and
  # monitor_metrics to the cluster after creation. Ignoring these prevents
  # spurious in-place updates that would conflict with ongoing start/stop
  # cluster operations (HTTP 409 OperationNotAllowed).
  lifecycle {
    ignore_changes = [
      default_node_pool[0].upgrade_settings,
      monitor_metrics,
    ]
  }
}

# ── User node pool ────────────────────────────────────────────
# All application workloads (backend, frontend Deployments) run here.
# Sized via variables; HPA can add replicas up to node capacity.
resource "azurerm_kubernetes_cluster_node_pool" "user" {
  name                  = "user"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.this.id
  node_count            = var.node_count   # dev=2, prod=3 (from tfvars)
  vm_size               = var.node_vm_size # Standard_D4s_v5: 4 vCPU / 16 GB
  os_disk_type          = "Managed"
  os_sku                = "AzureLinux"
  mode                  = "User" # marks pool as application workload pool
  tags                  = var.tags

  # upgrade_settings: Azure appends this automatically — ignore to prevent
  # redundant PATCH calls during cluster start/stop operations.
  # node_count: managed via az CLI (scale up/down for cost savings);
  # Terraform should not reconcile it on every apply.
  lifecycle {
    ignore_changes = [
      upgrade_settings,
      node_count,
    ]
  }
}

# ── AcrPull role assignment ───────────────────────────────────
# Grants the AKS kubelet identity (the identity used by nodes to
# pull images) the built-in AcrPull role on the ACR resource.
# This means no imagePullSecrets are needed in Kubernetes manifests;
# nodes authenticate to ACR automatically using their managed identity.
resource "azurerm_role_assignment" "acr_pull" {
  scope                = var.acr_id # ACR resource ID
  role_definition_name = "AcrPull"
  principal_id         = azurerm_kubernetes_cluster.this.kubelet_identity[0].object_id
}
