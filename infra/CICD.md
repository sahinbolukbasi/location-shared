# CI/CD & Infrastructure Guide

This document is the single reference for how code goes from a developer's machine to
production.  It covers the GitHub Actions pipelines, Terraform cloud provisioning, Docker
image builds, Kubernetes deployment, and local development with Docker Compose.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [GitHub Actions Workflows](#2-github-actions-workflows)
   - 2.1 [ci.yml — Continuous Integration](#21-ciyml--continuous-integration)
   - 2.2 [deploy-dev.yml — Automated Dev Deployment](#22-deploy-devyml--automated-dev-deployment)
   - 2.3 [deploy-prod.yml — Manual Production Deployment](#23-deploy-prodyml--manual-production-deployment)
3. [Azure Authentication (OIDC)](#3-azure-authentication-oidc)
4. [Terraform Lifecycle](#4-terraform-lifecycle)
   - 4.1 [Remote State](#41-remote-state)
   - 4.2 [terraform init](#42-terraform-init)
   - 4.3 [State-sync Imports (Idempotent)](#43-state-sync-imports-idempotent)
   - 4.4 [terraform apply](#44-terraform-apply)
   - 4.5 [Reading Outputs](#45-reading-outputs)
5. [Docker Image Builds](#5-docker-image-builds)
6. [Kubernetes Deployment](#6-kubernetes-deployment)
   - 6.1 [Cluster Architecture](#61-cluster-architecture)
   - 6.2 [Namespace & Manifests](#62-namespace--manifests)
   - 6.3 [Secrets Injection](#63-secrets-injection)
   - 6.4 [Manifest Apply Order](#64-manifest-apply-order)
   - 6.5 [Rolling Rollout](#65-rolling-rollout)
7. [Networking — Ingress & Load Balancer](#7-networking--ingress--load-balancer)
8. [Scaling & Availability](#8-scaling--availability)
9. [Observability](#9-observability)
10. [Local Development with Docker Compose](#10-local-development-with-docker-compose)
11. [Required GitHub Secrets](#11-required-github-secrets)
12. [Environment Reference (dev vs prod)](#12-environment-reference-dev-vs-prod)
13. [Terraform Module Map](#13-terraform-module-map)
14. [Common Operations](#14-common-operations)

---

## 1. Architecture Overview

```
Developer
   │  push to main branch
   ▼
GitHub Actions (ci.yml)          ← PR / push: lint, build, terraform validate
   │  success
   ▼
GitHub Actions (deploy-dev.yml)  ← automatic on push to main
   │
   ├── Azure OIDC Login
   ├── Terraform apply ──────────► Azure Resource Group
   │                               ├── ACR (Container Registry)
   │                               ├── AKS (Kubernetes cluster)
   │                               ├── PostgreSQL Flexible Server
   │                               ├── Key Vault
   │                               └── Log Analytics + App Insights
   │
   ├── Docker build backend ─────► ACR  (image: backend:<git-sha>)
   ├── Docker build frontend ────► ACR  (image: frontend:<git-sha>)
   │
   ├── az aks get-credentials
   ├── kubectl apply secrets
   └── kubectl apply manifests ──► AKS namespace: location-shared
                                   ├── Deployment: backend  (2 replicas)
                                   ├── Deployment: frontend (2 replicas)
                                   ├── Service: backend  (ClusterIP :8000→80)
                                   ├── Service: frontend (ClusterIP :3000→80)
                                   ├── Ingress (nginx)
                                   │    ├── location-shared.4.231.68.185.sslip.io → frontend
                                   │    └── api.location-shared.4.231.68.185.sslip.io → backend
                                   ├── HPA: backend (2–10 replicas, 70% CPU)
                                   └── PDB: backend min 1 / frontend min 1

Manual trigger only:
GitHub Actions (deploy-prod.yml) ← workflow_dispatch only
   └── (same steps, prod environment, prod tfvars, prod secrets)
```

---

## 2. GitHub Actions Workflows

### 2.1 `ci.yml` — Continuous Integration

**Trigger:** Every pull request AND every push to `main`.

**Purpose:** Fast feedback loop — catch build failures and Terraform syntax errors
before code reaches the deployment pipeline.

**Jobs (run in parallel):**

| Job | What it does |
|---|---|
| `frontend` | `npm install` + `npm run build` — verifies Next.js compiles |
| `backend` | `pip install` + `python -m compileall app` — verifies all Python files parse |
| `terraform` | `fmt -check` + `init -backend=false` + `validate` — no credentials needed |

> `terraform init -backend=false` skips remote state entirely, making the CI check
> credential-free and fast.

---

### 2.2 `deploy-dev.yml` — Automated Dev Deployment

**Trigger:** Push to `main` branch OR manual `workflow_dispatch`.

**Single job — `deploy` — sequential steps:**

```
1. checkout
2. Azure OIDC login
3. Terraform apply (dev)        ← provisions / updates Azure infra
4. Build & push backend image   ← docker build + az acr push
5. Build & push frontend image  ← docker build + az acr push
6. Get AKS credentials          ← az aks get-credentials
7. Upsert K8s secrets           ← kubectl create secret --dry-run | apply
8. Deploy K8s manifests         ← sed + kubectl apply
9. Wait for rollout             ← kubectl rollout status (180s timeout)
```

---

### 2.3 `deploy-prod.yml` — Manual Production Deployment

**Trigger:** Manual only (`workflow_dispatch`).  
**Rationale:** Production deployments should be a deliberate human decision, not an
automatic consequence of merging to `main`.

Steps are identical to `deploy-dev.yml` except:
- Uses `environments/prod.tfvars` and `key=prod.terraform.tfstate`
- Uses `*_PROD` suffixed GitHub secrets
- Resource names contain `prod` (e.g. `rg-locationshared-prod`, `pg-locationshared-prod`)

---

## 3. Azure Authentication (OIDC)

Both deployment workflows authenticate to Azure using **OpenID Connect federated
identity** — no client secret or certificate is stored anywhere.

**How it works:**

```
GitHub Actions runner
  │ requests short-lived OIDC token from GitHub's OIDC provider
  │
  ▼
azure/login@v2 action
  │ exchanges GitHub OIDC token for Azure AD access token
  │ (ARM_USE_OIDC=true tells Terraform's azurerm provider to do the same)
  ▼
Azure Resource Manager
  (authenticated as the registered GitHub Actions app / service principal)
```

**Required GitHub repository secrets:**

| Secret | Value |
|---|---|
| `AZURE_CLIENT_ID` | Application (client) ID of the Entra ID app with federated credential |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Target Azure subscription ID |

**Required permissions for the service principal:**
- `Contributor` on the target subscription (to create/modify all resources)
- `User Access Administrator` on the subscription (to create role assignments, e.g. AcrPull)

---

## 4. Terraform Lifecycle

### 4.1 Remote State

Terraform state is stored in Azure Blob Storage — **not** in the repository.

```
Storage Account : stlcsharedtfstate
Resource Group  : rg-locationshared-tfstate   (created once, manually)
Container       : tfstate
Blobs           :
  dev.terraform.tfstate   ← dev environment state
  prod.terraform.tfstate  ← prod environment state
```

State locking uses Azure Blob lease — prevents two concurrent `apply` runs from
corrupting state.

### 4.2 `terraform init`

```bash
# Dev
terraform init -backend-config="key=dev.terraform.tfstate" -reconfigure

# Prod
terraform init -backend-config="key=prod.terraform.tfstate" -reconfigure
```

The `key` is intentionally omitted from `providers.tf` so dev and prod share the same
backend block but write to different blobs.  `-reconfigure` forces re-initialisation of
the backend without prompting for migration.

### 4.3 State-sync Imports (Idempotent)

After a state loss (e.g. corrupted blob, manual resource creation), running `apply`
would try to recreate existing resources and fail.  The workflows include an idempotent
import block before every `apply`:

```bash
# If the PostgreSQL server already exists in Azure → import it into state
if az postgres flexible-server show --resource-group "$RG" --name "$PG" ...; then
  terraform import ... module.postgres.azurerm_postgresql_flexible_server.this  "<resource-id>"
  terraform import ... module.postgres.azurerm_postgresql_flexible_server_database.app "<resource-id>"
  terraform import ... module.postgres.azurerm_postgresql_flexible_server_firewall_rule.allow_azure "<resource-id>"
fi

# If the AcrPull role assignment already exists → import it
if [ -n "$RA_ID" ]; then
  terraform import ... module.aks.azurerm_role_assignment.acr_pull "$RA_ID"
fi
```

Each import command ends with `2>/dev/null || true` so it is silently skipped when the
resource is already tracked in state.

### 4.4 `terraform apply`

```bash
terraform apply \
  -auto-approve \
  -var-file=environments/dev.tfvars \
  -var=postgres_admin_username=<from-secret> \
  -var=postgres_admin_password=<from-secret>
```

`-auto-approve` is safe in CI because the plan is always deterministic (state is
consistent after the import step above).  Human review is handled at the PR stage via
`ci.yml`'s `terraform validate`.

### 4.5 Reading Outputs

After `apply`, the workflow reads Terraform outputs and writes them to `$GITHUB_OUTPUT`
so subsequent steps can consume them:

```bash
echo "acr_login_server=$(terraform output -raw acr_login_server)" >> "$GITHUB_OUTPUT"
echo "acr_name=$(terraform output -raw acr_name)"                 >> "$GITHUB_OUTPUT"
echo "aks_name=$(terraform output -raw aks_name)"                 >> "$GITHUB_OUTPUT"
echo "resource_group_name=$(terraform output -raw resource_group_name)" >> "$GITHUB_OUTPUT"
echo "postgres_fqdn=$(terraform output -raw postgres_fqdn)"       >> "$GITHUB_OUTPUT"
```

These are then referenced in later steps as `${{ steps.terraform.outputs.<name> }}`.

---

## 5. Docker Image Builds

### Backend (`./backend/Dockerfile`)

Single-stage build:
```
FROM python:3.12-slim
COPY requirements.txt → pip install
COPY app/            → /app/app/
CMD: uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Tagged with the **full git SHA** to guarantee immutable image references:
```bash
docker build -t <acr-login-server>/location-shared-backend:<git-sha> ./backend
docker push <acr-login-server>/location-shared-backend:<git-sha>
```

### Frontend (`./frontend/Dockerfile`)

Multi-stage build (deps → builder → runner):
```
Stage 1 (deps)    : npm install
Stage 2 (builder) : npm run build with NEXT_PUBLIC_API_BASE_URL baked in
Stage 3 (runner)  : copy .next/standalone only → smallest production image
```

`NEXT_PUBLIC_API_BASE_URL` is a **build-time** argument because Next.js inlines
public env vars at compile time:
```bash
docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://api.location-shared.4.231.68.185.sslip.io \
  -t <acr-login-server>/location-shared-frontend:<git-sha> \
  ./frontend
```

### Why git SHA tagging?

- Each deployment references an exact, immutable image.
- Rolling back is a one-command `kubectl set image` with a previous SHA.
- The `:latest` tag in manifest templates is replaced with the SHA at deploy time
  via `sed` (see §6.4).

---

## 6. Kubernetes Deployment

### 6.1 Cluster Architecture

```
AKS Cluster: aks-locationshared-{env}  (westeurope, Free tier)
│
├── Node Pool: system (1× Standard_D2s_v5, AzureLinux)
│     └── kube-system pods only (CoreDNS, metrics-server, nginx-ingress, etc.)
│         only_critical_addons_enabled = true
│
└── Node Pool: user   ({2|3}× Standard_D4s_v5, AzureLinux)
      └── application workloads:
            ├── Namespace: location-shared
            │     ├── Deployment: backend  (2 replicas, 100m-500m CPU, 256Mi-512Mi RAM)
            │     ├── Deployment: frontend (2 replicas, 100m-500m CPU, 256Mi-512Mi RAM)
            │     ├── Service: backend  (ClusterIP, port 80 → pod 8000)
            │     ├── Service: frontend (ClusterIP, port 80 → pod 3000)
            │     ├── Ingress: location-shared (nginx, routes by hostname)
            │     ├── HPA: backend-hpa (min 2 / max 10, CPU target 70%)
            │     ├── PDB: backend-pdb  (minAvailable: 1)
            │     └── PDB: frontend-pdb (minAvailable: 1)
            └── Namespace: ingress-nginx
                  └── nginx-ingress controller (installed separately via Helm)
```

### 6.2 Namespace & Manifests

All application resources live in the `location-shared` namespace, defined in
`infra/k8s/base/namespace.yaml`.  Applying it first is idempotent.

| Manifest | Purpose |
|---|---|
| `namespace.yaml` | Creates the `location-shared` namespace |
| `configmap.yaml` | Non-secret config (API URL, CORS origins) mounted into all pods |
| `backend-deployment.yaml` | FastAPI backend, 2 replicas, readiness/liveness probes |
| `backend-service.yaml` | ClusterIP service: internal port 80 → pod port 8000 |
| `frontend-deployment.yaml` | Next.js frontend, 2 replicas |
| `frontend-service.yaml` | ClusterIP service: internal port 80 → pod port 3000 |
| `ingress.yaml` | nginx Ingress: hostname-based routing to frontend + backend services |
| `hpa-backend.yaml` | HPA: scale backend pods 2–10 based on 70% CPU |
| `pdb.yaml` | PodDisruptionBudgets: guarantee 1 backend + 1 frontend during node drains |
| `secrets.example.yaml` | Documentation template — never applied directly |

### 6.3 Secrets Injection

Sensitive runtime configuration is passed to pods as Kubernetes `Secret` named
`app-secrets`.  The workflow creates/updates this secret using `--dry-run=client | apply`
(idempotent upsert pattern):

```bash
kubectl create secret generic app-secrets \
  --namespace location-shared \
  --from-literal=SECRET_KEY="..." \
  --from-literal=DATABASE_URL="postgresql+psycopg://<user>:<pass>@<fqdn>:5432/location_shared" \
  --from-literal=GOOGLE_CLIENT_ID="..." \
  --from-literal=STRIPE_SECRET_KEY="..." \
  --from-literal=STRIPE_WEBHOOK_SECRET="..." \
  --from-literal=STRIPE_PRO_PRICE_ID="..." \
  --dry-run=client -o yaml | kubectl apply -f -
```

The `DATABASE_URL` is assembled in the workflow from:
- `postgres_fqdn` — Terraform output
- `APP_DB_USER_DEV` / `APP_DB_PASSWORD_DEV` — GitHub Secrets

Backend pods receive all secret values as environment variables via `envFrom.secretRef`.

### 6.4 Manifest Apply Order

Deployment manifests contain the placeholder `REPLACE_ACR_LOGIN_SERVER` and image tag
`:latest`.  Before applying, the workflow substitutes real values using `sed`:

```bash
sed \
  -e "s|REPLACE_ACR_LOGIN_SERVER|<acr-login-server>|g" \
  -e "s|:latest|:<git-sha>|g" \
  infra/k8s/base/backend-deployment.yaml > /tmp/backend.yaml
```

Apply order matters — resources must exist before dependents:
```
1. namespace.yaml          ← namespace first
2. configmap.yaml          ← ConfigMap before pods
3. app-secrets (kubectl)   ← Secret before pods
4. backend-deployment.yaml ← Deployment references configmap + secret
5. backend-service.yaml    ← Service can be applied any time
6. frontend-deployment.yaml
7. frontend-service.yaml
8. ingress.yaml            ← Ingress references services
9. hpa-backend.yaml        ← HPA references deployment
10. pdb.yaml               ← PDB references pods
```

### 6.5 Rolling Rollout

After applying, the workflow waits for both deployments to finish:

```bash
kubectl rollout status deployment/backend  -n location-shared --timeout=180s
kubectl rollout status deployment/frontend -n location-shared --timeout=180s
```

This ensures the workflow fails visibly if pods do not become Ready within 3 minutes
(e.g. bad image, OOMKill, failing health probe).

---

## 7. Networking — Ingress & Load Balancer

```
Internet
    │
    ▼  TCP:80  (Azure Public Load Balancer — IP: 4.231.68.185)
nginx-ingress controller (NodePort Service on AKS)
    │
    ├── Host: location-shared.4.231.68.185.sslip.io
    │         → Service: frontend (ClusterIP :80) → pods :3000
    │
    └── Host: api.location-shared.4.231.68.185.sslip.io
              → Service: backend (ClusterIP :80)  → pods :8000
```

**sslip.io DNS:** `<name>.<ip>.sslip.io` resolves to `<ip>` with no registration
required — useful for development/staging environments.

**nginx-ingress controller** is installed separately via Helm (not managed by Terraform):
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```
It provisions the Azure Load Balancer automatically and assigns the public IP.

**TLS:** Not configured currently — HTTP only.  To add HTTPS, install cert-manager
and add a `tls` block to `infra/k8s/base/ingress.yaml`.

---

## 8. Scaling & Availability

### HPA (Horizontal Pod Autoscaler)

The backend HPA watches CPU utilisation and adds/removes pods automatically:

```yaml
minReplicas: 2
maxReplicas: 10
target: CPU averageUtilization 70%
```

When CPU on existing backend pods exceeds 70%, Kubernetes adds replicas until the
average drops below threshold.  Response time stays low under traffic spikes without
manual intervention.

### PodDisruptionBudgets

PDBs ensure at least 1 backend pod and 1 frontend pod remain Running during:
- Node upgrades (`kubectl drain`)
- Cluster autoscaler scale-down
- Rolling deployments

Without PDBs, a node drain could momentarily take all replicas offline if they happen
to be co-located.

### Node Pools

| Pool | Size | Role |
|---|---|---|
| `system` | 1× D2s_v5 | kube-system only — never scale this down to 0 |
| `user` | 2× D4s_v5 (dev) / 3× D4s_v5 (prod) | all application workloads |

The separation prevents a misbehaving application from starving Kubernetes system
components.

---

## 9. Observability

| Component | What it collects | How to access |
|---|---|---|
| **Log Analytics Workspace** `law-locationshared-{env}` | AKS container logs, node metrics, Kubernetes events | Azure Portal → Log Analytics → Logs (KQL) |
| **Application Insights** `appi-locationshared-{env}` | HTTP request traces, exceptions, custom metrics | Azure Portal → Application Insights → Transaction search |

The AKS OMS agent is configured in `infra/modules/aks/main.tf` via the `oms_agent`
block.  It streams container stdout/stderr to the Log Analytics Workspace automatically.

**Useful KQL queries:**

```kusto
-- All backend container logs in the last hour
ContainerLogV2
| where TimeGenerated > ago(1h)
| where ContainerName == "backend"
| project TimeGenerated, LogMessage
| order by TimeGenerated desc

-- HTTP 5xx errors from the ingress
ContainerLogV2
| where LogMessage has "HTTP/1.1\" 5"
| summarize count() by bin(TimeGenerated, 5m)
```

---

## 10. Local Development with Docker Compose

`docker-compose.yml` at the repository root starts a fully local stack:

```
Service  │ Port  │ Description
─────────┼───────┼──────────────────────────────────────────
db       │ 5432  │ PostgreSQL 16 (postgres/postgres)
backend  │ 8000  │ FastAPI via uvicorn; hot-reloads on file change
frontend │ 3000  │ Next.js dev server
```

**Start everything:**
```bash
# Optional: set Stripe / Google credentials
export GOOGLE_CLIENT_ID=<your-id>
export STRIPE_SECRET_KEY=<your-key>
export STRIPE_WEBHOOK_SECRET=<your-secret>
export STRIPE_PRO_PRICE_ID=<your-price-id>

docker compose up --build
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

**Backend-only (without Docker):**
```bash
cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/location_shared \
SECRET_KEY=local-dev-secret \
CORS_ORIGINS=http://localhost:3000 \
uvicorn app.main:app --reload
```

**Database migrations:**
The backend runs `Base.metadata.create_all()` on startup — tables are created
automatically.  For schema changes, generate and run Alembic migrations:
```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

---

## 11. Required GitHub Secrets

Configure these in `Settings → Secrets and variables → Actions`:

### Azure authentication (shared)

| Secret | Description |
|---|---|
| `AZURE_CLIENT_ID` | Entra ID app client ID (OIDC federated) |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Target subscription ID |

### Dev environment

| Secret | Description |
|---|---|
| `POSTGRES_ADMIN_USERNAME_DEV` | PostgreSQL server admin login |
| `POSTGRES_ADMIN_PASSWORD_DEV` | PostgreSQL server admin password |
| `APP_DB_USER_DEV` | App database user (defaults to admin if blank) |
| `APP_DB_PASSWORD_DEV` | App database password |
| `SECRET_KEY_DEV` | JWT signing secret (long random string) |
| `GOOGLE_CLIENT_ID_DEV` | Google OAuth2 client ID |
| `STRIPE_SECRET_KEY_DEV` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET_DEV` | Stripe webhook endpoint secret |
| `STRIPE_PRO_PRICE_ID_DEV` | Stripe price ID for the Pro plan |

### Prod environment

Same names with `_PROD` suffix instead of `_DEV`.

---

## 12. Environment Reference (dev vs prod)

| Attribute | dev | prod |
|---|---|---|
| Deploy trigger | Push to `main` (automatic) | Manual only (`workflow_dispatch`) |
| Terraform state | `dev.terraform.tfstate` | `prod.terraform.tfstate` |
| tfvars file | `environments/dev.tfvars` | `environments/prod.tfvars` |
| Resource group | `rg-locationshared-dev` | `rg-locationshared-prod` |
| AKS cluster | `aks-locationshared-dev` | `aks-locationshared-prod` |
| PostgreSQL server | `pg-locationshared-dev` | `pg-locationshared-prod` |
| User node pool | 2× D4s_v5 | 3× D4s_v5 |
| GitHub secrets suffix | `_DEV` | `_PROD` |

---

## 13. Terraform Module Map

```
infra/
├── providers.tf         Terraform version + azurerm provider + remote backend
├── variables.tf         All input variables with descriptions
├── main.tf              Resource group + 5 module calls
├── outputs.tf           Exports used by the CI/CD workflow
│
├── environments/
│   ├── dev.tfvars       Variable values for dev
│   └── prod.tfvars      Variable values for prod
│
└── modules/
    ├── acr/             Azure Container Registry (Basic SKU, RBAC-only)
    ├── aks/             AKS cluster + user node pool + AcrPull role assignment
    ├── keyvault/        Key Vault (standard SKU, deployer access policy)
    ├── observability/   Log Analytics Workspace + Application Insights
    └── postgres/        PostgreSQL 16 Flexible Server + database + firewall rule
```

**Dependency graph:**

```
azurerm_resource_group.main
    ├─► module.acr
    ├─► module.observability
    ├─► module.keyvault
    ├─► module.postgres
    └─► module.aks
             ├── depends on module.acr (acr_id for AcrPull role)
             └── depends on module.observability (log_analytics_workspace_id for OMS)
```

---

## 14. Common Operations

### Trigger a dev deployment manually
```
GitHub → Actions → deploy-dev → Run workflow
```

### Deploy to production
```
GitHub → Actions → deploy-prod → Run workflow
```

### View current pod status
```bash
az aks get-credentials -g rg-locationshared-dev -n aks-locationshared-dev
kubectl get pods -n location-shared
kubectl get hpa   -n location-shared
```

### View backend logs
```bash
kubectl logs -n location-shared deployment/backend --follow
```

### Roll back to a previous image
```bash
# List recent images in ACR
az acr repository show-tags --name <acr-name> --repository location-shared-backend

# Roll back backend to a specific commit SHA
kubectl set image deployment/backend \
  backend=<acr-login-server>/location-shared-backend:<previous-sha> \
  -n location-shared
kubectl rollout status deployment/backend -n location-shared
```

### Run Terraform locally
```bash
cd infra

# Authenticate (OIDC is only for GitHub Actions — use az login locally)
az login

export ARM_SUBSCRIPTION_ID=<subscription-id>

terraform init -backend-config="key=dev.terraform.tfstate"

terraform plan \
  -var-file=environments/dev.tfvars \
  -var=postgres_admin_username=pgadminuser \
  -var=postgres_admin_password=<password>

terraform apply \
  -var-file=environments/dev.tfvars \
  -var=postgres_admin_username=pgadminuser \
  -var=postgres_admin_password=<password>
```

### Destroy a dev environment
```bash
# ⚠ Destructive — deletes all dev Azure resources including the database
terraform destroy \
  -var-file=environments/dev.tfvars \
  -var=postgres_admin_username=pgadminuser \
  -var=postgres_admin_password=<password>
```
