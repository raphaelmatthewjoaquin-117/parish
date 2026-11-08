# Implementation Plan: Supabase Identity and Access

## Overview

Move staff sign-in, authorization, password flows, profiles, user management,
roles, and module permissions to the restricted Supabase PostgreSQL runtime.
Keep the existing API and `x-admin-token` contract, use a signed eight-hour
token that never contains the signing secret, and preserve SQL Server as the
default identity provider until the PostgreSQL path passes its gates. Other
business routes remain SQL Server-backed until their later migration modules;
this plan does not represent a full application cutover or recovered parish
data.

The PostgreSQL-specific readiness endpoint has now been verified over HTTP
(200); whole-app readiness correctly remains 503 because the app still depends
on unavailable SQL Server routes. The separate live graceful-shutdown smoke
check remains open in the foundation checklist.

## Architecture Decisions

- Add a server-side `IDENTITY_DATABASE` setting, defaulting to `sqlserver`.
  Selecting PostgreSQL must never silently fall back to SQL Server if
  PostgreSQL is unavailable. Keep the existing event-provider setting
  independent.
- Keep all PostgreSQL access in Express through the existing restricted pool.
  Use parameterized SQL and grant only the reviewed identity-table access,
  including any required identity-sequence privileges. The Supabase owner
  connection is never an application runtime connection.
- Keep the identity provider and the remaining feature providers separate:
  after identity is enabled, authentication can use PostgreSQL while
  non-identity route handlers still use SQL Server. Do not claim those routes
  are migrated.
- Use a small server-side HMAC token helper with a new
  `ADMIN_TOKEN_SIGNING_SECRET`; require a securely generated secret and rotate
  the old `ADMIN_TOKEN` when deploying. The token remains opaque to the
  frontend, which continues sending `x-admin-token` and storing the returned
  `token` as it does today. No new dependency is expected.
- On every protected request, verify the signature and expiry, then load the
  current account, role, permission overrides, and forced-password-change
  state from the selected identity database. Fail closed with a safe
  unavailable response when PostgreSQL cannot authorize the request; never
  continue with role or permissions from token claims.
- Preserve the current five staff roles, role precedence, route-role checks,
  module overrides, password validation/hash compatibility, rate limiting,
  email delivery, token expiry, and one-time reset behavior.
- Reconcile the deployed schema with every identity query and write before
  routing traffic. Add only identity-scoped schema/grant/RLS changes. The
  shared backend database role requires table-level policies for the trusted
  Express service; request-level authorization remains enforced in the
  backend. Verify the effective grants and RLS behavior using the restricted
  runtime role.
- Keep SQL Server behavior and the existing bootstrap command available as
  fallback. Add a separate PostgreSQL first-admin bootstrap that requires an
  interactive hidden password prompt, an empty staff table, and explicit
  operator confirmation; never seed a default account automatically.
- No live parish staff rows exist in Supabase. Use disposable, clearly
  labeled integration accounts and remove them after testing.

## Threat Model

| Boundary / asset | Abuse case | Required control |
|---|---|---|
| Browser to admin API | Forged, modified, expired, or replayed token gains access. | HMAC verification, bounded expiry, constant-time signature comparison, and fresh database authorization on every protected request. |
| HTTP form fields to SQL | Login, reset, profile, or role input alters a query. | Boundary validation and parameterized PostgreSQL statements. |
| Express service to Supabase | A database error falls back to stale token claims or an overprivileged role. | Fail closed; restricted non-owner, `NOBYPASSRLS` role; reviewed table grants and RLS policies; no automatic provider fallback. |
| Password/reset flow | Passwords or bearer reset tokens leak, reset is reused, or account existence is disclosed. | Continue storing password hashes and reset-token hashes only; transactional, expiring, single-use reset; safe logging and response review. |
| First-admin operation | A shared/default password or a second bootstrap administrator is created. | Hidden password entry, empty-table check under a transaction/lock, operator confirmation, and no startup bootstrap. |

## Task List

### Phase 1: Schema and provider boundary

- [ ] Task 1: Reconcile identity schema and add restricted-role policies.
- [ ] Task 2: Add the opt-in PostgreSQL identity repository and provider
  selection.

### Checkpoint: Database boundary

- [ ] Schema compatibility is checked against every identity query.
- [ ] Restricted-role grants and RLS are verified without using the owner
  connection from the app.
- [ ] SQL Server remains the default; PostgreSQL selection fails closed.

### Phase 2: Authentication

- [ ] Task 3: Add signed staff tokens and PostgreSQL-backed authorization.
- [ ] Task 4: Port staff sign-in and verification to the selected provider.

### Checkpoint: Sign-in

- [ ] Login and verification use the existing response/header contract.
- [ ] Tampered, expired, deleted/missing-account, and unauthorized requests
  are rejected.
- [ ] Current roles, permission overrides, and password-change state come
  from the database, not token claims.

### Phase 3: Passwords and staff management

- [ ] Task 5: Port password change and reset flows.
- [ ] Task 6: Port profiles, users, roles, permissions, and audit records.

### Checkpoint: Staff workflows

- [ ] Focused route and repository tests pass for password recovery and staff
  management.
- [ ] Email and audit behavior is preserved; no passwords or tokens appear
  in output.

### Phase 4: Provisioning and release gate

- [ ] Task 7: Add secure PostgreSQL first-admin bootstrap.
- [ ] Task 8: Complete identity integration verification and document the
  opt-in cutover.

### Checkpoint: Identity module complete

- [ ] Focused auth/database tests, full tests, build, and lint pass.
- [ ] Restricted-role integration checks pass with a disposable test account.
- [ ] The provider remains SQL Server by default; production PostgreSQL
  enablement is an explicit operator action.
- [ ] Remaining SQL Server-backed routes and the lack of recovered records
  are documented accurately.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Baseline identity columns or constraints differ from route assumptions. | Writes fail or uniqueness/authorization behavior changes. | Inventory every identity query and reconcile schema additively before changing providers. Test on a disposable database/account first. |
| Some SQL Server parameter bindings allow longer email/audit values than the actual source columns. | Widening PostgreSQL to match a parameter declaration would diverge from the source database contract. | Keep `EmailAddress` at 255 and `ChangedBy` at 256, matching the SQL Server baseline; do not treat query binding sizes as column sizes. |
| RLS is enabled but the restricted runtime role has no policies/grants. | Login and identity operations fail. | Add narrowly scoped identity-table grants/policies, review them, and verify as the runtime role before enabling the provider. |
| A shared service role cannot express each staff member's identity to PostgreSQL RLS. | RLS alone does not provide per-staff row isolation. | Treat the server as the trusted authorization boundary, enforce current database-backed permissions on every request, and keep RLS scoped to the backend role and identity tables only. |
| Existing `ADMIN_TOKEN` is exposed in browser tokens. | Anyone holding an old token may know the former signing secret. | Use a separate signing secret, rotate the old value during deployment, invalidate old tokens, and require all staff to sign in again. |
| Tokens remain in browser local storage under the approved compatibility scope. | An unrelated XSS could read a live token. | Do not broaden storage behavior in this migration; document this residual risk and retain existing security headers/XSS protections. A cookie/session redesign needs separate approval. |
| Forgot-password currently returns a distinct 404 for an unknown staff email. | The endpoint can reveal whether an account exists. | Preserve the approved current API behavior for this migration; record response normalization as a security improvement requiring explicit approval before changing behavior. |
| No staff account or password was recovered. | There is no existing account to use after identity cutover. | Require an authorized operator to run the one-time secure bootstrap; never create a shared/default account. |
| Most feature routes still use SQL Server. | The app is not fully deployable on PostgreSQL after identity alone. | Keep the current fallback and continue the approved capability-map sequence; do not remove `mssql` or mark whole-app readiness healthy. |

## Open Questions

- Who will run the first-admin bootstrap after the identity migration is
  reviewed and applied?
- Who will set `ADMIN_TOKEN_SIGNING_SECRET` and rotate the old
  `ADMIN_TOKEN` in the deployment environment? Do not send either value in
  chat.
- The target remains the existing persistent Render API unless the user
  changes that assumption; confirm connection/pool settings before production
  enablement.
- The current browser storage behavior and unknown-email 404 response are
  preserved by the approved compatibility scope. Any change to either
  requires separate approval.

## Out of Scope

- Migrating public content, events, contact/prayer requests, bookings,
  certificates, operations, finance, or reporting.
- Migrating parishioner portal authentication.
- Removing SQL Server or `mssql`, or making PostgreSQL the default for the
  entire application.
- Importing or claiming recovery of old parish records or staff accounts.
- Applying a live production identity migration or changing deployment
  secrets before the migration and operator actions are reviewed.
