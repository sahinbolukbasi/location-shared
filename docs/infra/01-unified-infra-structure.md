# Neden Infra ve K8s Tek Klasor Altinda?

## Problem

`infra/` (Terraform) ve `k8s/` (manifest) ayri oldugunda su operasyonel problemler olusur:

- Kaynak sahipligi dagilir:
  - Azure kaynaklarini bir ekip, manifestleri baska ekip gunceller.
- Pipeline path karmasasi olur:
  - Workflow bir yandan `infra`, bir yandan `k8s/base` kullanir.
- Onboarding zorlasir:
  - Yeni gelen birisi "tum deploy neye bagli" sorusuna tek yerden cevap alamaz.
- Drift riski artar:
  - Terraform outputlari ile manifestlerdeki degerler (ACR host, host adlari, namespace vb.) senkron disi kalir.

## Hedef Yaklasim

Tek cati prensibi:

- Tum deployment varliklari `infra/` altinda toplanir.
- Azure provisioning + AKS workload deployment ayni "release birimi" olur.
- CI/CD workflowlari tek root mantigi ile calisir.

## Yeni Klasor Yapisi

```text
infra/
  main.tf
  providers.tf
  variables.tf
  outputs.tf
  environments/
    dev.tfvars
    prod.tfvars
  modules/
    acr/
    aks/
    keyvault/
    observability/
    postgres/
  k8s/
    base/
      namespace.yaml
      configmap.yaml
      backend-deployment.yaml
      backend-service.yaml
      frontend-deployment.yaml
      frontend-service.yaml
      ingress.yaml
      hpa-backend.yaml
      pdb.yaml
      secrets.example.yaml
```

## Operasyonel Kazanim

- Tek bakisla sistemin tam deploy resmi gorulur.
- CI/CD pathleri sabitlenir (`infra/k8s/base`).
- Terraform output -> deploy akisi standardize edilir.
- Dokumantasyon merkezi olur (`docs/infra`).

## Sorumluluk Sinirlari

- Terraform:
  - Azure kaynak olusturma ve baglantilari.
  - AKS, ACR, PostgreSQL, Key Vault, observability.
- Kubernetes manifestleri:
  - Uygulama runtime yapisi (deployment, service, ingress, hpa, pdb).
- GitHub Actions:
  - Terraform apply,
  - image build/push,
  - AKS rollout.