project_name            = "locationshared"
environment             = "dev"
location                = "westeurope"
postgres_location       = "northeurope"
aks_node_count          = 1
aks_node_vm_size        = "Standard_D4s_v5"
postgres_admin_username = "pgadminuser"
postgres_admin_password = "CHANGE_ME_DEV"
tags = {
  owner = "location-shared"
}
enable_platform_helm = true
enable_opencost      = true
finops_namespace     = "finops"
