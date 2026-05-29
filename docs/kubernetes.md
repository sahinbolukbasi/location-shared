# Kubernetes & AKS

Reference for the Kubernetes manifests, AKS cluster configuration, and runtime architecture.

---

## Namespace

All application resources live in a dedicated namespace:

```yaml
# infra/k8s/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: location-shared
```

This provides isolation from system pods and other potential workloads.

---

## Manifest Structure

```
infra/k8s/base/
├── namespace.yaml          ← Namespace: location-shared
├── configmap.yaml          ← Non-secret runtime config (env, API URLs, etc.)
├── secrets.example.yaml    ← Schema for app-secrets (values injected by CI)
├── backend-deployment.yaml ← FastAPI Deployment (2 replicas)
├── backend-service.yaml    ← ClusterIP service for backend
├── frontend-deployment.yaml← Next.js Deployment (2 replicas)
├── frontend-service.yaml   ← ClusterIP service for frontend
├── ingress.yaml            ← nginx Ingress (routes external traffic)
├── hpa-backend.yaml        ← HorizontalPodAutoscaler for backend
└── pdb.yaml                ← PodDisruptionBudget
```

---

## Deployment Manifests

### Image Placeholders

The deployment YAML files use two placeholders that are substituted by the CI pipeline at deploy time:

| Placeholder | Replaced With |
|---|---|
| `REPLACE_ACR_LOGIN_SERVER` | Terraform output: `acr_login_server` (e.g., `locationshareddevqx4nh.azurecr.io`) |
| `:latest` | `:${{ github.sha }}` (exact commit SHA) |

```bash
# CI substitution command
sed -e "s|REPLACE_ACR_LOGIN_SERVER|$ACR_SERVER|g" \
    -e "s|:latest|:$COMMIT_SHA|g" \
    infra/k8s/base/backend-deployment.yaml > /tmp/backend.yaml
```

This ensures every deploy is pinned to a specific immutable image.

---

## Secrets

The CI pipeline creates the `app-secrets` Kubernetes Secret:

```bash
kubectl create secret generic app-secrets \
  --namespace location-shared \
  --from-literal=SECRET_KEY="..." \
  --from-literal=DATABASE_URL="postgresql+psycopg://user:pass@fqdn:5432/location_shared" \
  --from-literal=GOOGLE_CLIENT_ID="..." \
  --from-literal=STRIPE_SECRET_KEY="..." \
  --from-literal=STRIPE_WEBHOOK_SECRET="..." \
  --from-literal=STRIPE_PRO_PRICE_ID="..." \
  --dry-run=client -o yaml | kubectl apply -f -
```

Pods reference this secret via `envFrom`:
```yaml
envFrom:
  - secretRef:
      name: app-secrets
```

---

## Ingress

Traffic enters the cluster through the nginx Ingress Controller installed via Helm in the `ingress-nginx` namespace.

### Routing Architecture

```
Internet (sslip.io DNS)
  └─► Azure Load Balancer (IP: 4.231.68.185)
        └─► nginx Ingress Controller (namespace: ingress-nginx)
              ├─► host: location-shared.4.231.68.185.sslip.io
              │     └─► frontend Service (ClusterIP :80)
              └─► host: api.location-shared.4.231.68.185.sslip.io
                    └─► backend Service (ClusterIP :80)
```

### Ingress Manifest (`infra/k8s/base/ingress.yaml`)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: location-shared
  namespace: location-shared
spec:
  ingressClassName: nginx
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

### nginx Ingress Controller — Kurulum (Manuel)

> **⚠️ Önemli**: nginx Ingress Controller Terraform tarafından yönetilmez. Cluster yeniden oluşturulursa aşağıdaki komutlar elle çalıştırılmalıdır.

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz
```

**Kritik annotation**: Azure Load Balancer sağlık probu varsayılan olarak `/` path'ini kontrol eder. nginx `/` için 404 döner ve LB backend'leri sağlıksız işaretler. `/healthz` annotation'ı ile probe nginx'in doğru endpoint'ini kullanır (HTTP 200).

Mevcut kurulu versiyonu upgrade etmek gerekirse (örn. annotation eksikse):

```bash
helm upgrade ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz \
  --no-hooks
```

> `--no-hooks`: Pre-upgrade admission webhook job'u varsa kullanılır (hook hatası durumunda bypass eder).

---

## Horizontal Pod Autoscaler (HPA)

The backend has an HPA configured in `hpa-backend.yaml`:

```yaml
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

The backend scales between 2 and 10 replicas based on CPU utilization. Requires metrics-server to be running (enabled by default on AKS).

---

## Pod Disruption Budget (PDB)

`pdb.yaml` ensures at least 1 replica is always available during voluntary disruptions (node upgrades, drains):

```yaml
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: backend  # (and/or frontend)
```

---

## AKS Node Pools

### System Pool

| Parameter | Value |
|---|---|
| Name | `system` |
| VM Size | `Standard_D2s_v5` (2 vCPU, 8 GB RAM) |
| Node Count | 1 |
| Purpose | Critical system pods (CoreDNS, kube-proxy, OMS agent) |
| Taint | `only_critical_addons_enabled = true` |
| OS | AzureLinux |
| Disk | Managed (128 GB) |

### User Pool

| Parameter | Value |
|---|---|
| Name | `user` |
| VM Size | `Standard_D4s_v5` (4 vCPU, 16 GB RAM) |
| Node Count | 2 |
| Purpose | Backend + frontend application pods |
| OS | AzureLinux |
| Disk | Managed (128 GB) |

---

## Network Configuration

| Setting | Value |
|---|---|
| Network Plugin | Azure CNI (each pod gets a VNet IP) |
| Network Policy | Azure Network Policy (pod-level firewall) |
| Load Balancer | Azure Load Balancer (Standard) |

Azure CNI gives each pod its own IP address within the VNet, enabling direct integration with Azure services and simpler network policy rules compared to Kubenet.

---

## Accessing the Cluster

```bash
# Get kubeconfig (requires Azure CLI login and Contributor role)
az aks get-credentials \
  --resource-group rg-locationshared-dev \
  --name aks-locationshared-dev \
  --overwrite-existing

# Verify connection
kubectl get nodes
kubectl get pods -n location-shared

# Check deployments
kubectl get deployments -n location-shared
kubectl describe deployment backend -n location-shared

# View logs
kubectl logs -n location-shared -l app=backend --tail=100
kubectl logs -n location-shared -l app=frontend --tail=100

# Check HPA
kubectl get hpa -n location-shared
```

---

## Workload Identity

AKS has `workload_identity_enabled = true` and `oidc_issuer_enabled = true`. This allows pods to authenticate to Azure services (Key Vault, Storage, etc.) using Kubernetes Service Accounts mapped to Azure Managed Identities — no secrets required in pods for Azure API access.

Current usage: AKS kubelet Managed Identity has `AcrPull` role on ACR for pulling images.
