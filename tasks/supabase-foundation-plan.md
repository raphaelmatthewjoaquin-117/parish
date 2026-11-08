# Implementation Plan: Supabase PostgreSQL Foundation

## Overview

Complete the `postgres-foundation` module in
[`SPEC-postgres-foundation.md`](../SPEC-postgres-foundation.md). The repository
already has a PostgreSQL connection pool and CA-path support from the prior
increment; the live Supabase connection and a temporary, labeled Events CRUD
check succeeded using the current connection role. However, that role bypasses
RLS, SQL Server is still required by most routes and for admin authorization,
and `/readyz` is consequently not ready while SQL Server is inaccessible.

This plan hardens and verifies the foundation without changing the app-wide
database default or migrating feature routes. The existing deployment plan in
`tasks/plan.md` and task list in `tasks/todo.md` remain untouched.

## Architecture Decisions

- Keep PostgreSQL configuration in the Express server process, with TLS
  verification and the downloaded Supabase CA configured by file path.
- Use a dedicated, non-owner runtime role with `NOBYPASSRLS`. Keep owner
  credentials separate and use them only for a human-applied setup/migration.
- The foundation role receives no application-table access by default.
  Feature modules will add explicit table grants and RLS policies as needed.
- Keep SQL Server behavior as the default until feature routes and identity
  have been migrated. Do not remove `mssql` in this module.
- Report PostgreSQL readiness separately from the whole application's
  readiness so an unavailable SQL Server does not obscure a successful
  PostgreSQL connection, while the full app is not incorrectly marked ready.
- Do not write data during foundation verification. The prior temporary
  `TEST ONLY` event was deleted.

## Task List

### Phase 1: Secure runtime role

- [ ] Task 1: Define and provision the restricted PostgreSQL runtime role.
  Create a repeatable, reviewed setup migration/instructions for a
  non-superuser, non-owner role with `NOBYPASSRLS`; keep password entry out of
  tracked files and application logs. Verify role attributes, schema access,
  ownership, and that it has no application-table grants before feature
  migrations.
- [ ] Task 2: Point local runtime configuration to the restricted role.
  Document/configure the app URL and CA path using placeholders only. Do not
  copy credentials into chat, source, or frontend variables. Preserve SQL
  Server as the default provider.

### Checkpoint: Restricted role

- [ ] Owner/admin applies role setup in Supabase; the runtime role can connect
  with TLS verification enabled.
- [ ] Read-only SQL verifies role is not superuser, does not bypass RLS, owns
  no application tables, and has no unapproved table grants.
- [ ] No credential or CA material is tracked or logged.

### Phase 2: Startup and readiness

- [ ] Task 3: Make PostgreSQL startup/readiness explicit and observable.
  Add a PostgreSQL-specific readiness result/endpoint that checks the
  configured database and required schema metadata without requiring SQL
  Server. Preserve whole-application readiness semantics: report not-ready
  while still-required SQL Server routes are unavailable. Add failure tests.
- [ ] Task 4: Add graceful PostgreSQL pool shutdown and verify lifecycle.
  Close the pool on graceful process shutdown, avoid duplicate initialization,
  and propagate initialization errors without leaking connection details.

### Checkpoint: Foundation verification

- [ ] Focused database tests pass: `npm run test:run -- src/db`.
- [ ] Full tests pass: `npm run test:run`.
- [ ] Build and lint pass: `npm run build` and `npm run lint`.
- [ ] PostgreSQL-specific readiness succeeds using the restricted role.
- [ ] Whole-app readiness correctly remains not-ready while required
  SQL Server-backed features are unavailable.

### Phase 3: Handoff to feature migration

- [ ] Task 5: Update migration documentation with verified role setup,
  connection mode, readiness endpoints, and fallback instructions. State
  clearly that no parish records were recovered and feature modules must add
  their own grants/policies.
- [ ] Review the foundation diff and record remaining deployment/user actions.
  Then write/approve the next module spec (`identity-access`) before porting
  authentication or authorization routes.

### Checkpoint: Foundation complete

- [ ] Dedicated restricted role and TLS connection are verified.
- [ ] Readiness behavior and pool lifecycle are tested.
- [ ] SQL Server fallback remains intact.
- [ ] No feature routes are described as migrated unless implemented and
  verified against PostgreSQL.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Current Supabase role bypasses RLS. | Application queries would not be constrained by RLS. | Provision a separate runtime role with `NOBYPASSRLS` and no table ownership; inspect role attributes/grants before using it. |
| RLS is enabled but policies are absent. | Restricted role cannot use application tables until a feature module grants access and adds policies. | Give the foundation role no app-table access; create narrowly scoped grants/policies with each feature migration. |
| Most routes and admin authentication still require unavailable SQL Server. | The website cannot be considered fully migrated or ready. | Keep the existing fallback and migrate identity/features in the approved capability order. |
| Supabase owner password is needed for role setup. | Secret could be exposed in source or chat. | Owner applies SQL in the Supabase dashboard; enter/rotate passwords there and use only the restricted URL in the API environment. |
| API deployment mode is unconfirmed. | Pool size and Supabase connection mode may not match runtime constraints. | Confirm target before final production pool settings; current environment appears intended for a persistent Render API. |

## Open Questions

- Confirm the API will remain on the existing persistent Render service, rather
  than moving to serverless. This affects connection mode and pool limits.
- Confirm you can apply the owner-only role setup in Supabase, or identify who
  will do it. Do not send the owner password here.
- Decide whether a PostgreSQL-only readiness endpoint is acceptable alongside
  the existing whole-app readiness check.

## Out of Scope

- Porting admin authentication/users or any feature route.
- Making PostgreSQL the app-wide default or removing SQL Server dependencies.
- Importing old parish records without a source dataset.
- Changing production deployment configuration or credentials.
