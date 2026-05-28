variable "project_name" {
  type        = string
  description = "Project short name used in resource names"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev or prod)"
}

variable "location" {
  type        = string
  description = "Azure region"
  default     = "westeurope"
}

variable "aks_node_count" {
  type        = number
  description = "AKS node count"
  default     = 2
}

variable "aks_node_vm_size" {
  type        = string
  description = "AKS node VM size"
  default     = "Standard_D4s_v5"
}

variable "postgres_admin_username" {
  type        = string
  description = "PostgreSQL admin username"
}

variable "postgres_admin_password" {
  type        = string
  description = "PostgreSQL admin password"
  sensitive   = true
}

variable "tags" {
  type        = map(string)
  description = "Common resource tags"
  default     = {}
}
