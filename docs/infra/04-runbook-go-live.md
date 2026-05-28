# Go-Live Runbook (Adim Adim)

Bu runbook ile sistemi Azure uzerinde sifirdan calisir hale getirip GitHub Actions ile deploy edersin.

## A. Once Hazirlik

1. Azure tarafi:
   - Subscription secimi
   - AKS quota kontrolu
2. GitHub tarafi:
   - Repo acik ve workflow yetkileri aktif
   - Environments (`dev`, `prod`) olustur
3. Local tooling:
   - `az`, `kubectl`, `terraform`

## B. OIDC Kurulumu

1. Entra app registration olustur.
2. GitHub repo icin federated credential tanimla.
3. Repo secretlarina su degerleri koy:
   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID`

## C. Secret Kurulumu

Dev ve prod secretlarini `03-github-actions-cicd.md` dosyasina gore eksiksiz gir.

Ozellikle kritikler:

- DB password
- `SECRET_KEY`
- Stripe secretlari

## D. Dry Run (Lokal)

```bash
cd infra
terraform init
terraform validate
terraform plan -var-file=environments/dev.tfvars
```

Sonra CI kontrol:

```bash
gh workflow run ci.yml
```

## E. Dev Deploy

1. Repo'ya push et.
2. `deploy-dev` workflow'unu izle.
3. Basarili ise AKS rollout kontrol et:

```bash
kubectl get pods -n location-shared
kubectl get svc -n location-shared
kubectl get ingress -n location-shared
```

## F. Smoke Test

```bash
kubectl get deploy -n location-shared
kubectl rollout status deployment/backend -n location-shared
kubectl rollout status deployment/frontend -n location-shared
```

Backend health:

```bash
kubectl port-forward svc/backend -n location-shared 8000:80
curl -i http://127.0.0.1:8000/health
```

## G. Prod Deploy

1. Prod environment approval ac.
2. `deploy-prod` workflow'u `workflow_dispatch` ile tetikle.
3. Rollout ve smoke test adimlarini tekrar et.

## H. Go-Live Checklist

- [ ] Terraform apply basarili
- [ ] ACR image push basarili
- [ ] AKS rollout basarili
- [ ] Ingress hostlari dogru
- [ ] Backend health endpoint 200
- [ ] Frontend ana sayfa aciliyor
- [ ] Uygulama DB baglantisi hatasiz
- [ ] Stripe / auth secretlari yuklenmis

## I. Sonraki Iyilestirme Backlog

- Terraform remote backend (Storage Account + state lock)
- Private AKS/API server secenegi
- PostgreSQL private endpoint
- Key Vault CSI ile secret yonetimi
- Blue/Green veya canary release