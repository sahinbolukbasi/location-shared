# Terraform ile Azure Kaynaklari

Bu dokuman, bu repodaki Terraform kodunun Azure tarafinda ne kurdugunu ve baglantilarin nasil kuruldugunu anlatir.

## Root Katmani (`infra/`)

Root Terraform su isleri yapar:

1. Resource Group olusturur.
2. Modul cagrilari ile altyapiyi kurar:
   - ACR
   - AKS
   - PostgreSQL Flexible Server
   - Key Vault
   - Log Analytics + Application Insights
3. Outputlar uretir (pipeline tarafinda kullanilir):
   - `resource_group_name`
   - `aks_name`
   - `acr_name`
   - `acr_login_server`
   - `postgres_fqdn`
   - `keyvault_name`

## Modul Bazli Aciklama

### `modules/acr`

- Container image registry olusturur.
- AKS image pull icin kullanilir.
- Kritik outputlar:
  - `acr_name`
  - `acr_login_server`

### `modules/aks`

- AKS cluster olusturur.
- AKS kubelet identity icin ACR pull yetkisini baglar.
- Kritik output:
  - `cluster_name`

### `modules/postgres`

- PostgreSQL Flexible Server + `location_shared` db olusturur.
- Baslangicta public endpoint + Azure services firewall kurali bulunur.

### `modules/keyvault`

- Uygulama secretlarini saklamak icin Key Vault olusturur.
- Su anki workflow secretlari GitHub Secrets'ten K8s secret'a basiyor.
- Bir sonraki asamada CSI driver ile Key Vault -> pod entegrasyonu yapilabilir.

### `modules/observability`

- Log Analytics workspace + App Insights olusturur.
- AKS diagnostic ve uygulama telemetry baglantisi icin temel katman.

## Ortam Dosyalari

- `infra/environments/dev.tfvars`
- `infra/environments/prod.tfvars`

Not:
- Hassas degerleri tfvars icinde tutma.
- CI pipeline adiminda `-var` ile secret gecmek daha guvenli.

## Terraform Komutlari

```bash
cd infra
terraform init
terraform fmt -recursive
terraform validate
terraform plan -var-file=environments/dev.tfvars
terraform apply -var-file=environments/dev.tfvars
```

## Outputlari Pipeline'da Kullanma

Deploy workflow su mantikla calisir:

```bash
terraform output -raw acr_name
terraform output -raw acr_login_server
terraform output -raw resource_group_name
terraform output -raw aks_name
terraform output -raw postgres_fqdn
```

Bu sayede workflow icinde hardcode ad kullanma ihtiyaci kalmaz.

## Guvenlik ve Hardening Onerileri

Kisa vadede:

- Terraform remote state (Azure Storage backend) kullan.
- Prod ortaminda `terraform apply` icin environment approval ac.
- Secret degerlerini sadece GitHub Environment secrets'ta tut.

Orta vadede:

- PostgreSQL private networking + private DNS kullan.
- AKS egress kontrolu icin NAT Gateway / Firewall tasarla.
- Key Vault CSI driver ile pod secret yonetimini merkezi yap.