# Branch Strategy

How branches map to environments and how the deployment pipeline is structured.

---

## Branch → Environment Mapping

| Branch | Environment | Pipeline | Auto-deploy |
|---|---|---|---|
| `main` | **dev** | `deploy-dev.yml` | ✅ On every push |
| `prod` | **production** | `deploy-prod.yml` | ✅ On every push |
| `feature/*`, `fix/*`, etc. | — | `ci.yml` (lint/test only) | ❌ |

---

## Workflow

```
feature/my-feature
       │
       │  Pull Request + review
       ▼
     main  ──► deploy-dev.yml ──► Azure (dev environment)
       │
       │  When dev is stable and tested:
       │  git push origin main:prod  (or PR to prod)
       ▼
     prod  ──► deploy-prod.yml ──► Azure (production environment)
```

---

## `main` Branch — Dev Environment

- **Every push** to `main` triggers `deploy-dev.yml`
- Terraform applies any infrastructure changes
- Docker images are built with the new commit SHA
- K8s deployments are rolled out automatically
- Rollout is verified with `kubectl rollout status --timeout=180s`

The dev environment is intended for integration testing and feature validation.

---

## `prod` Branch — Production Environment

- Requires `deploy-prod.yml` (uses `prod.tfvars`)
- Should only receive pushes from `main` after dev validation
- Recommended: configure branch protection rules requiring status checks from `main`

---

## CI Branch (`ci.yml`)

Runs on all branches (including feature branches and PRs). Executes:
- Lint checks
- Unit tests (if configured)
- Static analysis

This ensures code quality before merging to `main`.

---

## Recommended Branch Protection Rules

For `main`:
```
✅ Require status checks to pass before merging
✅ Require branches to be up to date
✅ Require pull request reviews (1 reviewer minimum)
❌ Allow force pushes (disabled)
❌ Allow deletions (disabled)
```

For `prod`:
```
✅ Require status checks to pass (include deploy-dev success)
✅ Restrict who can push directly (only automated merge from main)
❌ Allow force pushes (disabled)
```

---

## Tagging Releases

```bash
# Tag production releases
git tag v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0
```

Docker images are tagged with the commit SHA (e.g., `abc1234`). For production releases, also tag with the semantic version:

```bash
# In deploy-prod.yml, add additional tag:
docker tag <acr>/location-shared-backend:<sha> <acr>/location-shared-backend:v1.0.0
docker push <acr>/location-shared-backend:v1.0.0
```
