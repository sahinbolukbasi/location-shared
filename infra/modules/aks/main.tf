resource "azurerm_kubernetes_cluster" "this" {
  name                = "aks-${var.project_name}-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = "${var.project_name}-${var.environment}"
  sku_tier            = "Standard"

  default_node_pool {
    name                         = "system"
    node_count                   = 1
    vm_size                      = "Standard_D2s_v5"
    os_disk_type                 = "Ephemeral"
    os_sku                       = "AzureLinux"
    only_critical_addons_enabled = true
  }

  identity {
    type = "SystemAssigned"
  }

  oms_agent {
    log_analytics_workspace_id = var.log_analytics_workspace_id
  }

  network_profile {
    network_plugin = "azure"
    network_policy = "azure"
  }

  workload_identity_enabled = true
  oidc_issuer_enabled       = true
  local_account_disabled    = true

  tags = var.tags
}

resource "azurerm_kubernetes_cluster_node_pool" "user" {
  name                  = "user"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.this.id
  node_count            = var.node_count
  vm_size               = var.node_vm_size
  os_disk_type          = "Ephemeral"
  os_sku                = "AzureLinux"
  mode                  = "User"
  tags                  = var.tags
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = var.acr_id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_kubernetes_cluster.this.kubelet_identity[0].object_id
}
