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

## GitHub Actions Integration

Deployment workflows in `.github/workflows/deploy-dev.yml` and `.github/workflows/deploy-prod.yml`:

- run Terraform apply,
- read outputs (`acr_name`, `acr_login_server`, `resource_group_name`, `aks_name`, `postgres_fqdn`),
- build and push backend/frontend images,
- upsert Kubernetes secrets,
- apply `infra/k8s/base` manifests,
- wait for rollout.

## Notes

- Keep sensitive values in GitHub secrets, not in tfvars.
- For production, move PostgreSQL to private networking and restrict public access.
- Detailed operational docs are under `docs/infra`.
