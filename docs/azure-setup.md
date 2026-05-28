# Azure Setup

Complete guide to how the Azure side of this project was configured from scratch.

---

## 1. Subscription

| Field | Value |
|---|---|
| Subscription Name | `Startup-Credit-Demo-Accaount` |
| Subscription ID | `4cf0d74f-7f78-413f-a9aa-9f97c39114d1` |
| Tenant ID | `d35a88c4-8fec-41d9-a641-c785d4a9ecf9` |
| Primary Region | `westeurope` |
| Account | `sahin.bolukbasi@hotmail.com` |

> **Startup Credit Subscription Constraints**  
> This subscription has limited region capabilities. Only availability zone `3` works in `westeurope` (zones 1 & 2 are unavailable). PostgreSQL Flexible Server is entirely offer-restricted in `westeurope` — it must be deployed to `northeurope`. See [Troubleshooting](./troubleshooting.md) for full details.

---

## 2. Service Principal (App Registration)

A dedicated Service Principal (SP) was created to allow GitHub Actions to authenticate with Azure without storing any passwords.

| Field | Value |
|---|---|
| Display Name | `sp-location-shared-github` (or similar) |
| Application (Client) ID | `d022d41a-5b9c-4c55-8e6f-264007ee6463` |
| Object ID | `bbff976b-2c99-45a3-bae4-72f73462316c` |

### Roles Assigned to the SP

| Role | Scope | Purpose |
|---|---|---|
| `Contributor` | Subscription | Create/manage all Azure resources |
| `User Access Administrator` | Subscription | Assign `AcrPull` role to AKS kubelet identity |

```bash
# Grant Contributor
az role assignment create \
  --assignee d022d41a-5b9c-4c55-8e6f-264007ee6463 \
  --role "Contributor" \
  --scope /subscriptions/4cf0d74f-7f78-413f-a9aa-9f97c39114d1

# Grant User Access Administrator (needed for Terraform role assignments)
az role assignment create \
  --assignee d022d41a-5b9c-4c55-8e6f-264007ee6463 \
  --role "User Access Administrator" \
  --scope /subscriptions/4cf0d74f-7f78-413f-a9aa-9f97c39114d1
```

> **Why `User Access Administrator`?**  
> Terraform creates an `AcrPull` role assignment giving AKS's kubelet Managed Identity permission to pull images from ACR. Creating role assignments requires `Microsoft.Authorization/roleAssignments/write`, which is only in `User Access Administrator` or `Owner` — not in `Contributor`.

---

## 3. OIDC Federated Credential

Instead of a client secret (password), GitHub Actions authenticates using **OpenID Connect (OIDC)**. No long-lived credentials are ever stored.

### How it works

```
GitHub Actions runner
  │  requests ephemeral OIDC token (JWT) from GitHub
  ▼
Azure AD / Entra ID
  │  validates token against registered federated credential
  ▼
Short-lived access token issued to workflow
  │  valid only for the duration of the job
  ▼
Azure resources accessible for the pipeline run
```

### Federated Credential Setup

```bash
az ad app federated-credential create \
  --id d022d41a-5b9c-4c55-8e6f-264007ee6463 \
  --parameters '{
    "name": "github-actions-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:sahinbolukbasi/location-shared:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

| Field | Value |
|---|---|
| Issuer | `https://token.actions.githubusercontent.com` |
| Subject | `repo:sahinbolukbasi/location-shared:ref:refs/heads/main` |
| Audience | `api://AzureADTokenExchange` |

> The `subject` field restricts which repository and branch can assume this identity. A push from any other branch or repo is rejected.

---

## 4. Resource Providers

Before any resource can be created, the corresponding Azure resource provider must be registered on the subscription.

```bash
az provider register --namespace Microsoft.ContainerService   # AKS
az provider register --namespace Microsoft.ContainerRegistry  # ACR
az provider register --namespace Microsoft.DBforPostgreSQL    # PostgreSQL
az provider register --namespace Microsoft.KeyVault           # Key Vault
az provider register --namespace Microsoft.OperationalInsights # Log Analytics
az provider register --namespace Microsoft.Insights           # Application Insights
az provider register --namespace Microsoft.Storage            # Terraform state storage
az provider register --namespace Microsoft.Network            # VNet / networking
az provider register --namespace Microsoft.Authorization      # Role assignments
```

Check status:
```bash
az provider show --namespace Microsoft.ContainerService --query registrationState
```

---

## 5. Terraform State Storage

Terraform stores its state remotely in Azure Blob Storage so that CI runs share a consistent view of infrastructure.

```bash
# Resource group for state (isolated from application RG)
az group create --name rg-locationshared-tfstate --location westeurope

# Storage account (globally unique name)
az storage account create \
  --name stlcsharedtfstate \
  --resource-group rg-locationshared-tfstate \
  --location westeurope \
  --sku Standard_LRS \
  --kind StorageV2

# Blob container
az storage container create \
  --name tfstate \
  --account-name stlcsharedtfstate
```

| Field | Value |
|---|---|
| Resource Group | `rg-locationshared-tfstate` |
| Storage Account | `stlcsharedtfstate` |
| Container | `tfstate` |
| State Key (dev) | `dev.terraform.tfstate` |

---

## 6. Application Resource Group

Terraform creates and manages this automatically on first apply.

```
rg-locationshared-dev  (westeurope)
```

If you need to create it manually for bootstrapping:
```bash
az group create --name rg-locationshared-dev --location westeurope
```

---

## 7. Key Vault Access Policy

The Key Vault `kvlocationshareddev` is created by Terraform. The CI SP is granted access to read secrets for deployment. AKS pods use Workload Identity (OIDC) to access secrets at runtime.

```bash
# Grant SP get/list on secrets (if needed for manual operations)
az keyvault set-policy \
  --name kvlocationshareddev \
  --spn d022d41a-5b9c-4c55-8e6f-264007ee6463 \
  --secret-permissions get list
```

---

## Summary: Manual Steps Required Before First Pipeline Run

| Step | Command/Action |
|---|---|
| 1 | Create Service Principal |
| 2 | Assign `Contributor` + `User Access Administrator` roles |
| 3 | Create OIDC Federated Credential |
| 4 | Register resource providers |
| 5 | Create `rg-locationshared-tfstate` + storage account + container |
| 6 | Add all 8 GitHub Secrets (see [Secrets](./secrets.md)) |
| 7 | Push to `main` — everything else is automated |
