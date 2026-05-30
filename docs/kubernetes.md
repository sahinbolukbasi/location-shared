# Kubernetes & AKS — Tam Mimari Rehberi

Bu belge, Location Shared uygulamasının Kubernetes üzerinde nasıl çalıştığını **sıfırdan** açıklar.
Temel kavramlardan başlayıp Namespace izolasyonu, Pod yaşam döngüsü, Secrets, Storage,
Network Policy, Ingress, Helm ve Event takibine kadar tüm katmanları gerçek manifest örnekleriyle
ele alır.

> **Okuma kılavuzu:** Her başlık bir öncekinin üzerine inşa edilir.
> Kubernetes'e yeni başlıyorsanız baştan okuyun.
> Belirli bir konuya bakıyorsanız İçindekiler'i kullanın.

---

## İçindekiler

1. [Büyük Resim — Bileşenler Bir Arada](#1-büyük-resim--bileşenler-bir-arada)
2. [Namespace — İzolasyon Katmanı](#2-namespace--izolasyon-katmanı)
3. [Workloads — Pod ve Deployment](#3-workloads--pod-ve-deployment)
4. [Configuration — ConfigMap ve Secrets](#4-configuration--configmap-ve-secrets)
5. [Storage — Kalıcı Diskler](#5-storage--kalıcı-diskler)
6. [Network Policies — Pod Düzeyinde Güvenlik Duvarı](#6-network-policies--pod-düzeyinde-güvenlik-duvarı)
7. [Services — Cluster İçi Trafik](#7-services--cluster-içi-trafik)
8. [Ingress — Dışarıdan Gelen Trafik](#8-ingress--dışarıdan-gelen-trafik)
9. [Scaling — HPA ve PDB](#9-scaling--hpa-ve-pdb)
10. [Helm — Paket Yöneticisi](#10-helm--paket-yöneticisi)
11. [Events — Gerçek Zamanlı Teşhis](#11-events--gerçek-zamanlı-teşhis)
12. [AKS Node Pool Mimarisi](#12-aks-node-pool-mimarisi)
13. [Workload Identity — Secretsız Azure Erişimi](#13-workload-identity--secretsız-azure-erişimi)
14. [Manifest Dosyaları Referansı](#14-manifest-dosyaları-referansı)
15. [Günlük Operasyon Komutları](#15-günlük-operasyon-komutları)

---

## 1. Büyük Resim — Bileşenler Bir Arada

Aşağıdaki şema, dışarıdan gelen bir HTTP isteğinin uygulama pod'una ulaşana kadar
hangi Kubernetes katmanlarından geçtiğini gösterir.

```
İnternet
   │  HTTP :80
   ▼
Azure Load Balancer  (IP: 4.231.68.185)
   │  NodePort
   ▼
nginx Ingress Controller Pod  (namespace: ingress-nginx)
   │  Host-based routing
   ├──► location-shared.4.231.68.185.sslip.io
   │         │  ClusterIP :80
   │         ▼
   │    Service: frontend  ──► frontend Pod(s)  :3000
   │                            └── envFrom: app-config (ConfigMap)
   │                            └── envFrom: app-secrets (Secret)
   │
   └──► api.location-shared.4.231.68.185.sslip.io
             │  ClusterIP :80
             ▼
        Service: backend  ──► backend Pod(s)  :8000
                               └── envFrom: app-config (ConfigMap)
                               └── envFrom: app-secrets (Secret)
                               └── connects to: PostgreSQL (Azure, northeurope)

Tüm bu kaynaklar: Namespace → location-shared
```

Her katmanın detaylı açıklaması aşağıdaki bölümlerde yer alır.

---

## 2. Namespace — İzolasyon Katmanı

### Namespace Nedir?

Kubernetes'te her şey bir Namespace içinde yaşar. Namespace'i bir **sanal küme**
olarak düşünebilirsiniz: aynı fiziksel Kubernetes cluster içinde birden fazla proje ya
da ortam, birbirinden habersiz şekilde çalışabilir.

**Namespace sağladıkları:**

| Özellik | Açıklama |
|---|---|
| **İsim izolasyonu** | `backend` adlı bir Service başka bir Namespace'deki `backend` ile çakışmaz |
| **RBAC kapsamı** | Kullanıcı ve servis hesabı izinleri Namespace bazında kısıtlanabilir |
| **Resource Quota** | CPU / Memory limitleri Namespace genelinde uygulanabilir |
| **Network Policy** | Pod'lar arası trafik Namespace sınırlarında filtrelenebilir |

### Bu Projede Kullanım

```yaml
# infra/k8s/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: location-shared
```

Uygulamanın tüm bileşenleri (Deployment, Service, Ingress, HPA, PDB, ConfigMap, Secret)
`location-shared` Namespace içinde yaşar. `kube-system` ya da `ingress-nginx` gibi
sistem Namespace'leri bunlardan tamamen bağımsızdır.

### Namespace Oluşturma

CI/CD pipeline her deploy öncesinde şu komutu çalıştırır:

```bash
kubectl apply -f infra/k8s/base/namespace.yaml
```

`apply` komutu idempotent'tir — Namespace zaten varsa hiçbir şey yapmaz.

---

## 3. Workloads — Pod ve Deployment

### Pod Nedir?

Pod, Kubernetes'in en küçük çalışma birimidir. İçinde bir ya da birden fazla
container barındırır. Bu projede her Pod tek bir container içerir.

Ancak Pod'ları direkt oluşturmazsınız — kaza ile silinirse yerine yenisi gelmez.
Bunun yerine **Deployment** kullanırsınız.

### Deployment Nedir?

Deployment, kaç Pod'un çalışması gerektiğini tanımlar ve bu sayıyı sürekli sağlar.
Bir Pod çökerse Deployment Controller anında yeni bir Pod başlatır.

```
Deployment: backend (replicas: 2)
   ├── ReplicaSet (Kubernetes'in otomatik oluşturduğu ara kaynak)
   │     ├── Pod: backend-7f9d4c-x8k2p   (Node 1)
   │     └── Pod: backend-7f9d4c-m3nqr   (Node 2)
   └── Yeni deploy → yeni ReplicaSet (eski kademeli kapatılır)
```

### Backend Deployment Manifestı

```yaml
# infra/k8s/base/backend-deployment.yaml (sadeleştirilmiş)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: location-shared
spec:
  replicas: 2                          # Her zaman 2 Pod çalıştır
  selector:
    matchLabels:
      app: backend                     # Bu etiketli Pod'ları yönet
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: REPLACE_ACR_LOGIN_SERVER/location-shared-backend:latest
          # ↑ CI pipeline bu placeholder'ı gerçek ACR adresi ve git SHA ile değiştirir
          ports:
            - containerPort: 8000

          # Yapılandırma: ConfigMap + Secret (Bölüm 4'te açıklanır)
          envFrom:
            - configMapRef:
                name: app-config
            - secretRef:
                name: app-secrets

          # Sağlık kontrolleri
          readinessProbe:              # Pod trafik almaya hazır mı?
            httpGet:
              path: /health/ready
              port: 8000
            initialDelaySeconds: 10   # Container başlar başlamaz sorma, 10 sn bekle
            periodSeconds: 10         # Her 10 sn'de bir kontrol et

          livenessProbe:              # Pod hâlâ yaşıyor mu? (sonsuz döngü / deadlock tespiti)
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 20
            periodSeconds: 20

          # Kaynak limitleri (Bölüm 12'de açıklanır)
          resources:
            requests:
              cpu: "100m"             # 0.1 vCPU talep et (scheduler kararı için)
              memory: "256Mi"
            limits:
              cpu: "500m"             # En fazla 0.5 vCPU kullanabilir
              memory: "512Mi"
```

### Readiness vs Liveness Probe Farkı

| Probe | Başarısız olursa | Kullanım amacı |
|---|---|---|
| **readinessProbe** | Pod Service'ten çıkarılır, trafik gelmez | Yavaş başlayan container'lar (DB bağlantısı kurulana kadar) |
| **livenessProbe** | Pod yeniden başlatılır | Deadlock / donma tespiti |

### Rolling Update (Kademeli Güncelleme)

Yeni bir image deploy edildiğinde Kubernetes mevcut Pod'ları hemen kapatmaz:

```
Eski ReplicaSet (image: backend:abc123)   Yeni ReplicaSet (image: backend:def456)
   Pod 1 ✓                                   Pod 1 (başlatılıyor...)
   Pod 2 ✓                                   Pod 2 (bekliyor)

→ Yeni Pod 1 Ready olunca eski Pod 1 kapatılır
→ Yeni Pod 2 Ready olunca eski Pod 2 kapatılır
```

Bu sayede deploy sırasında kullanıcılar kesinti yaşamaz.

---

## 4. Configuration — ConfigMap ve Secrets

### ConfigMap — Hassas Olmayan Yapılandırma

ConfigMap, şifre içermeyen ayarları (URL'ler, bayraklar, prefix'ler) Pod'lara
ortam değişkeni olarak iletmek için kullanılır.

```yaml
# infra/k8s/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: location-shared
data:
  NEXT_PUBLIC_API_BASE_URL: http://api.location-shared.4.231.68.185.sslip.io
  CORS_ORIGINS: http://location-shared.4.231.68.185.sslip.io
  API_V1_PREFIX: /api/v1
```

> **Önemli not:** `NEXT_PUBLIC_API_BASE_URL` burada referans amacıyla tutulmaktadır.
> Next.js, `NEXT_PUBLIC_*` değişkenlerini **derleme zamanında** JS bundle'a gömer.
> Bu nedenle asıl değer `docker build --build-arg` ile Dockerfile'a geçirilir.
> ConfigMap'teki değer çalışma zamanında backend pod'larının CORS ayarı için kullanılır.

### Secret — Hassas Bilgiler

Secret, ConfigMap ile aynı yapıya sahiptir ama Kubernetes tarafından `etcd`'de
base64 kodlanmış olarak saklanır ve RBAC ile erişimi kısıtlanabilir.

CI/CD pipeline `app-secrets` adlı Secret'ı idempotent şekilde oluşturur/günceller:

```bash
kubectl create secret generic app-secrets \
  --namespace location-shared \
  --from-literal=SECRET_KEY="<jwt-imzalama-anahtarı>" \
  --from-literal=DATABASE_URL="postgresql+psycopg://user:pass@pg-fqdn:5432/location_shared" \
  --from-literal=GOOGLE_CLIENT_ID="<google-oauth-client-id>" \
  --from-literal=STRIPE_SECRET_KEY="<stripe-api-key>" \
  --from-literal=STRIPE_WEBHOOK_SECRET="<stripe-webhook-secret>" \
  --from-literal=STRIPE_PRO_PRICE_ID="<stripe-price-id>" \
  --dry-run=client -o yaml | kubectl apply -f -
```

**`--dry-run=client -o yaml | kubectl apply -f -` kalıbı ne yapar?**

```
kubectl create ... --dry-run=client   → komutu çalıştırma, sadece YAML üret
kubectl apply -f -                    → üretilen YAML'ı uygula (varsa güncelle, yoksa oluştur)
```

Bu idempotent upsert desenidir: aynı komutu kaç kez çalıştırırsanız çalıştırın
sonuç aynıdır ve mevcut Secret silinip yeniden oluşturulmaz.

### Pod'a Değer İletme

```yaml
# Deployment spec içinde:
envFrom:
  - configMapRef:
      name: app-config      # app-config'deki tüm key'ler env var olur
  - secretRef:
      name: app-secrets     # app-secrets'teki tüm key'ler env var olur
```

Backend pod içinde `echo $DATABASE_URL` dediğinizde Secret'taki değeri görürsünüz.

### Secret Güvenlik Notları

- Secret değerleri `kubectl get secret app-secrets -o yaml` ile base64 decode
  edilerek görülebilir — bu bir şifreleme değil, sadece encoding.
- Gerçek şifreleme için Azure Key Vault + Workload Identity kullanın (Bölüm 13).
- `secrets.example.yaml` dosyası hiçbir zaman gerçek değer içermez, sadece şema
  referansıdır ve source control'e commit'lenebilir.

---

## 5. Storage — Kalıcı Diskler

### Bu Projede Durum

Mevcut kurulumda uygulama bileşenleri (backend, frontend) **stateless**'tır —
Pod'ların disk yazmasına gerek yoktur:

- **Backend** tüm durumu PostgreSQL'de saklar (Azure Flexible Server, Kubernetes
  dışında çalışır).
- **Frontend** Next.js standalone modunda çalışır, kalıcı depolama gerektirmez.

Bu nedenle `PersistentVolumeClaim` (PVC) manifest dosyalarında bulunmamaktadır.

### Ne Zaman PVC Gerekir?

Eğer ileride PostgreSQL cluster içine taşınırsa ya da dosya yükleme özelliği
eklenirse aşağıdaki yapı kullanılır:

```yaml
# Örnek — Azure Disk ile kalıcı depolama
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: location-shared
spec:
  accessModes:
    - ReadWriteOnce           # Aynı anda tek bir Node okuyabilir/yazabilir
  storageClassName: managed-csi  # AKS'te Azure Disk sağlayıcısı
  resources:
    requests:
      storage: 32Gi
```

AKS'te kullanılabilir `storageClassName` değerleri:

| StorageClass | Disk Tipi | Kullanım |
|---|---|---|
| `managed-csi` | Azure Standard SSD | Genel amaçlı |
| `managed-csi-premium` | Azure Premium SSD | Yüksek IOPS (veritabanı) |
| `azurefile-csi` | Azure File Share | `ReadWriteMany` (birden fazla Pod) |

---

## 6. Network Policies — Pod Düzeyinde Güvenlik Duvarı

### Network Policy Nedir?

Varsayılan olarak bir Namespace içindeki tüm Pod'lar birbirleriyle serbestçe
haberleşebilir. Network Policy bu açık kapıyı kapatır: hangi Pod hangi Pod'a
hangi port üzerinden bağlanabilir, bunu iptables seviyesinde tanımlarsınız.

### Bu Projede Yapılandırma

AKS cluster'ı `network_policy = "azure"` ile yapılandırılmıştır (`modules/aks/main.tf`).
Bu, Azure Network Policy Manager'ı etkinleştirir — manifest uygulandığında kurallar
anında devreye girer.

Mevcut durum: Manifest deposunda Network Policy dosyası bulunmamaktadır, yani
`location-shared` Namespace içinde tüm Pod-to-Pod trafiğe izin verilmektedir.

### Önerilen Network Policy

Aşağıdaki iki kural "varsayılan kapat, gerekeni aç" prensibini uygular:

```yaml
# İnfra/k8s/base/network-policy.yaml (henüz uygulanmamış — öneri)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: location-shared
spec:
  podSelector: {}           # Tüm Pod'lara uygula
  policyTypes:
    - Ingress               # Gelen tüm trafiği varsayılan kapat
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-to-backend
  namespace: location-shared
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx  # Sadece ingress controller'dan
      ports:
        - protocol: TCP
          port: 8000
```

Bu yapıyla `backend` Pod'larına yalnızca `ingress-nginx` Namespace'inden gelen
TCP:8000 trafiğine izin verilir; diğer tüm iç trafik reddedilir.

---

## 7. Services — Cluster İçi Trafik

### Service Neden Gerekli?

Pod'ların IP adresleri dinamiktir — Pod yeniden başladığında IP değişir.
Service, Pod'ların önüne sabit bir sanal IP ve DNS adı koyar.

```
frontend Pod 1  (10.0.1.5)   ┐
frontend Pod 2  (10.0.1.8)   ├─► Service: frontend (ClusterIP: 10.96.0.15)
frontend Pod 3  (10.0.1.12)  ┘      DNS: frontend.location-shared.svc.cluster.local
```

Service, `selector` etiketiyle hangi Pod'lara trafik göndereceğini bilir.
Etiket uymayan Pod'lar (ör. başlamakta olan Pod) otomatik olarak çıkarılır.

### ClusterIP Nedir?

```
ClusterIP: Sadece cluster içinden erişilebilir sanal IP.
           Dışarıdan direkt erişilemez — bunun için Ingress gerekir.
```

Bu projede her iki Service de ClusterIP tipindedir:

```
backend-service:   port 80  →  Pod port 8000
frontend-service:  port 80  →  Pod port 3000
```

Ingress Controller, Service'in port 80'ine bağlanır; Service de bunu Pod'un
gerçek portuna (8000 veya 3000) yönlendirir.

### Port Terminolojisi

```yaml
# infra/k8s/base/backend-service.yaml
spec:
  selector:
    app: backend
  ports:
    - port: 80           # Service'in dinlediği port (cluster içi)
      targetPort: 8000   # Trafiğin iletildiği Pod portu
```

---

## 8. Ingress — Dışarıdan Gelen Trafik

### Trafik Yolu (Uçtan Uca)

```
Kullanıcı tarayıcısı
     │  DNS: location-shared.4.231.68.185.sslip.io  → 4.231.68.185
     │  HTTP :80
     ▼
Azure Standard Load Balancer  (Kubernetes'in otomatik oluşturduğu)
     │  NodePort (ör. :32080)
     ▼
nginx Ingress Controller Pod  (namespace: ingress-nginx)
     │  HTTP Host header'ına göre yönlendirme
     ├── location-shared.4.231.68.185.sslip.io  →  frontend Service :80
     └── api.location-shared.4.231.68.185.sslip.io  →  backend Service :80
```

### sslip.io DNS

`<ad>.<ip>.sslip.io` formatındaki her domain, `<ip>` adresine çözümlenir.
DNS kaydı açmaya gerek yoktur — geliştirme ve staging ortamları için idealdir.

### Ingress Manifestı

```yaml
# infra/k8s/base/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: location-shared
  namespace: location-shared
spec:
  ingressClassName: nginx           # Hangi Ingress Controller'ın işleyeceği
  rules:
    - host: location-shared.4.231.68.185.sslip.io
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80

    - host: api.location-shared.4.231.68.185.sslip.io
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 80
```

### nginx Ingress Controller — Kurulum

> **Önemli:** nginx Ingress Controller Terraform tarafından yönetilmez.
> Cluster yeniden oluşturulduktan sonra aşağıdaki komutların elle çalıştırılması gerekir.

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz
```

**`azure-load-balancer-health-probe-request-path=/healthz` neden gerekli?**

Azure Load Balancer, arkasındaki node'ların sağlığını bir HTTP isteği ile kontrol eder.
Varsayılan hedef `/`'dır. Ancak nginx bu path için `404` döner → LB tüm node'ları
"sağlıksız" işaretler → trafik hiçbir Pod'a ulaşmaz.

`/healthz` annotation'ı LB'ye nginx'in gerçek health endpoint'ini kullanmasını söyler
(HTTP 200 döner) ve sorun çözülür.

**Mevcut kurulumu güncellemek için:**

```bash
helm upgrade ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz \
  --no-hooks
```

> `--no-hooks`: Önceki bir başarısız upgrade'den kalan admission webhook Job'u varsa
> onu atlayarak upgrade'i tamamlar.

### TLS / HTTPS Ekleme

Şu an HTTP kullanılmaktadır. HTTPS eklemek için:

```bash
# cert-manager kurulumu
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set crds.enabled=true

# ClusterIssuer oluştur (Let's Encrypt)
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your@email.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            ingressClassName: nginx
EOF
```

Ardından `ingress.yaml`'a şu blokları ekleyin:

```yaml
metadata:
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
    - hosts:
        - location-shared.4.231.68.185.sslip.io
        - api.location-shared.4.231.68.185.sslip.io
      secretName: location-shared-tls
```

---

## 9. Scaling — HPA ve PDB

### HPA (Horizontal Pod Autoscaler)

HPA, CPU kullanımına göre Pod sayısını otomatik olarak artırıp azaltır.

```yaml
# infra/k8s/base/hpa-backend.yaml
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2      # En az 2 Pod her zaman çalışır (yüksek erişilebilirlik)
  maxReplicas: 10     # En fazla 10 Pod'a kadar büyüyebilir
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70    # Pod'ların ortalama CPU'su %70'i geçerse scale out
```

**Nasıl çalışır?**

```
Mevcut CPU: %85  →  70/85 × 2 = 2.4  →  3 Pod'a çıkar
Mevcut CPU: %20  →  70/20 × 3 = 10.5 → 2 Pod'a (min) iner (5 dk bekleme ile)
```

HPA'nın çalışması için metrics-server gerekir — AKS'te varsayılan olarak kuruludur.

### PDB (Pod Disruption Budget)

PDB, bakım sırasında (node drain, cluster upgrade) kaç Pod'un aynı anda
kapatılabileceğini sınırlar.

```yaml
# infra/k8s/base/pdb.yaml
# Backend PDB
spec:
  minAvailable: 1       # En az 1 backend Pod her zaman çalışır kalır
  selector:
    matchLabels:
      app: backend

# Frontend PDB
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: frontend
```

**PDB olmadan ne olur?**

İki backend Pod'unun ikisi de aynı node'daysa ve node drain edilirse her ikisi
aynı anda silinir → kısa süreli servis kesintisi.

**PDB ile:**

Kubernetes drain komutunu çalıştırdığında PDB'yi okur: "en az 1 Pod canlı kalacak"
kuralı varsa önce yeni Pod başlatır, o hazır olunca eskisini kapatır.

---

## 10. Helm — Paket Yöneticisi

### Helm Nedir?

Helm, Kubernetes için paket yöneticisidir. Birden fazla manifest dosyasını
**Chart** adı verilen bir paket içinde toplar. `helm install` tek komutla tüm
kaynakları doğru sırayla oluşturur; `helm upgrade` günceller; `helm uninstall` temizler.

### Bu Projede Helm Kullanımı

Şu an Helm yalnızca **nginx Ingress Controller** kurulumunda kullanılmaktadır
(Bölüm 8'de gösterildi). Uygulama manifest'leri `kubectl apply` ile uygulanmaktadır.

### Neden Uygulama Chart'a Taşınmalı?

| `kubectl apply` | Helm Chart |
|---|---|
| Her manifest ayrı ayrı yönetilir | Tek `helm upgrade` ile hepsi güncellenir |
| `sed` ile placeholder değiştirme | `values.yaml` ile değerler şablondan ayrılır |
| Rollback için önceki YAML dosyaları gerekir | `helm rollback <release> 1` yeterli |
| Nelerin kurulu olduğu takip zordur | `helm list` tüm sürümleri gösterir |

### Temel Helm Komutları

```bash
# Kurulu release'leri listele
helm list --all-namespaces

# nginx ingress controller kurulum durumunu kontrol et
helm status ingress-nginx -n ingress-nginx

# Bir release'in geçmişini gör
helm history ingress-nginx -n ingress-nginx

# Önceki versiyona geri dön
helm rollback ingress-nginx 1 -n ingress-nginx

# Release'i kaldır (tüm K8s kaynaklarıyla birlikte)
helm uninstall ingress-nginx -n ingress-nginx
```

### Uygulama için Helm Chart Oluşturma (İleride)

```bash
helm create location-shared
# infra/k8s/base/*.yaml → templates/ altına taşı
# REPLACE_* placeholder'lar → {{ .Values.acr.loginServer }}:{{ .Values.image.tag }}
# helm upgrade --install location-shared ./location-shared \
#   --namespace location-shared \
#   --set acr.loginServer=$ACR_SERVER \
#   --set image.tag=$GITHUB_SHA
```

---

## 11. Events — Gerçek Zamanlı Teşhis

### Event Nedir?

Kubernetes, cluster içinde olan her şeyi (Pod başlatma, image çekme, OOMKill,
probe başarısızlığı, HPA kararı) **Event** olarak kaydeder.
Event'lar varsayılan olarak 1 saat saklanır.

### Pod Başlamıyorsa İlk Bakılacak Yer

```bash
# Namespace içindeki tüm Event'ları zaman sırasıyla gör
kubectl get events -n location-shared --sort-by='.lastTimestamp'

# Belirli bir Pod'un Event'ları
kubectl describe pod <pod-adı> -n location-shared
# └── "Events:" bölümü en alta doğru — sorun burada görünür
```

**Yaygın Event mesajları ve anlamları:**

| Event Mesajı | Kök Neden | Çözüm |
|---|---|---|
| `Back-off pulling image` | Image bulunamadı veya ACR'ye erişim yok | Image tag'ı, AcrPull rolünü kontrol et |
| `OOMKilled` | Pod memory limitini aştı | `resources.limits.memory` değerini artır |
| `Readiness probe failed` | Uygulama henüz hazır değil veya çöktü | `kubectl logs` ile uygulama log'una bak |
| `Insufficient cpu` | Node'da yeterli CPU yok | Node havuzuna node ekle veya limit azalt |
| `FailedScheduling` | Hiçbir Node Pod'u kabul etmedi | `kubectl describe pod` ile detaya bak |
| `Killing` | Liveness probe başarısız, Pod yeniden başlatılıyor | Uygulama sağlığını kontrol et |

### HPA Event'ları

```bash
kubectl describe hpa backend-hpa -n location-shared
# Events bölümünde scale up/down kararlarını görürsünüz:
# "New size: 4; reason: cpu resource utilization above target"
```

### Gerçek Zamanlı Log Takibi

```bash
# Tüm backend Pod'larının loglarını canlı izle
kubectl logs -n location-shared -l app=backend --follow

# Son 50 satır
kubectl logs -n location-shared deployment/backend --tail=50

# Belirli bir Pod
kubectl logs -n location-shared <pod-adı> -p   # -p: bir önceki çalışmanın log'u
```

---

## 12. AKS Node Pool Mimarisi

### Node Pool Yapısı

```
AKS Cluster: aks-locationshared-{env}
(westeurope, Free tier — SLA %99.9 değil, geliştirim ortamı için yeterli)
│
├── System Pool: "system"
│     VM: Standard_D2s_v5 (2 vCPU, 8 GB RAM)
│     Sayı: 1 node (sabit)
│     İşletim Sistemi: AzureLinux
│     Taint: only_critical_addons_enabled = true
│     ─────────────────────────────────────────
│     Bu pool sadece Kubernetes'in kendi bileşenlerini çalıştırır:
│     CoreDNS, kube-proxy, metrics-server, OMS agent, nginx-ingress
│     Uygulama Pod'ları buraya schedule edilmez.
│
└── User Pool: "user"
      VM: Standard_D4s_v5 (4 vCPU, 16 GB RAM)
      Sayı: 2 (dev) / 3 (prod)
      ─────────────────────────────────────────
      Tüm uygulama workload'ları buraya gelir:
      backend, frontend Pod'ları
```

### Neden İki Pool?

Sistem bileşenleri ile uygulama bileşenlerini ayırmanın temel nedeni **karşılıklı
etkilememeyi** (noisy neighbor) önlemektir.

Bir backend Pod memory sızdırıyor ve node'un tüm belleğini dolduruyor olsa bile
`system` pool'daki CoreDNS ve kube-proxy etkilenmez; cluster sağlığı korunur.

### Resource Requests ve Limits

```
CPU "100m" = 1/10 vCPU
1000m = 1 vCPU

requests → Scheduler bu kadar CPU/RAM bulunduran node'a koyar
limits   → Container bu değeri aşarsa throttle edilir (CPU) veya öldürülür (RAM)
```

Mevcut backend limitleri (D4s_v5 = 4 vCPU):

```
1 node = 4000m CPU
Backend pod requests: 100m × 2 replicas = 200m
Kullanım oranı: %5 — HPA'nın 10 Pod'a kadar büyümesi için yeterli alan var
```

---

## 13. Workload Identity — Secretsız Azure Erişimi

### Mevcut Durum

AKS cluster'ı şu iki özellikle yapılandırılmıştır:

```hcl
oidc_issuer_enabled       = true   # AKS OIDC token endpoint'i
workload_identity_enabled = true   # Pod SA → Azure kimliği eşleştirme
```

Şu an bu mekanizma yalnızca kubelet Managed Identity için kullanılmaktadır:
AKS worker node'ları ACR'den image çekebilmek için `AcrPull` rolüne sahiptir.

### Neden Önemli?

Standart yaklaşımda Pod'a Azure'a erişmesi için bir Connection String ya da Client
Secret verilir — bu değer bir Kubernetes Secret'ta durur, çalınabilir.

Workload Identity ile Pod bir Kubernetes Service Account token'ı kullanır. Bu token
Azure AD'de federe kimlik olarak tanımlanır ve geçici bir Azure access token ile
değiştirilir. Hiçbir uzun ömürlü credential saklanmaz.

### Key Vault Entegrasyonu (İleride)

```bash
# Uygulama Pod'larının Key Vault'tan doğrudan secret okuması:
# 1. Pod Service Account oluştur
# 2. Managed Identity oluştur ve SA ile eşleştir
# 3. Key Vault'a "Key Vault Secrets User" rolü ver
# 4. CSI driver ile secret'ları mount et
helm install secrets-store-csi-driver \
  secrets-store-csi-driver/secrets-store-csi-driver \
  --namespace kube-system
```

---

## 14. Manifest Dosyaları Referansı

```
infra/k8s/base/
├── namespace.yaml           Namespace: location-shared
├── configmap.yaml           ConfigMap: app-config (CORS, API prefix)
├── secrets.example.yaml     Şema referansı — asla gerçek değer içermez
├── backend-deployment.yaml  Deployment: backend (2 replicas, probes, resources)
├── backend-service.yaml     Service: backend ClusterIP 80→8000
├── frontend-deployment.yaml Deployment: frontend (2 replicas)
├── frontend-service.yaml    Service: frontend ClusterIP 80→3000
├── ingress.yaml             Ingress: nginx, hostname routing
├── hpa-backend.yaml         HPA: backend min=2 max=10 cpu=70%
└── pdb.yaml                 PDB: backend minAvailable=1, frontend minAvailable=1
```

### Deploy Sırasında Image Placeholder Değiştirme

```bash
# CI pipeline'ın yaptığı:
sed \
  -e "s|REPLACE_ACR_LOGIN_SERVER|${ACR_LOGIN_SERVER}|g" \
  -e "s|:latest|:${GITHUB_SHA}|g" \
  infra/k8s/base/backend-deployment.yaml > /tmp/backend.yaml

sed \
  -e "s|REPLACE_ACR_LOGIN_SERVER|${ACR_LOGIN_SERVER}|g" \
  -e "s|:latest|:${GITHUB_SHA}|g" \
  infra/k8s/base/frontend-deployment.yaml > /tmp/frontend.yaml
```

Orijinal dosyalar değişmez; `/tmp` altındaki geçici dosyalar uygulanır.

---

## 15. Günlük Operasyon Komutları

### Cluster'a Bağlanma

```bash
# Dev
az aks get-credentials \
  --resource-group rg-locationshared-dev \
  --name aks-locationshared-dev \
  --overwrite-existing

# Prod
az aks get-credentials \
  --resource-group rg-locationshared-prod \
  --name aks-locationshared-prod \
  --overwrite-existing
```

### Genel Durum Kontrolü

```bash
kubectl get nodes                              # Node'ların durumu
kubectl get pods -n location-shared           # Tüm uygulama Pod'ları
kubectl get deployments -n location-shared    # Deployment durumu (desired vs ready)
kubectl get hpa -n location-shared            # Mevcut replica sayısı ve CPU
kubectl get events -n location-shared --sort-by='.lastTimestamp' | tail -20
```

### Log İnceleme

```bash
kubectl logs -n location-shared deployment/backend --tail=100
kubectl logs -n location-shared deployment/frontend --tail=100
kubectl logs -n location-shared <pod-adı> --previous   # Çökmüş Pod'un önceki log'u
```

### Pod İçine Girme (Hata Ayıklama)

```bash
kubectl exec -it -n location-shared deployment/backend -- /bin/bash
# İçeride: python -c "import app; print('OK')"
# İçeride: curl http://localhost:8000/health
```

### Secret'ı Okuma

```bash
kubectl get secret app-secrets -n location-shared -o jsonpath='{.data.DATABASE_URL}' | base64 -d
```

### Manuel Rollback

```bash
# Önceki bir image SHA ile geri dön
kubectl set image deployment/backend \
  backend=<acr-login-server>/location-shared-backend:<eski-sha> \
  -n location-shared
kubectl rollout status deployment/backend -n location-shared
```

### Nginx Ingress Durumu

```bash
kubectl get svc -n ingress-nginx              # External IP'yi buradan alın
kubectl get pods -n ingress-nginx             # Controller Pod'u çalışıyor mu?
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller --tail=50
```
