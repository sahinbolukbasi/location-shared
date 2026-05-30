# Location Shared — Documentation Hub

> **Status**: Dev environment LIVE — [location-shared.4.231.68.185.sslip.io](http://location-shared.4.231.68.185.sslip.io)

**Location Shared** is a web application that lets authenticated users save GPS coordinates and share them with anyone via short, expiring share codes — no account required on the recipient side. Users authenticate with Google OAuth or email/password, and can upgrade to a Pro subscription via Stripe to unlock unlimited saved locations.

---

## Documentation Index

| Document | What it covers |
|---|---|
| [Architecture](./ARCHITECTURE.md) | Full system design: cloud topology, data flow, security model, observability |
| [API Reference](./api.md) | All REST endpoints, request/response schemas, authentication |
| [CI/CD Pipeline](./github-actions.md) | GitHub Actions workflows, OIDC auth flow, every pipeline step explained |
| [CI/CD & Infrastructure Deep Dive](../infra/CICD.md) | Authoritative reference: Terraform lifecycle, Docker builds, K8s deploy, local Docker Compose, all GitHub Secrets |
| [Infrastructure (Terraform)](./terraform.md) | Module structure, state backend, environment configs, known constraints |
| [Kubernetes & AKS](./kubernetes.md) | Manifest reference, Ingress, HPA, PDB, nginx setup |
| [Backstage Kubernetes Cost Playbook](./backstage-kubernetes-cost.md) | Backstage deployment template, prod freeze/runbook, and AKS cost governance |
| [Backstage Azure Governance](./backstage-azure-governance.md) | Resource inventory model, status/cost visibility, and Terraform + Helm operating flow |
| [Azure Setup](./azure-setup.md) | Service Principal, OIDC federated credential, resource providers, Terraform state bootstrap |
| [Secrets Reference](./secrets.md) | Every GitHub Secret, what it does, how it flows into the application |
| [Branch & Release Strategy](./branch-strategy.md) | Branch → environment mapping, protection rules, tagging |
| [Operations Runbook](./runbook.md) | Day-to-day operations, Terraform commands, kubectl recipes, DB access |
| [Troubleshooting](./troubleshooting.md) | Every known error and its root cause + fix (10 incidents documented) |

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js, TypeScript, React | 14 / 18 |
| Backend | Python, FastAPI, SQLAlchemy | 3.12 / 0.115 |
| Database | PostgreSQL Flexible Server (Azure) | 16 |
| Container Runtime | Docker, Azure Container Registry | — |
| Orchestration | Azure Kubernetes Service (AKS) | — |
| Infrastructure as Code | Terraform, AzureRM provider | ≥ 1.7.0 / ~3.114 |
| CI/CD | GitHub Actions (OIDC — passwordless) | — |
| Observability | Log Analytics, Application Insights | — |
| Secrets | Azure Key Vault, Kubernetes Secrets | — |

---

## Repository Layout

```
location-shared/
├── backend/                        # Python FastAPI application
│   ├── app/
│   │   ├── api/routes/             # auth, health, locations, profile, share_codes, subscriptions
│   │   ├── core/                   # Settings (Pydantic), JWT helpers
│   │   ├── db/                     # SQLAlchemy engine & session factory
│   │   ├── models/                 # ORM models: User, Location, ShareCode, UserProfile, Payment
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   └── services/               # google_auth, share_code, subscription logic
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                       # Next.js 14 TypeScript application
│   ├── app/                        # App Router: /, /login, /register, /account, /open
│   ├── components/
│   ├── lib/                        # api.ts (fetch wrapper), types.ts
│   └── Dockerfile
├── infra/                          # Terraform infrastructure as code
│   ├── main.tf                     # Root module — wires all child modules
│   ├── providers.tf                # AzureRM provider + remote state backend
│   ├── variables.tf                # Input variable declarations
│   ├── outputs.tf                  # Exported values consumed by CI pipeline
│   ├── environments/
│   │   ├── dev.tfvars              # Dev environment values
│   │   └── prod.tfvars             # Production environment values
│   ├── modules/
│   │   ├── acr/                    # Azure Container Registry
│   │   ├── aks/                    # AKS cluster + node pools + AcrPull assignment
│   │   ├── keyvault/               # Azure Key Vault
│   │   ├── observability/          # Log Analytics Workspace + Application Insights
│   │   └── postgres/               # PostgreSQL Flexible Server + database + firewall
│   └── k8s/base/                   # Kubernetes manifests (namespace through ingress)
├── .github/workflows/
│   ├── deploy-dev.yml              # Full deploy pipeline: Terraform → Docker → K8s (push to main)
│   ├── deploy-prod.yml             # Production pipeline (manual dispatch)
│   └── ci.yml                      # Lint & test on all branches
└── docs/                           # ← You are here
```

---

## Quick Reference

```bash
# Get AKS credentials
az aks get-credentials --resource-group rg-locationshared-dev --name aks-locationshared-dev

# Check application health
curl http://api.location-shared.4.231.68.185.sslip.io/health

# Trigger dev deployment manually
gh workflow run deploy-dev.yml --repo sahinbolukbasi/location-shared

# Watch a pipeline run
gh run watch --repo sahinbolukbasi/location-shared
```

| Resource | Value |
|---|---|
| GitHub Repo | [sahinbolukbasi/location-shared](https://github.com/sahinbolukbasi/location-shared) |
| Frontend URL | http://location-shared.4.231.68.185.sslip.io |
| API URL | http://api.location-shared.4.231.68.185.sslip.io |
| API Docs (Swagger) | http://api.location-shared.4.231.68.185.sslip.io/docs |
| Azure Subscription | `Startup-Credit-Demo-Account` — `westeurope` |
