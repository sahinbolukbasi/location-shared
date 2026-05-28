project_name             = "locationshared"
environment              = "prod"
location                 = "westeurope"
aks_node_count           = 3
aks_node_vm_size         = "Standard_D4s_v5"
postgres_admin_username  = "pgadminuser"
postgres_admin_password  = "CHANGE_ME_PROD"
tags = {
  owner = "location-shared"
}
