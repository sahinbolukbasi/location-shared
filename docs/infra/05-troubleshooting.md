# Troubleshooting Playbook

Bu dosya, deploy surecinde en sik gorulen hatalar icin hizli teshis + cozum adimlari verir.

## 1) Terraform Apply Failed

### Belirti

- Workflow `Terraform Apply` adiminda fail.

### Kontrol

```bash
cd infra
terraform validate
terraform plan -var-file=environments/dev.tfvars
```

### Olası Neden

- Eksik veya gecersiz secret
- Azure quota yetersiz
- Resource naming collision

### Cozum

- Secret adlarini workflow ile bire bir esle.
- Farkli region dene veya quota artir.

## 2) OIDC Login Failed

### Belirti

- `azure/login@v2` hatasi, token alinmiyor.

### Kontrol

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` dogru mu?
- Federated credential subject repo/branch ile eslesiyor mu?

### Cozum

- Entra app federated credential ayarini yeniden olustur.

## 3) ACR Push Failed

### Belirti

- `docker push` unauthorized veya name not found.

### Kontrol

- Terraform output `acr_name` ve `acr_login_server` dolu mu?
- `az acr login --name <acr_name>` basarili mi?

### Cozum

- Terraform apply'nin tamamlandigini dogrula.

## 4) AKS Credentials / Kubectl Failed

### Belirti

- `az aks get-credentials` veya `kubectl` baglanti hatasi.

### Kontrol

- RG ve AKS adi Terraform output ile alinmis mi?
- Login olunan subscription dogru mu?

### Cozum

- `az account show` ile subscription dogrula.
- Workflow'da output adlarini kontrol et.

## 5) Pod CrashLoopBackOff

### Belirti

- Backend veya frontend pod surekli restart.

### Kontrol

```bash
kubectl get pods -n location-shared
kubectl logs deploy/backend -n location-shared --tail=200
kubectl describe pod <pod-name> -n location-shared
```

### Olası Neden

- `app-secrets` eksik veya hatali
- DB baglanti URL hatali
- Image tag bulunamiyor

### Cozum

- Secret degerlerini yeniden bas.
- Workflow'da SHA tag ile deploy edildigini dogrula.

## 6) Ingress Calismiyor

### Belirti

- Domain acilmiyor / 404 / timeout.

### Kontrol

```bash
kubectl get ingress -n location-shared
kubectl describe ingress location-shared -n location-shared
```

### Olası Neden

- DNS kaydi ingress endpoint'e yonlenmemis
- Ingress class uyumsuz

### Cozum

- DNS A/CNAME kaydini dogru endpoint'e bagla.

## 7) Secret Upsert Failed

### Belirti

- `kubectl create secret generic app-secrets` adimi fail.

### Kontrol

- Namespace olusmus mu?
- Gerekli secretlar bos mu?

### Cozum

- Workflow logunda hangi literalin bos oldugunu kontrol et.
- Eksik secret'i GitHub ortamina ekle.

## Hizli Komut Seti

```bash
kubectl get all -n location-shared
kubectl get events -n location-shared --sort-by=.lastTimestamp
kubectl rollout status deployment/backend -n location-shared
kubectl rollout status deployment/frontend -n location-shared
```