# System Architecture

## Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet / Users                         │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Azure Kubernetes Service (AKS)                 │
│                    aks-locationshared-dev                       │
│  westeurope  │  SKU: Free  │  Azure CNI  │  Azure Network Policy│
│                                                                 │
│  ┌─────────────────────┐   ┌─────────────────────────────────┐  │
│  │  System Node Pool   │   │      User Node Pool             │  │
│  │  1× Standard_D2s_v5 │   │      2× Standard_D4s_v5         │  │
│  │  OS: AzureLinux     │   │      OS: AzureLinux             │  │
│  │  (critical only)    │   │      (application workloads)    │  │
│  └─────────────────────┘   └─────────────────────────────────┘  │
│                                                                 │
│  Namespace: location-shared                                     │
│  ┌──────────────────┐   ┌───────────────────┐                  │
│  │  frontend (Next) │   │  backend (FastAPI) │                  │
│  │  Deployment      │   │  Deployment        │                  │
│  │  replicas: 2     │   │  replicas: 2       │                  │
│  │  HPA: max 10     │   │  HPA: max 10       │                  │
│  └────────┬─────────┘   └─────────┬──────────┘                  │
│           │  ClusterIP             │ ClusterIP                  │
│           └─────────┬─────────────┘                            │
│                     │ nginx Ingress                             │
└─────────────────────┼───────────────────────────────────────────┘
                      │
         ┌────────────┴──────────────┐
         │                           │
         ▼                           ▼
┌────────────────┐        ┌─────────────────────────────────────┐
│ Azure Container│        │  PostgreSQL 16 Flexible Server      │
│ Registry (ACR) │        │  pg-locationshared-dev              │
│ westeurope     │        │  northeurope (SKU: B_Standard_B1ms) │
│ locationshared │        │  DB: location_shared                │
│ devqx4nh       │        │  Storage: 32 GB                     │
└────────────────┘        └─────────────────────────────────────┘
```

## Azure Resource Group: `rg-locationshared-dev`

| Resource | Type | Location | Purpose |
|---|---|---|---|
| `aks-locationshared-dev` | AKS Cluster | westeurope | Runs all application containers |
| `locationshareddevqx4nh` | Container Registry | westeurope | Stores Docker images |
| `pg-locationshared-dev` | PostgreSQL Flexible Server | **northeurope** | Application database |
| `kvlocationshareddev` | Key Vault | westeurope | Secrets management |
| `law-locationshared-dev` | Log Analytics Workspace | westeurope | Log aggregation |
| `appi-locationshared-dev` | Application Insights | westeurope | APM & distributed tracing |

> **Note**: PostgreSQL is deployed to `northeurope` because the Azure Startup Credit subscription has an offer restriction on PostgreSQL Flexible Server in `westeurope`. See [Troubleshooting](./troubleshooting.md) for full details.

## State Storage: `rg-locationshared-tfstate`

| Resource | Details |
|---|---|
| Storage Account | `stlcsharedtfstate` |
| Container | `tfstate` |
| State Key (dev) | `dev.terraform.tfstate` |
| Location | westeurope |

This resource group is **separate** from the application RG and must exist before any Terraform run.

## Data Flow

### Authentication Flow
```
User
 └─► Google OAuth2 (external)
       └─► Backend /auth/google
             └─► Validate token with Google
                   └─► Issue JWT (secret from K8s Secret / Key Vault)
                         └─► Frontend stores JWT in httpOnly cookie
```

### Location Share Flow
```
Sharing User
 └─► POST /share-codes           → Create share code (UUID)
       └─► Recipient opens URL   → GET /locations/{share_code}
             └─► Returns coordinates ← Redis cache (future)
                                      ← PostgreSQL (current)
```

## Security Model

| Concern | Mechanism |
|---|---|
| CI/CD Azure auth | OIDC federated credential (no stored passwords) |
| AKS → ACR access | AKS kubelet Managed Identity + AcrPull role assignment |
| App secrets | Kubernetes Secrets (created by CI from GitHub Secrets) |
| DB password | GitHub Secret → Kubernetes Secret → env var in pod |
| Key Vault access | AKS Workload Identity (OIDC) |
| Network | Azure CNI + Azure Network Policy (pod-level segmentation) |

## Observability Stack

```
Pods → stdout/stderr
  └─► Log Analytics Workspace (law-locationshared-dev)
        └─► Container Insights (OMS agent on AKS)
              └─► Application Insights (appi-locationshared-dev)
                    └─► Azure Monitor dashboards / alerts
```
