# Implementation Plan: Parish Deployment Readiness

## Overview

Address the deployment blockers found in the parish website audit. Keep the
frontend on Vercel and run the Express API on the existing Render service.
Use the existing SQL Server and Azure Blob Storage services with production
secrets configured outside the repository. Update the README so its deployment
guidance reflects Render; external hosting setup and credential rotation
require the owner's access.

## Architecture Decisions

- Keep the React/Vite frontend and Express API as separate deployments, as
  implied by the existing Vercel static-site config and `server.js` entry point.
- Use Render as the persistent Node.js host for Express because the app runs
  scheduled jobs and connects to SQL Server.
- Use the existing SQL Server and Azure Blob Storage in production. Do not
  store credentials in source files or commit them.
- Require validated SQL Server certificates in production; retain the
  existing development behavior where appropriate.
- Preserve the existing `/health` endpoint and add a distinct readiness check
  that reports whether the database is available.

## Task List

### Phase 1: Production API safety and health

- [x] Task 1: Make production SQL certificate validation configurable and
  secure. Keep API startup using the same validated SQL configuration used by
  development; add or update focused tests if the configuration can be
  isolated. Verify the build and tests. **Done.**
- [x] Task 2: Add a database-aware readiness endpoint and document its use.
  It must not report ready while the pool is unavailable. Test both available
  and unavailable database states without exposing internals. **Done.**

### Checkpoint: API safety

- [ ] Focused tests pass; build and lint pass.
- [ ] Health and readiness behavior are documented accurately.

### Phase 2: Frontend/API deployment wiring

- [x] Task 3: Update deployment configuration and README guidance for a
  Vercel frontend plus the existing Render Express API. Ensure production API
  calls use the configured public API URL, not localhost, and define the
  required production environment variables without real secrets. **Done.**
- [x] Task 4: Document production upload requirements. Require durable Azure
  Blob Storage in production or clearly prevent ephemeral local disk from
  being mistaken for persistent upload storage. **Done.**
- [x] Task 5: Replace outdated claims in `deployment-readiness.html` with the
  verified current state and a practical deployment checklist. **Done.**

### Checkpoint: Deployment wiring

- [x] Production frontend build points to the configured API origin.
- [x] API CORS and the documented frontend origin agree.
- [x] No production secret is added to tracked files.

### Phase 3: Performance and final verification

- [x] Task 6: Reduce the initial JavaScript bundle by lazy-loading suitable
  routes, with behavior preserved and tests/build verified. **Done.**
- [x] Task 7: Run the full test, lint, and production build checks; inspect the
  final diff and report any remaining external setup steps.

### Checkpoint: Complete

- [x] Tests, lint, and build pass.
- [x] Deployment docs describe the actual architecture and required settings.
- [x] No cloud deployment, database migration, or credential rotation is
  claimed complete unless verified with the owner's infrastructure access.

## External Actions and Risks

| Risk or action | Impact | Mitigation |
| --- | --- | --- |
| The Azure storage key shown in the shared IDE/chat context may be exposed. | Someone with the key could access the storage account. | The owner must rotate/revoke it in Azure and update the host's secret store. Never put the replacement in chat or Git. |
| Public frontend/API domains are not yet known. | API URL and CORS origin depend on them. | Use clearly marked placeholders until the public origins are provided. |
| SQL Server must be reachable securely from the API host. | The app cannot serve database-backed requests otherwise. | Confirm the production SQL host, firewall/network access, database name, login, and certificate chain outside this repository. |
| The app runs scheduled jobs in its API process. | Serverless or multi-replica deployment may run duplicate jobs. | Use a persistent single API instance initially, or move scheduled jobs to a single dedicated worker before scaling replicas. |
| The calendar-related chunk remains about 260 KB before compression. | Staff calendar pages still need a larger download. | Keep it out of the initial page load and recheck bundle sizes when the calendar changes. |

## Open Questions

- What are the public frontend and API origins? If they are not ready, should
  deployment docs use placeholders?
- Will the deployed API use the currently intended SQL Server and Azure
  Storage accounts, with credentials configured directly in the host's secret
  manager?
- Credential rotation must be performed by the owner in Azure; do not share
  the replacement key in chat.
