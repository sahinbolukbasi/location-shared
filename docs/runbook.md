# Operasyon Kılavuzu (Runbook)

Günlük operasyon görevleri, olaylar ve cluster yeniden kurulum senaryoları için pratik komutlar.

---

## Hızlı Durum Kontrolü

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
