# GitHub Actions CI/CD (Azure + AKS)

Bu dokuman, repoyu GitHub'a push ettikten sonra workflow'larin nasil calisacagini ve hangi secretlarin zorunlu oldugunu detaylandirir.

## Workflow Dosyalari

- `.github/workflows/ci.yml`
  - Frontend build
  - Backend syntax check
  - Terraform fmt/validate
- `.github/workflows/deploy-dev.yml`
  - Dev ortami deploy
- `.github/workflows/deploy-prod.yml`
  - Prod ortami deploy

## Deploy Akis Sirası

1. Azure OIDC login
2. Terraform apply
3. Terraform output degerlerini al
4. ACR login + image build/push
5. AKS credentials cek
6. K8s app-secrets upsert
7. `infra/k8s/base` manifestlerini uygula
8. Rollout status ile deploy dogrula

## OIDC Secretlari (zorunlu)

Tum deploy workflowlari icin:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

## Dev Secretlari

- `POSTGRES_ADMIN_USERNAME_DEV`
- `POSTGRES_ADMIN_PASSWORD_DEV`
- `APP_DB_USER_DEV` (opsiyonel)
- `APP_DB_PASSWORD_DEV` (opsiyonel, yoksa admin password fallback)
- `SECRET_KEY_DEV`
- `GOOGLE_CLIENT_ID_DEV`
- `STRIPE_SECRET_KEY_DEV`
- `STRIPE_WEBHOOK_SECRET_DEV`
- `STRIPE_PRO_PRICE_ID_DEV`

## Prod Secretlari

- `POSTGRES_ADMIN_USERNAME_PROD`
- `POSTGRES_ADMIN_PASSWORD_PROD`
- `APP_DB_USER_PROD` (opsiyonel)
- `APP_DB_PASSWORD_PROD` (opsiyonel, yoksa admin password fallback)
- `SECRET_KEY_PROD`
- `GOOGLE_CLIENT_ID_PROD`
- `STRIPE_SECRET_KEY_PROD`
- `STRIPE_WEBHOOK_SECRET_PROD`
- `STRIPE_PRO_PRICE_ID_PROD`

## Pipeline Nasil Parametre Uretiyor?

Workflow, Terraform apply sonrasi su outputlari alir:

- `resource_group_name`
- `aks_name`
- `acr_name`
- `acr_login_server`
- `postgres_fqdn`

Bu degerlerle:

- AKS context dinamik baglanir.
- Image push hedefi dinamik belirlenir.
- DB baglanti URL'si runtime'da uretilir.

## Branch ve Environment Stratejisi (onerilen)

- `main` -> dev deploy
- `workflow_dispatch` + approval -> prod deploy

Ek oneri:

- GitHub Environments kullan (`dev`, `prod`)
- `deploy-prod` icin required reviewers aktif et

## Sık Yapilan Hatalar

- OIDC federated credential subject hatasi
- Eksik secret nedeniyle K8s secret olusturma hatasi
- Terraform output alinmadan deploy step'ine gecme
- `infra/k8s/base` path degisikligi sonrasi eski path kullanimi