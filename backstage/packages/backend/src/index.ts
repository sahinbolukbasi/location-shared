/**
 * Location Shared — Backstage Backend (New Backend System)
 *
 * Registers all plugin modules using the declarative @backstage/backend-defaults
 * approach. Each `backend.add(import(...))` call lazy-loads a plugin module.
 */

import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// ─── Core: serve the built React frontend ────────────────────────────────────
backend.add(import('@backstage/plugin-app-backend'));

// ─── Auth: guest provider only (development / no login required) ─────────────
backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));

// ─── Software Catalog ─────────────────────────────────────────────────────────
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);

// ─── Scaffolder (Software Templates) ─────────────────────────────────────────
backend.add(import('@backstage/plugin-scaffolder-backend'));

// ─── TechDocs: build and serve docs from docs/ directory ─────────────────────
backend.add(import('@backstage/plugin-techdocs-backend'));

// ─── Search: index catalog + techdocs ────────────────────────────────────────
backend.add(import('@backstage/plugin-search-backend'));
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));

// ─── Kubernetes: connect to AKS cluster ──────────────────────────────────────
backend.add(import('@backstage/plugin-kubernetes-backend'));

backend.start();
