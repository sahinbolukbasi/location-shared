# GitHub Actions CI/CD Pipeline

Complete walkthrough of the automated deployment pipeline.

---

## Workflow Overview

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| `deploy-dev` | `.github/workflows/deploy-dev.yml` | push to `main` + manual dispatch | Full deploy to dev ✅ |
| `deploy-prod` | `.github/workflows/deploy-prod.yml` | manual dispatch only | Full deploy to production |
| `ci` | `.github/workflows/ci.yml` | push to any branch | Lint / test |

> **Node.js 24**: Both deploy workflows set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"` to suppress deprecation warnings from actions that still bundle Node.js 20.

---

## `deploy-dev.yml` — Step-by-Step

### Permissions

```yaml
permissions:
  id-token: write   # Required for OIDC — lets GitHub generate an OIDC JWT
  contents: read    # Read repository contents (checkout)
```

Without `id-token: write`, GitHub will not issue an OIDC token and the Azure login step fails.

---

### Step 1: Checkout

```yaml
- uses: actions/checkout@v4
```

Checks out the repository at the commit that triggered the push.

---

### Step 2: Azure Login with OIDC

```yaml
- name: Azure login with OIDC
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

**How OIDC works here:**

```
GitHub runner requests OIDC token from GitHub
    │  JWT signed by https://token.actions.githubusercontent.com
    │  Subject claim: repo:sahinbolukbasi/location-shared:ref:refs/heads/main
    ▼
azure/login@v2 sends token to Azure AD
    │  Azure validates: issuer URL, subject, audience match federated credential
    ▼
Azure issues short-lived ARM access token
    │  Valid only for this job run
    ▼
az CLI + Terraform use this token automatically
```

No passwords or secrets are involved in this authentication. The token expires when the job ends.

---

### Step 3: Setup Terraform

```yaml
- uses: hashicorp/setup-terraform@v3
```

Installs the latest stable Terraform binary on the runner.

---

### Step 4: Terraform Apply

```yaml
- name: Terraform Apply (dev)
  id: terraform
  working-directory: infra
  env:
    ARM_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
    ARM_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
    ARM_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
    ARM_USE_OIDC: "true"
    POSTGRES_ADMIN_USERNAME: ${{ secrets.POSTGRES_ADMIN_USERNAME_DEV }}
    POSTGRES_ADMIN_PASSWORD: ${{ secrets.POSTGRES_ADMIN_PASSWORD_DEV }}
```

The `ARM_*` environment variables tell the AzureRM Terraform provider to authenticate via OIDC using the same token that `azure/login@v2` obtained.

**`run` script breakdown:**

```bash
terraform init -backend-config="key=dev.terraform.tfstate" -reconfigure
# ↑ Downloads providers, connects to Azure Blob remote backend (env-specific key)

# IDEMPOTENT STATE SYNC — import if resource exists in Azure but not in Terraform state.
# This handles the case where state was lost (e.g. after a state backend reset).
# All imports use "|| true" so they silently skip if already imported or resource doesn't exist yet.

if az postgres flexible-server show --resource-group "$RG" --name "$PG" ...; then
  terraform import ... module.postgres.azurerm_postgresql_flexible_server.this  || true
  terraform import ... module.postgres.azurerm_postgresql_flexible_server_database.app  || true
  terraform import ... module.postgres.azurerm_postgresql_flexible_server_firewall_rule.allow_azure  || true
fi

ACR_NAME=$(az acr list --resource-group "$RG" ...)
if [ -n "$ACR_NAME" ]; then
  RA_ID=$(az role assignment list --role "AcrPull" ...)
  terraform import ... module.aks.azurerm_role_assignment.acr_pull "$RA_ID"  || true
fi
# ↑ 4 resources protected against state drift; new resources are created normally

terraform apply -auto-approve -var-file=environments/dev.tfvars \
  -var=postgres_admin_username=... -var=postgres_admin_password=...
# ↑ Creates or updates all Azure resources; skips unchanged resources

# Capture outputs for downstream steps
echo "acr_login_server=$(terraform output -raw acr_login_server)" >> "$GITHUB_OUTPUT"
echo "aks_name=$(terraform output -raw aks_name)" >> "$GITHUB_OUTPUT"
# ... etc
```

> **Why import instead of `terraform state rm`?**  
> Previous versions used `state rm` to remove resources before re-applying. This caused resource recreation on every run. The current approach uses **idempotent imports**: resources are added to state if missing, leaving existing state untouched.

---

### Step 5: Build & Push Backend Image

```yaml
- name: Build and push backend image
  run: |
    az acr login --name ${{ steps.terraform.outputs.acr_name }}
    docker build -t ${{ steps.terraform.outputs.acr_login_server }}/location-shared-backend:${{ github.sha }} ./backend
    docker push ${{ steps.terraform.outputs.acr_login_server }}/location-shared-backend:${{ github.sha }}
```

- Uses `az acr login` (OIDC-authenticated) — no registry username/password needed
- Tags image with the full commit SHA for precise traceability
- ACR name comes from Terraform output (dynamic, includes random suffix)

---

### Step 6: Build & Push Frontend Image

Same pattern as backend, but for the Next.js app in `./frontend`.

---

### Step 7: Get AKS Context

```yaml
- name: Get AKS context
  run: |
    az aks get-credentials \
      --resource-group ${{ steps.terraform.outputs.resource_group_name }} \
      --name ${{ steps.terraform.outputs.aks_name }} \
      --overwrite-existing
```

Downloads the kubeconfig for the AKS cluster. `--overwrite-existing` ensures stale configs from previous runs don't block the job.

---

### Step 8: Upsert Kubernetes Secrets

```bash
kubectl create secret generic app-secrets \
  --namespace location-shared \
  --from-literal=SECRET_KEY="..." \
  --from-literal=DATABASE_URL="postgresql+psycopg://user:pass@fqdn:5432/location_shared" \
  --from-literal=GOOGLE_CLIENT_ID="..." \
  --from-literal=STRIPE_SECRET_KEY="..." \
  ...
  --dry-run=client -o yaml | kubectl apply -f -
```

The `--dry-run=client -o yaml | kubectl apply -f -` pattern is an **upsert** — it creates the secret if it doesn't exist, or updates it if it does. Plain `kubectl create secret` would fail on re-runs.

`DATABASE_URL` is assembled dynamically from the Terraform `postgres_fqdn` output and the DB credentials from GitHub Secrets.

---

### Step 9: Deploy Manifests

```bash
# Substitute placeholders in deployment manifests
sed -e "s|REPLACE_ACR_LOGIN_SERVER|<acr-server>|g" \
    -e "s|:latest|:<commit-sha>|g" \
    infra/k8s/base/backend-deployment.yaml > /tmp/backend.yaml

# Apply all manifests
kubectl apply -f infra/k8s/base/namespace.yaml
kubectl apply -f infra/k8s/base/configmap.yaml
kubectl apply -f /tmp/backend.yaml
kubectl apply -f infra/k8s/base/backend-service.yaml
# ... frontend, ingress, hpa, pdb

# Wait for rollout
kubectl rollout status deployment/backend -n location-shared --timeout=180s
kubectl rollout status deployment/frontend -n location-shared --timeout=180s
```

Every deployment uses the exact commit SHA as the image tag — no `:latest` in production.

---

## OIDC Authentication Flow (Full Picture)

```
┌─────────────────────────────────────────────────────────────────┐
│                      GitHub Actions Runner                       │
│                                                                 │
│  1. Request OIDC JWT from GitHub Token Service                  │
│     (automatically triggered by azure/login@v2)                 │
│                                                                 │
│  2. Send JWT to Azure AD token endpoint                         │
│     POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
│     with:                                                       │
│       client_assertion = <GitHub OIDC JWT>                      │
│       client_assertion_type = urn:ietf:params:oauth:...jwt-bearer
│       requested_token_use = on_behalf_of                        │
│                                                                 │
│  3. Azure AD validates:                                         │
│     ✓ issuer = https://token.actions.githubusercontent.com      │
│     ✓ subject = repo:sahinbolukbasi/location-shared:ref:refs/heads/main
│     ✓ audience = api://AzureADTokenExchange                     │
│                                                                 │
│  4. Azure AD returns short-lived ARM access token               │
│                                                                 │
│  5. az CLI / Terraform use token for all Azure API calls        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables in the Pipeline

| Variable | Source | Used By |
|---|---|---|
| `ARM_CLIENT_ID` | GitHub Secret | Terraform AzureRM provider |
| `ARM_TENANT_ID` | GitHub Secret | Terraform AzureRM provider |
| `ARM_SUBSCRIPTION_ID` | GitHub Secret | Terraform AzureRM provider |
| `ARM_USE_OIDC` | Hardcoded `true` | Terraform — tells provider to use OIDC |
| `POSTGRES_ADMIN_USERNAME` | GitHub Secret | Terraform `-var` |
| `POSTGRES_ADMIN_PASSWORD` | GitHub Secret | Terraform `-var` |

---

## Re-running a Failed Pipeline

```bash
# Via GitHub CLI
gh run rerun <run-id> --repo sahinbolukbasi/location-shared

# Or trigger manually
gh workflow run deploy-dev.yml --repo sahinbolukbasi/location-shared
```

All steps are **idempotent**: Terraform skips already-provisioned resources, Docker images are overwritten at the same SHA tag, and `kubectl apply` is a no-op for unchanged manifests.

---

## CI/CD Flow Diagram (Mermaid)

```mermaid
flowchart TD
    A[git push to main] --> B[GitHub Actions: deploy-dev]
    B --> C[Azure Login OIDC]
    C --> D[Terraform Init\nkey=dev.terraform.tfstate]
    D --> E{Resources in\nAzure state?}
    E -- No --> F[terraform import\nidempotent 4 resources]
    E -- Yes --> G[terraform apply\ndev.tfvars]
    F --> G
    G --> H[Build & Push\nbackend image to ACR]
    H --> I[Build & Push\nfrontend image to ACR]
    I --> J[az aks get-credentials]
    J --> K[kubectl upsert\napp-secrets]
    K --> L[kubectl apply\nall K8s manifests]
    L --> M[kubectl rollout status\ntimeout 180s]
    M --> N[Deploy COMPLETE ✅]

    style N fill:#4CAF50,color:#fff
```

---

## Gerekli GitHub Secrets

### Ortak (Her İki Env)

| Secret | Açıklama |
|---|---|
| `AZURE_CLIENT_ID` | OIDC App Registration Client ID |
| `AZURE_TENANT_ID` | Azure AD Tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure Subscription ID |

### Dev Ortamı

| Secret | Açıklama |
|---|---|
| `POSTGRES_ADMIN_USERNAME_DEV` | PostgreSQL admin kullanıcı adı |
| `POSTGRES_ADMIN_PASSWORD_DEV` | PostgreSQL admin parolası |
| `APP_DB_USER_DEV` | Uygulama DB kullanıcısı (opsiyonel, admin fallback) |
| `APP_DB_PASSWORD_DEV` | Uygulama DB parolası |
| `SECRET_KEY_DEV` | JWT signing key |
| `GOOGLE_CLIENT_ID_DEV` | Google OAuth2 Client ID |
| `STRIPE_SECRET_KEY_DEV` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET_DEV` | Stripe webhook imzalama secret'ı |
| `STRIPE_PRO_PRICE_ID_DEV` | Stripe Pro plan price ID |

### Prod Ortamı

Aynı isimlendirme, `_DEV` yerine `_PROD` suffix kullanılır.
