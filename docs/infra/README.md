# Infra Documentation Index

Bu klasor, tum sistemi Azure uzerinde ayaga kaldirmak icin gereken infra + k8s + pipeline dokumantasyonunu tek yerde toplar.

## Dosyalar

- `01-unified-infra-structure.md`:
  - Neden `infra` ve `k8s` ayri degil, neden tek cati altinda.
  - Yeni klasor yapisi.
- `02-terraform-azure-resources.md`:
  - Terraform ile Azure kaynaklarinin nasil yonetildigi.
  - Moduller, outputlar, ortam degiskenleri.
- `03-github-actions-cicd.md`:
  - GitHub Actions ile Terraform apply + image build/push + AKS deploy akisi.
  - Secret listesi.
- `04-runbook-go-live.md`:
  - Sifirdan canliya cikis adimlari.
  - Dogrulama checklisti.
- `05-troubleshooting.md`:
  - En sik deployment hatalari ve cozum adimlari.
- `06-github-secrets-checklist.md`:
  - Tek dosyada GitHub secrets checklist + deger formatlari.
- `07-dev-deploy-debug.md`:
  - Ilk dev deploy denemesinde adim adim workflow log debug rehberi.

## Kisa Ozet

- Azure altyapisi: Terraform (`infra/`)
- Kubernetes manifestleri: `infra/k8s/base/`
- CI/CD: `.github/workflows/deploy-dev.yml`, `.github/workflows/deploy-prod.yml`
- Kurulum sirasi:
  1. OIDC + GitHub secrets
  2. Terraform apply
  3. Image build/push
  4. AKS deploy
  5. Rollout ve health kontrol