# GitHub Secrets Checklist ve Deger Formatlari

Bu dosya, deploy oncesi tek ekrandan kontrol edilecek operasyonel checklisttir.

## 1) OIDC Secretlari (zorunlu)

- AZURE_CLIENT_ID
  - Format: GUID
  - Ornek: 00000000-0000-0000-0000-000000000000
- AZURE_TENANT_ID
  - Format: GUID
  - Ornek: 11111111-1111-1111-1111-111111111111
- AZURE_SUBSCRIPTION_ID
  - Format: GUID
  - Ornek: 22222222-2222-2222-2222-222222222222

## 2) Dev Secretlari (deploy-dev icin)

- POSTGRES_ADMIN_USERNAME_DEV
  - Format: kucuk harfli kullanici adi
  - Ornek: pgadminuser
- POSTGRES_ADMIN_PASSWORD_DEV
  - Format: guclu sifre
  - Oneri: en az 20 karakter, buyuk-kucuk-rakam-sembol
- APP_DB_USER_DEV
  - Format: uygulama db kullanicisi (opsiyonel)
  - Not: bos ise admin username fallback olur
- APP_DB_PASSWORD_DEV
  - Format: uygulama db sifresi (opsiyonel)
  - Not: bos ise admin password fallback olur
- SECRET_KEY_DEV
  - Format: uzun rastgele token
  - Oneri: en az 32 karakter
- GOOGLE_CLIENT_ID_DEV
  - Format: Google OAuth client id
  - Ornek: xxxxx.apps.googleusercontent.com
- STRIPE_SECRET_KEY_DEV
  - Format: Stripe secret key
  - Ornek: sk_test_... veya sk_live_...
- STRIPE_WEBHOOK_SECRET_DEV
  - Format: Stripe webhook secret
  - Ornek: whsec_...
- STRIPE_PRO_PRICE_ID_DEV
  - Format: Stripe price id
  - Ornek: price_...

## 3) Prod Secretlari (deploy-prod icin)

Ayni anahtarlarin _PROD versiyonlari:

- POSTGRES_ADMIN_USERNAME_PROD
- POSTGRES_ADMIN_PASSWORD_PROD
- APP_DB_USER_PROD
- APP_DB_PASSWORD_PROD
- SECRET_KEY_PROD
- GOOGLE_CLIENT_ID_PROD
- STRIPE_SECRET_KEY_PROD
- STRIPE_WEBHOOK_SECRET_PROD
- STRIPE_PRO_PRICE_ID_PROD

## 4) Hizli Dogrulama Checklist

- [ ] OIDC 3 secret tanimli
- [ ] Dev 9 secret tanimli
- [ ] Prod 9 secret tanimli
- [ ] Secret adlari bire bir workflow ile ayni
- [ ] Dev ortami icin test anahtarlari kullaniliyor
- [ ] Prod ortami icin canli anahtarlar kullaniliyor

## 5) Nerede Kullaniliyor?

- deploy-dev workflow: .github/workflows/deploy-dev.yml
- deploy-prod workflow: .github/workflows/deploy-prod.yml

Bu workflowlar Terraform apply sonrasi AKS, ACR ve DB outputlarini alir; sonra bu secretlari kullanarak app-secrets olusturur ve rollout yapar.
