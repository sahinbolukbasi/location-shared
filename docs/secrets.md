# Pipeline Secrets

All GitHub repository secrets required for the CI/CD pipeline to function. These are stored in **GitHub → Settings → Secrets and variables → Actions** and never appear in logs or committed code.

---

## Required Secrets

### Azure Identity Secrets (OIDC)

| Secret Name | Description | Where to Find |
|---|---|---|
| `AZURE_CLIENT_ID` | Application (Client) ID of the Service Principal | Azure Portal → App Registrations → Overview |
| `AZURE_TENANT_ID` | Azure AD / Entra ID Tenant ID | Azure Portal → Microsoft Entra ID → Overview |
| `AZURE_SUBSCRIPTION_ID` | Azure Subscription ID | `az account show --query id -o tsv` |

**Current values** (safe to know — not secret by themselves):

```
AZURE_CLIENT_ID       = d022d41a-5b9c-4c55-8e6f-264007ee6463
AZURE_TENANT_ID       = d35a88c4-8fec-41d9-a641-c785d4a9ecf9
AZURE_SUBSCRIPTION_ID = 4cf0d74f-7f78-413f-a9aa-9f97c39114d1
```

---

### Database Secrets

| Secret Name | Description | Notes |
|---|---|---|
| `POSTGRES_ADMIN_USERNAME_DEV` | PostgreSQL server admin username | Used by Terraform to create the server |
| `POSTGRES_ADMIN_PASSWORD_DEV` | PostgreSQL server admin password | Used by Terraform + K8s secret |

The admin user (`pgadminuser` by default) is the superuser on the PostgreSQL server. In a production setup, a separate app-specific user with limited privileges should be used.

---

### Application Secrets

| Secret Name | Description | Notes |
|---|---|---|
| `APP_DB_USER_DEV` | Database user for the application | Falls back to admin user if not set |
| `APP_DB_PASSWORD_DEV` | Database password for the application | Falls back to admin password if not set |
| `SECRET_KEY_DEV` | JWT signing secret for the FastAPI backend | Must be a strong random string |
| `GOOGLE_CLIENT_ID_DEV` | Google OAuth2 Client ID | From Google Cloud Console |
| `STRIPE_SECRET_KEY_DEV` | Stripe API secret key | From Stripe Dashboard → API Keys |
| `STRIPE_WEBHOOK_SECRET_DEV` | Stripe webhook endpoint secret | From Stripe Dashboard → Webhooks |
| `STRIPE_PRO_PRICE_ID_DEV` | Stripe Price ID for Pro subscription | From Stripe Dashboard → Products |

---

## How Secrets Flow Into the Application

```
GitHub Secrets
     │
     ▼ (CI reads at runtime)
GitHub Actions Workflow
     │
     ├─► Terraform apply
     │     -var=postgres_admin_username=...
     │     -var=postgres_admin_password=...
     │
     └─► kubectl create secret generic app-secrets
           --from-literal=DATABASE_URL="postgresql+psycopg://user:pass@fqdn:5432/location_shared"
           --from-literal=SECRET_KEY="..."
           --from-literal=GOOGLE_CLIENT_ID="..."
           --from-literal=STRIPE_SECRET_KEY="..."
           --from-literal=STRIPE_WEBHOOK_SECRET="..."
           --from-literal=STRIPE_PRO_PRICE_ID="..."
                │
                ▼
         Kubernetes Secret "app-secrets" in namespace "location-shared"
                │
                ▼
         Pod environment variables (envFrom in deployment manifest)
                │
                ▼
         FastAPI reads via os.environ / Pydantic settings
```

---

## Setting Secrets via GitHub CLI

```bash
# Azure identity
gh secret set AZURE_CLIENT_ID       --body "d022d41a-5b9c-4c55-8e6f-264007ee6463" --repo sahinbolukbasi/location-shared
gh secret set AZURE_TENANT_ID       --body "d35a88c4-8fec-41d9-a641-c785d4a9ecf9" --repo sahinbolukbasi/location-shared
gh secret set AZURE_SUBSCRIPTION_ID --body "4cf0d74f-7f78-413f-a9aa-9f97c39114d1" --repo sahinbolukbasi/location-shared

# Database
gh secret set POSTGRES_ADMIN_USERNAME_DEV --body "pgadminuser"           --repo sahinbolukbasi/location-shared
gh secret set POSTGRES_ADMIN_PASSWORD_DEV --body "<strong-password>"     --repo sahinbolukbasi/location-shared
gh secret set APP_DB_USER_DEV             --body "pgadminuser"           --repo sahinbolukbasi/location-shared
gh secret set APP_DB_PASSWORD_DEV         --body "<strong-password>"     --repo sahinbolukbasi/location-shared

# Application
gh secret set SECRET_KEY_DEV              --body "<random-64-char-hex>"  --repo sahinbolukbasi/location-shared
gh secret set GOOGLE_CLIENT_ID_DEV        --body "<google-client-id>"    --repo sahinbolukbasi/location-shared
gh secret set STRIPE_SECRET_KEY_DEV       --body "sk_test_..."           --repo sahinbolukbasi/location-shared
gh secret set STRIPE_WEBHOOK_SECRET_DEV   --body "whsec_..."             --repo sahinbolukbasi/location-shared
gh secret set STRIPE_PRO_PRICE_ID_DEV     --body "price_..."             --repo sahinbolukbasi/location-shared
```

Generate a strong `SECRET_KEY`:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## Verifying Secrets Are Set

```bash
gh secret list --repo sahinbolukbasi/location-shared
```

Expected output:
```
APP_DB_PASSWORD_DEV          Updated 2025-05-28
APP_DB_USER_DEV              Updated 2025-05-28
AZURE_CLIENT_ID              Updated 2025-05-28
AZURE_SUBSCRIPTION_ID        Updated 2025-05-28
AZURE_TENANT_ID              Updated 2025-05-28
GOOGLE_CLIENT_ID_DEV         Updated 2025-05-28
POSTGRES_ADMIN_PASSWORD_DEV  Updated 2025-05-28
POSTGRES_ADMIN_USERNAME_DEV  Updated 2025-05-28
SECRET_KEY_DEV               Updated 2025-05-28
STRIPE_PRO_PRICE_ID_DEV      Updated 2025-05-28
STRIPE_SECRET_KEY_DEV        Updated 2025-05-28
STRIPE_WEBHOOK_SECRET_DEV    Updated 2025-05-28
```

---

## Security Notes

- Secrets are **never echoed** in logs — GitHub masks them automatically
- Secrets are **scoped to the repository** — forks do not inherit them
- The database password is passed as a Terraform `-var` flag (not committed to code)
- The `postgres_admin_password` in `dev.tfvars` is the placeholder string `CHANGE_ME_DEV` — this is intentionally overridden at runtime by the GitHub Secret
- OIDC means no stored Azure credentials of any kind — just three non-sensitive IDs
