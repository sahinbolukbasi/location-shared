# Dev Deploy Adim Adim Workflow Debug Rehberi

Bu rehber, ilk deploy-dev denemesinde loglari asama asama okuyup hizli sorun bulmak icin kullanilir.

## 0) Baslangic Kriterleri

- .github/workflows/deploy-dev.yml repoda mevcut
- OIDC ve dev secretlari tanimli
- Terraform kodu validate oluyor

## 1) Workflow Tetikleme

Secenek A: GitHub UI
- Actions > deploy-dev > Run workflow

Secenek B: GitHub CLI
- gh workflow run deploy-dev.yml --ref main

## 2) Log Takip (Canli)

- gh run list --workflow deploy-dev.yml --limit 1
- gh run view <run-id> --log

Adim adim bakilacak bolumler:

1. Azure login with OIDC
- Beklenen: basarili login
- Hata olursa:
  - AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID kontrol et
  - Federated credential subject eslesmesini kontrol et

2. Terraform Apply (dev)
- Beklenen: apply tamamlanir, outputlar yazilir
- Kritik outputlar:
  - resource_group_name
  - aks_name
  - acr_name
  - acr_login_server
  - postgres_fqdn
- Hata olursa:
  - quota, naming conflict, secret kaynakli var overridelari kontrol et

3. Build and push backend image
4. Build and push frontend image
- Beklenen: iki image de ACR'a push edilir
- Hata olursa:
  - az acr login adimini ve acr_name outputunu kontrol et

5. Get AKS context
- Beklenen: kubectl context guncellenir
- Hata olursa:
  - resource_group_name ve aks_name outputlarini kontrol et

6. Upsert Kubernetes app secrets
- Beklenen: app-secrets olusur veya guncellenir
- Hata olursa:
  - eksik dev secret var mi kontrol et
  - DATABASE_URL olusumu icin postgres_fqdn dolu mu kontrol et

7. Deploy manifests
- Beklenen:
  - infra/k8s/base manifestleri apply olur
  - backend/frontend rollout status completed olur
- Hata olursa:
  - image pull, probe, secret, ingress adimlarini asagidaki komutlarla incele

## 3) Basarisiz Deploy Sonrasi Hemen Calisacak Komutlar

- kubectl get pods -n location-shared
- kubectl get deploy -n location-shared
- kubectl describe pod <pod-adi> -n location-shared
- kubectl logs deploy/backend -n location-shared --tail=200
- kubectl logs deploy/frontend -n location-shared --tail=200
- kubectl get events -n location-shared --sort-by=.lastTimestamp

## 4) Sinyal Bazli Kisa Teshis

- ImagePullBackOff
  - ACR push/tag kontrol et
  - deployment image adresi dogru mu kontrol et
- CrashLoopBackOff
  - app-secrets ve DATABASE_URL kontrol et
- Readiness/Liveness fail
  - backend /health, frontend / probe pathlerini kontrol et
- Ingress ulasilamiyor
  - ingress host ve DNS eslesmesi kontrol et

## 5) Basarili Deploy Kriteri

- backend rollout completed
- frontend rollout completed
- kubectl get pods -n location-shared ciktisinda podlar Running/Ready
- uygulama hostlari yanit veriyor

## 6) Debug Otomasyon Onerisi

Ilk denemeden sonra su iki adimi workflow sonuna eklemek faydali olur:

- Hata durumunda son 200 satir pod loglarini yazdirma
- Hata durumunda kubectl get events ciktisini artifact olarak saklama
