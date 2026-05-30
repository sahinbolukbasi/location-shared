# Infrastructure

This folder is the single source for Azure infrastructure and Kubernetes deployment assets.

## Layout

- `main.tf`, `providers.tf`, `variables.tf`, `outputs.tf`: Terraform root for Azure resources
- `modules/*`: Terraform modules (ACR, AKS, PostgreSQL, Key Vault, Observability)
- `environments/*.tfvars`: environment values (dev/prod)
- `k8s/base/*`: Kubernetes manifests applied after Terraform provisioning

## Modules

- `modules/acr`: Azure Container Registry
- `modules/aks`: AKS cluster + AcrPull role assignment
- `modules/postgres`: PostgreSQL Flexible Server
- `modules/keyvault`: Key Vault for application secrets
- `modules/observability`: Log Analytics + Application Insights

## Usage

```bash
cd infra
terraform init
terraform plan -var-file=environments/dev.tfvars
terraform apply -var-file=environments/dev.tfvars
```

## CI/CD Guide

For the full end-to-end deployment reference — how each GitHub Actions workflow works,
how Terraform is triggered, how Docker images are built and tagged, how Kubernetes
manifests are applied, and how to run Terraform locally — see:

**[CICD.md](./CICD.md)**

Quick summary of what the deploy workflows do:
1. Azure OIDC login (no stored secrets)
2. `terraform init` with per-environment state key → `terraform apply`
3. `docker build` + push to ACR (tagged with `git sha`)
4. `az aks get-credentials` → `kubectl apply` secrets + manifests
5. `kubectl rollout status` (waits for healthy rollout)

## Notes

- Keep sensitive values in GitHub Secrets, never in `.tfvars` files.
- For production, move PostgreSQL to a private VNet and disable public access.
- All modules have detailed inline comments in `main.tf` explaining every argument.
