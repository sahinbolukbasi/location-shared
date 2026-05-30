# Backstage on Kubernetes - Cost Governance Playbook

This document provides a production-grade but simple template for running Backstage on AKS with strict cost control.
It is designed for day-2 operations: pause/resume, right-sizing, observability limits, and safe defaults.

---

## 1. Goals

- Keep development always available with minimum stable spend.
- Pause production when inactive to eliminate compute waste.
- Keep platform operations reproducible with explicit runbooks.
- Make cost visibility and actions part of normal operations.

---

## 2. Scope

Applies to:

- AKS clusters and node pools
- PostgreSQL Flexible Server
- Log Analytics and Application Insights retention
- Ingress and load balancing
- Backstage app workload in Kubernetes

Out of scope:

- Application feature design
- Data model refactoring

---

## 3. Environment Strategy

### Production (cost-freeze mode when not needed)

- Stop AKS cluster when prod is inactive.
- Stop PostgreSQL Flexible Server when prod is inactive.
- Keep data and config resources (Key Vault, ACR, workspace) intact.

Commands:

```bash
az aks stop -g rg-locationshared-prod -n aks-locationshared-prod
az postgres flexible-server stop -g rg-locationshared-prod -n pg-locationshared-prod
```

Resume commands:

```bash
az aks start -g rg-locationshared-prod -n aks-locationshared-prod
az postgres flexible-server start -g rg-locationshared-prod -n pg-locationshared-prod
```

### Development (always on, minimum profile)

- Keep AKS tier as `Free`.
- Keep system pool at minimum reliable size.
- Keep user pool at minimum required node count.
- Keep PostgreSQL on burstable SKU (`Standard_B1ms` unless load requires more).

Validation commands:

```bash
az aks show -g rg-locationshared-dev -n aks-locationshared-dev --query '{tier:sku.tier,powerState:powerState.code}' -o json
az aks nodepool list -g rg-locationshared-dev --cluster-name aks-locationshared-dev --query "[].{name:name,count:count,vmSize:vmSize,mode:mode}" -o table
az postgres flexible-server show -g rg-locationshared-dev -n pg-locationshared-dev --query '{state:state,sku:sku.name,tier:sku.tier}' -o json
```

---

## 4. Backstage Kubernetes Template

Use these defaults for a cost-aware Backstage deployment.

### 4.1 Deployment baseline

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backstage
  namespace: location-shared
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backstage
  template:
    metadata:
      labels:
        app: backstage
    spec:
      containers:
        - name: backstage
          image: <acr>/backstage:<tag>
          ports:
            - containerPort: 7007
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          readinessProbe:
            httpGet:
              path: /healthcheck
              port: 7007
            initialDelaySeconds: 15
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /healthcheck
              port: 7007
            initialDelaySeconds: 30
            periodSeconds: 20
```

### 4.2 Service baseline

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backstage
  namespace: location-shared
spec:
  selector:
    app: backstage
  ports:
    - port: 80
      targetPort: 7007
  type: ClusterIP
```

### 4.3 Ingress baseline

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: backstage
  namespace: location-shared
spec:
  ingressClassName: nginx
  rules:
    - host: backstage.location-shared.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: backstage
                port:
                  number: 80
```

### 4.4 HPA guardrail (optional)

For dev, keep fixed replicas when possible.
For prod, use HPA only with strict bounds:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backstage
  namespace: location-shared
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backstage
  minReplicas: 1
  maxReplicas: 2
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## 5. Cost Controls by Layer

| Layer | Control | Why it matters |
|---|---|---|
| AKS Control Plane | Use `Free` tier for dev | Avoid paid management tier in non-prod |
| Node Pools | Keep min node count | Primary compute cost driver |
| VM Size | Prefer smallest stable SKU | Direct impact on hourly cost |
| PostgreSQL | Burstable SKU, stop prod when idle | Continuous DB compute spend |
| Logs | Retention limits and filtering | Hidden long-term storage cost |
| Ingress/LB | Consolidate ingress endpoints | Avoid duplicate public IP/LB footprint |
| Replica Count | Keep low in dev | Over-provisioned pods waste node resources |

---

## 6. Observability Cost Hygiene

- Keep Log Analytics retention aligned with actual investigation needs.
- Avoid high-cardinality custom metrics unless required.
- Use sampling for high-volume telemetry in Application Insights.
- Remove unused dashboards and alerts.

Example checks:

```bash
az monitor log-analytics workspace show -g rg-locationshared-dev -n law-locationshared-dev --query '{name:name,retentionInDays:retentionInDays}' -o json
az monitor app-insights component show -g rg-locationshared-dev -a appi-locationshared-dev --query '{name:name,kind:kind,retentionInDays:retentionInDays}' -o json
```

---

## 7. Weekly Operations Checklist

- Verify prod remains stopped outside release windows.
- Verify dev nodepool counts did not drift upward.
- Verify PostgreSQL SKU did not drift.
- Review top cost drivers from Azure Cost Analysis.
- Review orphaned resources in managed cluster resource groups.

Suggested checks:

```bash
az aks show -g rg-locationshared-prod -n aks-locationshared-prod --query 'powerState.code' -o tsv
az postgres flexible-server show -g rg-locationshared-prod -n pg-locationshared-prod --query 'state' -o tsv
az aks nodepool list -g rg-locationshared-dev --cluster-name aks-locationshared-dev --query "[].{name:name,count:count,vmSize:vmSize}" -o table
```

---

## 8. Drift and Safety

- Apply cost settings through Terraform or policy where possible.
- Add alerts for unexpected node count increases.
- Add delete locks for critical resources.
- Keep stop/start operations in controlled scripts or runbooks.

---

## 9. Recommended Next Improvements

- Add scheduled automation for prod freeze/resume windows.
- Add budget alerts by resource group (`prod`, `dev`).
- Add AKS namespace quotas for Backstage and app namespaces.
- Add policy to reject oversized VM SKUs in dev.

---

## 10. Ownership

Platform owner: Location Shared infrastructure team.

When updating this document, include:

- Current SKU and nodepool baseline
- Last validated date
- Command output snippets for traceability
