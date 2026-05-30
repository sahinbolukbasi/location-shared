# Backstage Azure Governance - Resource, Status, Cost, and Management

This guide defines how to operate Azure resources from Backstage with a clean and scalable model.

## 1. What is now modeled in Backstage

Backstage catalog now includes infrastructure entities from `infra/catalog-info.yaml`:

- 1 operations component:
  - `location-shared-platform-ops`
- 12 Azure resources:
  - Resource Groups: dev, prod
  - AKS clusters: dev, prod
  - PostgreSQL servers: dev, prod
  - ACR registries: dev, prod
  - Key Vaults: dev, prod
  - Observability stacks: dev, prod

This lets you see the count of resources directly from the Catalog page by filtering `Kind = Resource`.

## 2. Status visibility model

Status is visible at 3 layers:

1. Kubernetes runtime status
- Use Backstage Kubernetes plugin page.
- Component pages already expose Kubernetes tab for backend and frontend.
- Requires Backstage Kubernetes cluster configuration and cluster access.

2. Azure operational status
- Each Resource entity links to Azure Portal pages.
- Ops component links to Cost Analysis and Resource Group inventory.

3. Deployment and delivery status
- GitHub Actions tab on components shows workflow health and run history.

## 3. Cost visibility model

Cost visibility is implemented via two channels:

1. Azure Cost Analysis (subscription and resource-group level)
- Access from `location-shared-platform-ops` links.

2. Kubernetes workload cost (OpenCost)
- Deployed by Terraform + Helm under `infra/helm-finops.tf`.
- Namespace: `finops`
- Chart: OpenCost

After deployment, open OpenCost UI with:

- `kubectl -n finops port-forward svc/opencost 9090:9090`
- Browse http://localhost:9090

## 4. Management and ownership model

- System owner: `group:default/engineering`
- Components depend on explicit infrastructure resources.
- Ops component is the single control-plane entry point for platform management.

Recommended operating loop:

1. Review resources in Backstage `Resources` list.
2. Open Ops component for Azure links and cost panel.
3. Use Kubernetes plugin for pod/deployment health.
4. Use OpenCost for namespace/workload spend.
5. Apply infra changes only via Terraform state.

## 5. Terraform and Helm management flow

Infra now manages both cloud resources and platform add-ons:

- Azure resources: `infra/main.tf` and modules
- Helm add-ons: `infra/helm-finops.tf`
- Providers: `infra/providers.tf` (azurerm + kubernetes + helm)

Important variables:

- `enable_platform_helm`
- `enable_opencost`
- `finops_namespace`
- `opencost_chart_version`

## 6. Apply order (safe sequence)

1. Ensure target AKS cluster is running.
2. Run Terraform init with environment backend key.
3. Run Terraform apply with corresponding tfvars.
4. Confirm Helm releases are healthy.
5. Validate Backstage catalog ingest and entity relationships.

Example:

- `terraform -chdir=infra init -backend-config="key=dev.terraform.tfstate" -reconfigure`
- `terraform -chdir=infra apply -var-file=environments/dev.tfvars`

## 7. Validation checklist

1. Backstage catalog includes `location-shared-platform-ops`.
2. Resource filter shows 12 infra resources.
3. Component dependency graphs show resource links.
4. OpenCost release is visible:
- `helm -n finops list`
5. Kubernetes runtime status pages load without permission errors.

## 8. Cost control guardrails

- Keep AKS non-production clusters stopped when idle.
- Keep OpenCost in dedicated namespace only.
- Use Terraform toggles to disable Helm add-ons when not needed.
- Audit nodepool count and VM size weekly.
