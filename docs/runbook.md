# Operations Runbook

Practical reference for day-to-day operations, incident response, and cluster recovery procedures.

---

## Quick Status Check

```bash
# Connect to the cluster
az aks get-credentials --resource-group rg-locationshared-dev --name aks-locationshared-dev --overwrite-existing

# Pod health
kubectl get pods -n location-shared
kubectl get pods -n ingress-nginx

# Services and Ingress
kubectl get svc,ingress -n location-shared

# Confirm nginx LoadBalancer IP
kubectl get svc -n ingress-nginx ingress-nginx-controller

# Application health
curl -s http://api.location-shared.4.231.68.185.sslip.io/health
curl -s -o /dev/null -w "%{http_code}" http://location-shared.4.231.68.185.sslip.io
```

---

## CI/CD Operations

### Trigger a Dev Deploy

```bash
# Automatic: every push to main triggers deploy-dev.yml

# Trigger manually via GitHub CLI
gh workflow run deploy-dev.yml --repo sahinbolukbasi/location-shared

# Re-run a failed job
gh run rerun <run-id> --repo sahinbolukbasi/location-shared

# Check recent pipeline runs
gh run list --workflow=deploy-dev.yml --repo sahinbolukbasi/location-shared --limit 5
```

### Trigger a Prod Deploy

```bash
# Prod deploys are manual-only (no push trigger)
gh workflow run deploy-prod.yml --repo sahinbolukbasi/location-shared
```

---

## Terraform Local Run

```bash
cd infra

# Authenticate
az login
az account set --subscription 4cf0d74f-7f78-413f-a9aa-9f97c39114d1

# Init for dev (pulls state from Azure Blob)
terraform init -backend-config="key=dev.terraform.tfstate" -reconfigure

# Preview changes
terraform plan \
  -var-file=environments/dev.tfvars \
  -var=postgres_admin_password=<PASSWORD>

# Apply changes
terraform apply \
  -var-file=environments/dev.tfvars \
  -var=postgres_admin_password=<PASSWORD>

# Prod — same pattern, different state key
terraform init -backend-config="key=prod.terraform.tfstate" -reconfigure
terraform apply -var-file=environments/prod.tfvars -var=postgres_admin_password=<PASSWORD>
```

---

## Kubernetes Operations

### View Pod Logs

```bash
# Backend logs (live stream)
kubectl logs -f deployment/backend -n location-shared

# Frontend logs
kubectl logs -f deployment/frontend -n location-shared

# nginx Ingress Controller logs
kubectl logs -f deployment/ingress-nginx-controller -n ingress-nginx

# Last 100 lines
kubectl logs deployment/backend -n location-shared --tail=100
```

### Rolling Restart

```bash
# Restart a deployment (zero-downtime rolling update)
kubectl rollout restart deployment/backend -n location-shared
kubectl rollout restart deployment/frontend -n location-shared

# Monitor rollout progress
kubectl rollout status deployment/backend -n location-shared

# Restart all deployments in namespace at once
kubectl rollout restart deployment --namespace location-shared
```

### Update Application Secrets

```bash
# View current secret values (base64-decoded)
kubectl get secret app-secrets -n location-shared -o json | jq '.data | map_values(@base64d)'

# Upsert secrets (same pattern as CI — safe to re-run)
kubectl create secret generic app-secrets \
  --namespace location-shared \
  --from-literal=SECRET_KEY="<value>" \
  --from-literal=DATABASE_URL="postgresql+psycopg://user:pass@fqdn:5432/location_shared" \
  --from-literal=GOOGLE_CLIENT_ID="<value>" \
  --from-literal=STRIPE_SECRET_KEY="<value>" \
  --from-literal=STRIPE_WEBHOOK_SECRET="<value>" \
  --from-literal=STRIPE_PRO_PRICE_ID="<value>" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Update ConfigMap

```bash
kubectl apply -f infra/k8s/base/configmap.yaml

# Restart pods to pick up the new ConfigMap values
kubectl rollout restart deployment/backend deployment/frontend -n location-shared
```

---

## nginx Ingress Controller — Reinstall After Cluster Recreation

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz

# Watch for the LoadBalancer IP to be assigned (may take 1–3 min)
kubectl get svc -n ingress-nginx ingress-nginx-controller --watch
```

> **If the IP changes**: Update all sslip.io references in `infra/k8s/base/ingress.yaml` and `infra/k8s/base/configmap.yaml` to the new IP, then re-apply both files.

---

## Database Operations

### Test Connectivity

```bash
# Run a quick connectivity check from inside a backend pod
kubectl exec -it deployment/backend -n location-shared -- \
  python -c "import psycopg; conn = psycopg.connect('postgresql://...'); print('OK')"

# Get the PostgreSQL FQDN from Terraform output
cd infra && terraform output postgres_fqdn
```

### Run a Database Migration

```bash
kubectl exec -it deployment/backend -n location-shared -- alembic upgrade head
```

---

## ACR Image Management

```bash
# List all repositories in the registry
az acr repository list --name locationshareddevqx4nh

# Show the 10 most recent backend image tags
az acr repository show-tags \
  --name locationshareddevqx4nh \
  --repository location-shared-backend \
  --orderby time_desc \
  --top 10

# Delete a specific image by tag
az acr repository delete \
  --name locationshareddevqx4nh \
  --image location-shared-backend:<SHA> \
  --yes
```

---

## Setting Prod GitHub Secrets

Before running the prod pipeline, ensure all secrets are set. Enter sensitive values directly in the terminal prompt (do not pass them as CLI arguments):

```bash
gh secret set POSTGRES_ADMIN_PASSWORD_PROD --repo sahinbolukbasi/location-shared
gh secret set APP_DB_PASSWORD_PROD --repo sahinbolukbasi/location-shared
gh secret set SECRET_KEY_PROD --repo sahinbolukbasi/location-shared
gh secret set GOOGLE_CLIENT_ID_PROD --repo sahinbolukbasi/location-shared
gh secret set STRIPE_SECRET_KEY_PROD --repo sahinbolukbasi/location-shared
gh secret set STRIPE_WEBHOOK_SECRET_PROD --repo sahinbolukbasi/location-shared
gh secret set STRIPE_PRO_PRICE_ID_PROD --repo sahinbolukbasi/location-shared
```

Verify all secrets are present:
```bash
gh secret list --repo sahinbolukbasi/location-shared
```

---

## Disaster Recovery

### Terraform State Corruption

If the Terraform state is lost or corrupted, re-import existing Azure resources before applying:

```bash
cd infra
terraform init -backend-config="key=dev.terraform.tfstate" -reconfigure

RG="rg-locationshared-dev"
SUB=$(az account show --query id -o tsv)
PG="pg-locationshared-dev"
PG_BASE="/subscriptions/${SUB}/resourceGroups/${RG}/providers/Microsoft.DBforPostgreSQL/flexibleServers/${PG}"

terraform import \
  -var-file=environments/dev.tfvars \
  -var=postgres_admin_password=<PASSWORD> \
  module.postgres.azurerm_postgresql_flexible_server.this "${PG_BASE}"

# Then apply normally
terraform apply -var-file=environments/dev.tfvars -var=postgres_admin_password=<PASSWORD>
```

See the full import block list in [github-actions.md](./github-actions.md#step-4-terraform-apply) — the CI pipeline already handles all 4 importable resources.

```bash
# AKS kimlik bilgilerini al
az aks get-credentials --resource-group rg-locationshared-dev --name aks-locationshared-dev --overwrite-existing

# Tüm pod'ların durumu
kubectl get pods -n location-shared
kubectl get pods -n ingress-nginx

# Servis ve Ingress durumu
kubectl get svc,ingress -n location-shared

# nginx LoadBalancer IP kontrolü
kubectl get svc -n ingress-nginx ingress-nginx-controller

# Uygulama sağlık kontrolü
curl -s http://api.location-shared.4.231.68.185.sslip.io/health
curl -s -o /dev/null -w "%{http_code}" http://location-shared.4.231.68.185.sslip.io
```

---

## CI/CD Pipeline

### Dev Deploy Tetikleme

```bash
# Otomatik: main'e her push'ta tetiklenir

# Manuel tetikleme (GitHub CLI)
gh workflow run deploy-dev.yml --repo sahinbolukbasi/location-shared

# Başarısız run'ı yeniden dene
gh run rerun <run-id> --repo sahinbolukbasi/location-shared

# Son run durumu
gh run list --workflow=deploy-dev.yml --repo sahinbolukbasi/location-shared --limit 5
```

### Prod Deploy Tetikleme

```bash
# Sadece manuel tetikleme (push ile otomatik çalışmaz)
gh workflow run deploy-prod.yml --repo sahinbolukbasi/location-shared
```

---

## Terraform Yerel Çalıştırma

```bash
cd infra

# Azure'a giriş
az login
az account set --subscription 4cf0d74f-7f78-413f-a9aa-9f97c39114d1

# Dev ortamı için init
terraform init -backend-config="key=dev.terraform.tfstate" -reconfigure

# Plan (sadece değişiklikleri göster)
terraform plan \
  -var-file=environments/dev.tfvars \
  -var=postgres_admin_password=<PAROLA>

# Uygula
terraform apply \
  -var-file=environments/dev.tfvars \
  -var=postgres_admin_password=<PAROLA>

# Prod için aynı işlem, farklı state key
terraform init -backend-config="key=prod.terraform.tfstate" -reconfigure
terraform apply -var-file=environments/prod.tfvars -var=postgres_admin_password=<PAROLA>
```

---

## Kubernetes Operasyonları

### Pod Log İnceleme

```bash
# Backend log'ları (canlı)
kubectl logs -f deployment/backend -n location-shared

# Frontend log'ları
kubectl logs -f deployment/frontend -n location-shared

# nginx Ingress Controller log'ları
kubectl logs -f deployment/ingress-nginx-controller -n ingress-nginx

# Son 100 satır
kubectl logs deployment/backend -n location-shared --tail=100
```

### Pod Yeniden Başlatma

```bash
# Deployment'ı rolling restart ile yeniden başlat
kubectl rollout restart deployment/backend -n location-shared
kubectl rollout restart deployment/frontend -n location-shared

# Rollout durumunu takip et
kubectl rollout status deployment/backend -n location-shared
```

### Uygulama Secret'larını Güncelleme

```bash
# Mevcut secret içeriğini görüntüle
kubectl get secret app-secrets -n location-shared -o json | jq '.data | map_values(@base64d)'

# Secret'ı yeniden oluştur (CI ile aynı upsert pattern)
kubectl create secret generic app-secrets \
  --namespace location-shared \
  --from-literal=SECRET_KEY="<yeni-deger>" \
  --from-literal=DATABASE_URL="postgresql+psycopg://user:pass@fqdn:5432/location_shared" \
  --from-literal=GOOGLE_CLIENT_ID="<deger>" \
  --from-literal=STRIPE_SECRET_KEY="<deger>" \
  --from-literal=STRIPE_WEBHOOK_SECRET="<deger>" \
  --from-literal=STRIPE_PRO_PRICE_ID="<deger>" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### ConfigMap Güncelleme

```bash
kubectl apply -f infra/k8s/base/configmap.yaml

# Güncellemenin pod'lara yansıması için deployment'ı restart et
kubectl rollout restart deployment/backend deployment/frontend -n location-shared
```

---

## nginx Ingress Controller Kurulumu (Cluster Yeniden Kurulumda)

```bash
# nginx Ingress Controller'ı kur (LB health probe fix dahil)
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz

# LoadBalancer IP'nin atanmasını bekle (1-3 dk sürebilir)
kubectl get svc -n ingress-nginx ingress-nginx-controller --watch

# IP atandıktan sonra, ingress.yaml ve configmap.yaml içindeki IP'yi güncelle
# (4.231.68.185 yerine yeni IP)
```

> **⚠️ Dikkat**: Yeni IP atanırsa `infra/k8s/base/ingress.yaml` ve `infra/k8s/base/configmap.yaml` dosyalarındaki tüm sslip.io referansları yeni IP ile güncellenmelidir.

---

## Veritabanı Operasyonları

### PostgreSQL Bağlantı Testi

```bash
# Pod içinden bağlantı testi
kubectl exec -it deployment/backend -n location-shared -- \
  python -c "import psycopg; conn = psycopg.connect('postgresql://...'); print('OK')"

# PostgreSQL FQDN'i Terraform output'undan al
cd infra && terraform output postgres_fqdn
```

### Veritabanı Migration

```bash
# Backend pod'undan migration çalıştır
kubectl exec -it deployment/backend -n location-shared -- alembic upgrade head
```

---

## ACR Image Yönetimi

```bash
# Tüm image'ları listele
az acr repository list --name locationshareddevqx4nh

# Backend image tag'lerini listele
az acr repository show-tags --name locationshareddevqx4nh --repository location-shared-backend --orderby time_desc --top 10

# Eski image'ları temizle (son 5'i tut)
az acr repository delete --name locationshareddevqx4nh \
  --image location-shared-backend:<SHA> --yes
```

---

## Prod Ortamı — Gerekli GitHub Secrets

Prod pipeline çalıştırılmadan önce şu secret'ların GitHub'da tanımlanmış olması gerekir:

```bash
# Hassas değerleri içeren secret'lar terminale doğrudan yazılmalıdır:
gh secret set POSTGRES_ADMIN_PASSWORD_PROD --repo sahinbolukbasi/location-shared
gh secret set APP_DB_PASSWORD_PROD --repo sahinbolukbasi/location-shared
gh secret set SECRET_KEY_PROD --repo sahinbolukbasi/location-shared
gh secret set GOOGLE_CLIENT_ID_PROD --repo sahinbolukbasi/location-shared
gh secret set STRIPE_SECRET_KEY_PROD --repo sahinbolukbasi/location-shared
gh secret set STRIPE_WEBHOOK_SECRET_PROD --repo sahinbolukbasi/location-shared
gh secret set STRIPE_PRO_PRICE_ID_PROD --repo sahinbolukbasi/location-shared
```

> Tüm secret'ların durumunu kontrol et:
> ```bash
> gh secret list --repo sahinbolukbasi/location-shared
> ```

---

## Olağandışı Durum Kurtarma

### Terraform State Bozulması

```bash
cd infra
terraform init -backend-config="key=dev.terraform.tfstate" -reconfigure

# Mevcut Azure kaynaklarını state'e import et
RG="rg-locationshared-dev"
SUB=$(az account show --query id -o tsv)

PG="pg-locationshared-dev"
PG_BASE="/subscriptions/${SUB}/resourceGroups/${RG}/providers/Microsoft.DBforPostgreSQL/flexibleServers/${PG}"

terraform import \
  -var-file=environments/dev.tfvars \
  -var=postgres_admin_password=<PAROLA> \
  module.postgres.azurerm_postgresql_flexible_server.this "${PG_BASE}"
```

### Tüm Pod'ları Yeniden Başlatma

```bash
kubectl rollout restart deployment --namespace location-shared
```

### Namespace'i Tamamen Temizleme ve Yeniden Deploy

```bash
kubectl delete namespace location-shared
kubectl apply -f infra/k8s/base/namespace.yaml
# CI pipeline'ı tetikle veya manifests'leri elle uygula
```
