# Helm-managed FinOps stack for AKS
# Deploys a lightweight Prometheus + OpenCost in a dedicated namespace
# to expose Kubernetes cost insights.

resource "kubernetes_namespace" "finops" {
  count = var.enable_platform_helm && var.enable_opencost ? 1 : 0

  metadata {
    name = var.finops_namespace
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
      "platform.layer"               = "finops"
    }
  }

  depends_on = [module.aks]
}

resource "helm_release" "opencost" {
  count = var.enable_platform_helm && var.enable_opencost ? 1 : 0

  name              = "opencost"
  repository        = "https://opencost.github.io/opencost-helm-chart"
  chart             = "opencost"
  version           = var.opencost_chart_version
  namespace         = kubernetes_namespace.finops[0].metadata[0].name
  cleanup_on_fail   = true
  dependency_update = true
  atomic            = true
  timeout           = 900

  set {
    name  = "opencost.exporter.defaultClusterId"
    value = "${var.project_name}-${var.environment}"
  }

  set {
    name  = "opencost.ui.enabled"
    value = "true"
  }

  # Point to the Prometheus instance deployed in the same namespace
  set {
    name  = "opencost.prometheus.internal.enabled"
    value = "true"
  }

  set {
    name  = "opencost.prometheus.internal.serviceName"
    value = "prometheus-server"
  }

  set {
    name  = "opencost.prometheus.internal.namespaceName"
    value = kubernetes_namespace.finops[0].metadata[0].name
  }

  set {
    name  = "opencost.prometheus.internal.port"
    value = "80"
  }

  set {
    name  = "service.type"
    value = "ClusterIP"
  }

  depends_on = [helm_release.prometheus, kubernetes_namespace.finops]
}

resource "helm_release" "prometheus" {
  count = var.enable_platform_helm && var.enable_opencost ? 1 : 0

  name              = "prometheus"
  repository        = "https://prometheus-community.github.io/helm-charts"
  chart             = "prometheus"
  version           = "27.5.1"
  namespace         = kubernetes_namespace.finops[0].metadata[0].name
  cleanup_on_fail   = true
  dependency_update = true
  atomic            = true
  timeout           = 600

  # Minimal footprint: disable alertmanager, pushgateway, node-exporter
  set {
    name  = "alertmanager.enabled"
    value = "false"
  }

  set {
    name  = "prometheus-pushgateway.enabled"
    value = "false"
  }

  set {
    name  = "prometheus-node-exporter.enabled"
    value = "false"
  }

  set {
    name  = "kube-state-metrics.enabled"
    value = "true"
  }

  set {
    name  = "server.persistentVolume.enabled"
    value = "false"
  }

  set {
    name  = "server.service.type"
    value = "ClusterIP"
  }

  depends_on = [kubernetes_namespace.finops]
}
