# Troubleshooting

Complete record of all errors encountered during infrastructure setup and CI/CD pipeline configuration, with root cause analysis and applied fixes.

---

## Error Index

| # | Error | Component | Run | Fix |
|---|---|---|---|---|
| 1 | AZ Zone 1/2 Not Available | AKS, PostgreSQL | Run 1 & 2 | Remove `zones` from all resources |
| 2 | VMSizeDoesNotSupportEphemeralOS | AKS | Run 2 | `os_disk_type = "Managed"` |
| 3 | LocationIsOfferRestricted (PostgreSQL) | PostgreSQL | Run 2 | `location = "northeurope"` |
| 4 | AuthorizationFailed on role assignment | AKS/ACR | Run 3 | Grant SP `User Access Administrator` |
| 5 | PostgreSQL 409 — name reserved in westeurope | PostgreSQL | Run 3 | Rename `psql-` → `pg-` prefix |

---

## Error 1 — AZ Zone 1/2 Not Available

**Runs affected**: Run 1 (`26605211581`), Run 2 (`26605667818`)

### Symptom

```
Error: creating/updating Node Pool: ... Code="ZonalAllocationFailed"
Message="Allocation failed. We do not have sufficient capacity for the requested
VM size in this zone. Try changing the availability zone, changing the VM size,
or retrying at a later time."
```

### Root Cause

The Azure Startup Credit subscription only has capacity for **Availability Zone 3** in `westeurope`. Zones 1 and 2 are unavailable for this subscription tier.

### Fix Applied

Removed `zones` argument from both AKS node pools and PostgreSQL Flexible Server. Without an explicit zone, Azure automatically places the resource in any available zone.

```hcl
# Before (in aks/main.tf)
default_node_pool {
  ...
  zones = [1, 2, 3]   # ← removed
}

# After
default_node_pool {
  # no zones argument — Azure picks automatically
}
```

**Commit**: `6cc81fa`

---

## Error 2 — VMSizeDoesNotSupportEphemeralOS

**Run affected**: Run 2 (`26605667818`)

### Symptom

```
Error: Code="VMSizeDoesNotSupportEphemeralOSDisk"
Message="VM size Standard_D2s_v5 does not support ephemeral OS disk."
```

### Root Cause

Ephemeral OS requires the temp disk to be at least as large as the OS disk image (≈128 GB). `Standard_D2s_v5` has only **8 GB** temp disk. Same issue on `Standard_D4s_v5` (28 GB temp disk — still insufficient).

| VM Size | Temp Disk | Ephemeral OS |
|---|---|---|
| Standard_D2s_v5 | 8 GB | ❌ Not supported |
| Standard_D4s_v5 | 28 GB | ❌ Not supported |

### Fix Applied

Changed `os_disk_type` from `"Ephemeral"` to `"Managed"` on both node pools.

```hcl
default_node_pool {
  os_disk_type = "Managed"   # was "Ephemeral"
}

resource "azurerm_kubernetes_cluster_node_pool" "user" {
  os_disk_type = "Managed"   # was "Ephemeral"
}
```

**Trade-off**: Managed disks are slightly slower for OS operations but there is no performance difference for application workloads.

**Commit**: `7a8a2d3`

---

## Error 3 — LocationIsOfferRestricted (PostgreSQL)

**Run affected**: Run 2 (`26605667818`)

### Symptom

```
Error: creating Flexible Server:
Code="LocationIsOfferRestricted"
Message="Flexible Server is not currently available in region 'westeurope'
for your subscription. To enable this service, please contact Microsoft support."
```

### Root Cause

Azure's **PostgreSQL Flexible Server** offer is **blocked in `westeurope`** for the Startup Credit subscription. This is a subscription-level restriction — not a quota or capacity issue — and cannot be resolved without contacting Microsoft Support.

### Fix Applied

Hardcoded `location = "northeurope"` in the PostgreSQL module:

```hcl
# infra/modules/postgres/main.tf
resource "azurerm_postgresql_flexible_server" "this" {
  location = "northeurope"   # was var.location ("westeurope")
  ...
}
```

`northeurope` (Dublin, Ireland) is the nearest available region for PostgreSQL Flexible Server under this subscription.

**Network latency impact**: Negligible for API calls from AKS (westeurope) to PostgreSQL (northeurope) — typically < 5 ms. Not a concern for this application.

**Commit**: `7a8a2d3`

---

## Error 4 — AuthorizationFailed on Role Assignment

**Run affected**: Run 3 (`26605866191`)

### Symptom

```
Error: authorization.RoleAssignmentsClient#Create: Failure responding to request:
StatusCode=403 -- Code="AuthorizationFailed"
Message="The client '***' with object id 'bbff976b-...' does not have authorization
to perform action 'Microsoft.Authorization/roleAssignments/write' over scope
'/subscriptions/.../resourceGroups/rg-locationshared-dev/providers/
Microsoft.ContainerRegistry/registries/locationshareddevqx4nh/...'
```

**Resource**: `module.aks.azurerm_role_assignment.acr_pull`

### Root Cause

Terraform creates an `AcrPull` role assignment, granting AKS's kubelet Managed Identity permission to pull images from ACR. Writing role assignments requires `Microsoft.Authorization/roleAssignments/write`, which is in the `User Access Administrator` or `Owner` role — **not in `Contributor`**.

The Service Principal only had `Contributor`, which is sufficient for creating resources but insufficient for creating role assignments.

### Fix Applied

Granted `User Access Administrator` to the Service Principal at subscription scope:

```bash
az role assignment create \
  --assignee d022d41a-5b9c-4c55-8e6f-264007ee6463 \
  --role "User Access Administrator" \
  --scope /subscriptions/4cf0d74f-7f78-413f-a9aa-9f97c39114d1
```

**Security note**: `User Access Administrator` allows the SP to assign any role to any principal within the subscription scope. Combined with `Contributor`, this effectively gives the SP `Owner`-level access (minus a few Owner-specific operations). This is acceptable for a CI/CD pipeline but should be reviewed if shared with untrusted parties.

**Applied**: Directly via Azure CLI (not a code change)

---

## Error 5 — PostgreSQL 409 Name Reserved in westeurope

**Run affected**: Run 3 (`26605866191`)

### Symptom

```
Error: creating Flexible Server "psql-locationshared-dev":
unexpected status 409 (409 Conflict) with error: InvalidResourceLocation:
The resource 'psql-locationshared-dev' already exists in location 'westeurope'
in resource group 'rg-locationshared-dev'. A resource with the same name cannot
be created in location 'northeurope'. Please select a new resource name.
```

### Root Cause

Azure internally reserved the name `psql-locationshared-dev` in `westeurope` from an earlier failed creation attempt (Run 2 tried to create in westeurope before the LocationIsOfferRestricted error). Even though the server no longer exists in Azure (`az postgres flexible-server list` returns empty, REST API returns 404), Azure's internal naming registry retains the association between this name and `westeurope`.

Azure cannot create the same resource name in a different location within the same resource group while this internal reservation exists.

### Fix Applied

Two-part fix:

**1. Rename the PostgreSQL server** in the Terraform module to break the name reservation:

```hcl
# Before
name = "psql-${var.project_name}-${var.environment}"   # → psql-locationshared-dev

# After
name = "pg-${var.project_name}-${var.environment}"     # → pg-locationshared-dev
```

**2. Clean stale Terraform state** in CI before apply (idempotent):

```yaml
# .github/workflows/deploy-dev.yml
terraform state rm module.postgres.azurerm_postgresql_flexible_server.this 2>/dev/null || true
terraform state rm module.postgres.azurerm_postgresql_flexible_server_database.app 2>/dev/null || true
terraform state rm module.postgres.azurerm_postgresql_flexible_server_firewall_rule.allow_azure 2>/dev/null || true
terraform state rm module.aks.azurerm_role_assignment.acr_pull 2>/dev/null || true
```

The `|| true` makes these commands idempotent — if the resources are not in state (already clean), the command exits with 0 anyway.

**Commit**: `e20014b`

---

## Proactive Fixes (Applied Before Errors Occurred)

### AKS SKU Changed to Free

```hcl
sku_tier = "Free"   # was "Standard"
```

`Standard` SKU incurs a per-cluster SLA cost on top of VM costs. The Startup Credit subscription has limited credits — `Free` tier is appropriate for development.

### `local_account_disabled` Set to False

```hcl
local_account_disabled = false   # was true
```

With `local_account_disabled = true`, `az aks get-credentials` only works with Azure AD (Entra ID) integration configured. The CI runner would need Azure AD group membership to get kubectl access. Setting to `false` enables local cluster accounts, which is compatible with `az aks get-credentials` in CI without additional AAD configuration.

---

## Potential Future Issues

### nginx Ingress Controller Not Installed

**Risk**: The `ingress.yaml` manifest references the `nginx` ingress class, but the nginx Ingress Controller is not installed by Terraform. On first deploy, Kubernetes will accept the Ingress resource but traffic will not be routed.

**Resolution** (when needed):
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

Or add this as a step in `deploy-dev.yml` before `kubectl apply -f infra/k8s/base/ingress.yaml`.

### Terraform State Drift

Some resources (ACR, Key Vault, Log Analytics, Application Insights) were created in Run 1 (`26605211581`) before that run failed at a later step. If the Terraform state for Run 1 was partially saved, subsequent `terraform apply` runs may encounter drift between state and reality. Terraform should handle this gracefully (`already exists` = update in place or `no-op`), but if drift is detected, use `terraform import` to reconcile.
