# Deployment Guide (AKS + Terraform)

## Prerequisites

- Azure subscription with AKS quota
- GitHub OIDC app registration for Actions
- Terraform 1.7+
- kubectl, az CLI

## 1. Provision infrastructure (local)

```bash
cd infra
terraform init
terraform apply -var-file=environments/dev.tfvars
```

## 2. Build and push images (local)

```bash
ACR_NAME=$(terraform -chdir=infra output -raw acr_name)
ACR_LOGIN_SERVER=$(terraform -chdir=infra output -raw acr_login_server)

az acr login --name "$ACR_NAME"
docker build -t "$ACR_LOGIN_SERVER/location-shared-backend:local" ./backend
docker build -t "$ACR_LOGIN_SERVER/location-shared-frontend:local" ./frontend
docker push "$ACR_LOGIN_SERVER/location-shared-backend:local"
docker push "$ACR_LOGIN_SERVER/location-shared-frontend:local"
```

## 3. Deploy to AKS (local)

```bash
RESOURCE_GROUP=$(terraform -chdir=infra output -raw resource_group_name)
AKS_NAME=$(terraform -chdir=infra output -raw aks_name)
ACR_LOGIN_SERVER=$(terraform -chdir=infra output -raw acr_login_server)

az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$AKS_NAME" --overwrite-existing
kubectl apply -f infra/k8s/base/namespace.yaml
kubectl apply -f infra/k8s/base/configmap.yaml

sed -e "s|REPLACE_ACR_LOGIN_SERVER|$ACR_LOGIN_SERVER|g" -e "s|:latest|:local|g" infra/k8s/base/backend-deployment.yaml | kubectl apply -f -
sed -e "s|REPLACE_ACR_LOGIN_SERVER|$ACR_LOGIN_SERVER|g" -e "s|:latest|:local|g" infra/k8s/base/frontend-deployment.yaml | kubectl apply -f -

kubectl apply -f infra/k8s/base/backend-service.yaml
kubectl apply -f infra/k8s/base/frontend-service.yaml
kubectl apply -f infra/k8s/base/ingress.yaml
kubectl apply -f infra/k8s/base/hpa-backend.yaml
kubectl apply -f infra/k8s/base/pdb.yaml
```

## 4. GitHub Actions rollout

- Configure OIDC secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
- Configure app secrets (dev/prod suffixes):
  - `POSTGRES_ADMIN_USERNAME_DEV`, `POSTGRES_ADMIN_PASSWORD_DEV`
  - `APP_DB_USER_DEV`, `APP_DB_PASSWORD_DEV` (optional, fallback admin credentials)
  - `SECRET_KEY_DEV`, `GOOGLE_CLIENT_ID_DEV`, `STRIPE_SECRET_KEY_DEV`, `STRIPE_WEBHOOK_SECRET_DEV`, `STRIPE_PRO_PRICE_ID_DEV`
  - Production için aynı anahtarların `_PROD` versiyonları
- `deploy-dev` workflow’u çalıştır.

Workflow artık Terraform output’larından ACR/AKS/RG bilgilerini otomatik alır ve manifestleri `infra/k8s/base` altından uygular.
