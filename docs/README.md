# Location Shared — System Documentation

> **Professional reference guide** for the `location-shared` platform. Navigate the sections below to understand how every layer of the system works, from Azure infrastructure to CI/CD pipelines.

---

## Navigation

| Document | Description |
|---|---|
| [Architecture](./architecture.md) | System design, tech stack, component diagram |
| [Azure Setup](./azure-setup.md) | Subscription, Service Principal, OIDC, resource providers |
| [Terraform Infrastructure](./terraform.md) | Module structure, state backend, environments, constraints |
| [GitHub Actions CI/CD](./github-actions.md) | Workflow file walkthrough, OIDC flow, job steps |
| [Pipeline Secrets](./secrets.md) | All GitHub secrets, what each is for, how to set them |
| [Branch Strategy](./branch-strategy.md) | Branch → environment mapping, protection rules |
| [Kubernetes & AKS](./kubernetes.md) | Manifest structure, AKS node pools, ingress, HPA, PDB |
| [Troubleshooting](./troubleshooting.md) | All known errors encountered and how they were fixed |

---

## Project Overview

**Location Shared** is a real-time location sharing web application that lets users share their GPS coordinates with others via unique share codes. Users authenticate with Google OAuth, manage subscriptions via Stripe, and access the service through a modern Next.js frontend backed by a Python FastAPI API.

### High-Level Architecture

```
Browser
  └─► Next.js 14 (TypeScript)  ─── HTTP ──► FastAPI (Python 3.12)
                                                    │
                                             PostgreSQL 16
                                          (Azure Flexible Server)
```

All services run containerized on **Azure Kubernetes Service (AKS)** in `westeurope`, deployed via **GitHub Actions** with a fully automated **Terraform** infrastructure pipeline.

### Key Technologies

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, React 18 |
| Backend | Python 3.12, FastAPI, SQLAlchemy |
| Database | PostgreSQL 16 (Azure Flexible Server — northeurope) |
| Containers | Docker, Azure Container Registry (ACR) |
| Orchestration | Azure Kubernetes Service (AKS) |
| Infrastructure as Code | Terraform (HCL) ≥ 1.7.0, AzureRM ~3.114 |
| CI/CD | GitHub Actions with OIDC (passwordless auth) |
| Observability | Azure Monitor, Log Analytics, Application Insights |
| Secrets | Azure Key Vault, Kubernetes Secrets |

---

## Quick Links

- **GitHub Repository**: [sahinbolukbasi/location-shared](https://github.com/sahinbolukbasi/location-shared)
- **GitHub Actions**: [Actions tab](https://github.com/sahinbolukbasi/location-shared/actions)
- **Azure Subscription**: `Startup-Credit-Demo-Accaount` (`westeurope`)

---

## Repository Structure

```
location-shared/
├── backend/                  # Python FastAPI application
│   ├── app/
│   │   ├── api/routes/       # auth, health, locations, profile, share_codes, subscriptions
│   │   ├── core/             # config, security (JWT)
│   │   ├── db/               # SQLAlchemy session
│   │   ├── models/           # ORM models
│   │   ├── schemas/          # Pydantic schemas
│   │   └── services/         # google_auth, share_code, subscription
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                 # Next.js 14 TypeScript application
│   ├── app/                  # App Router pages (/, /login, /register, /account, /open)
│   ├── components/
│   ├── lib/                  # api.ts, types.ts
│   └── Dockerfile
├── infra/                    # Terraform infrastructure
│   ├── main.tf               # Root module, module calls
│   ├── providers.tf          # AzureRM provider + remote backend
│   ├── variables.tf          # Input variable declarations
│   ├── outputs.tf            # Output exports
│   ├── environments/
│   │   ├── dev.tfvars        # Dev environment values
│   │   └── prod.tfvars       # Prod environment values
│   ├── modules/
│   │   ├── acr/              # Azure Container Registry
│   │   ├── aks/              # Azure Kubernetes Service
│   │   ├── keyvault/         # Azure Key Vault
│   │   ├── observability/    # Log Analytics + Application Insights
│   │   └── postgres/         # PostgreSQL Flexible Server
│   └── k8s/base/             # Kubernetes manifests
├── .github/workflows/
│   ├── deploy-dev.yml        # Main deployment pipeline (push to main)
│   ├── deploy-prod.yml       # Production pipeline
│   └── ci.yml                # Lint / test checks
└── docs/                     # ← You are here
```
