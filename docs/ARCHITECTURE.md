# Architecture

## Stack

- Frontend: Next.js 14 (App Router)
- Backend: FastAPI + SQLAlchemy
- Database: PostgreSQL
- Auth: Google OAuth + Email/Password
- Subscription: Stripe monthly plan ($1)
- Infra: Azure AKS + ACR + PostgreSQL Flexible + Key Vault
- IaC: Terraform
- CI/CD: GitHub Actions

## Core Rules

- Every user owns only their own locations.
- Free users can keep up to 5 saved locations.
- The 6th location requires active paid subscription.
- Share code is 6 digits and expires by default in 7 days.

## Runtime Components

- `frontend` deployment (2+ replicas)
- `backend` deployment (2+ replicas)
- Ingress routes:
  - `location-shared.example.com` -> frontend service
  - `api.location-shared.example.com` -> backend service

## Security Baseline

- JWT bearer auth in API.
- Secrets injected via Kubernetes Secret (target: Key Vault CSI in next phase).
- Stripe webhook signature verification.
- AKS local account disabled and OIDC workload identity enabled.
