# Supabase Identity and Access Tasks

Implementation tracker for
[`identity-access-plan.md`](./identity-access-plan.md) and
[`SPEC-identity-access.md`](../SPEC-identity-access.md). The existing
deployment and Supabase foundation task lists are separate and unchanged.

## Phase 1: Schema and provider boundary

- [ ] Task 1: Reconcile identity schema and add restricted-role policies.
  - [x] Compare identity tables, fields, lengths, keys, and constraints
    with the SQL Server baseline and route queries. The database widths
    (email 255, audit ChangedBy 256) match the SQL Server baseline; do not
    widen them to match oversized query parameter declarations.
  - [x] Add an additive migration for case-insensitive uniqueness, canonical
    staff-role metadata, the restricted runtime role's least-privilege
    identity-table/sequence grants, and identity-only RLS policies.
  - [x] Add a read-only identity access verifier. Running it before the
    migration correctly fails because the restricted role currently has no
    identity RLS policies or grants.
  - [x] Add `npm run db:verify-identity` so the checks can run with the
    configured restricted role without requiring `psql`.
  - [x] Apply the reviewed migration with an owner/admin connection.
  - [x] Run `npm run db:verify-identity` with the restricted runtime role;
    all identity table, RLS, grant, sequence, and schema checks passed.
  - Acceptance: Identity column lengths match the SQL Server baseline and
    case-insensitive email/role uniqueness is enforced.
  - Acceptance: The runtime role can access only the reviewed identity
    tables, has the required RLS policies and sequence access, and cannot
    bypass RLS or own objects.
  - Verify: Run `npm run db:verify-identity` after an explicitly approved
    live apply. The owner/admin applies the migration; the app runtime never
    does.
  - Dependencies: Foundation PostgreSQL connection and restricted-role
    verification.
  - Files likely touched: `parishweb/supabase/migrations/`,
    `parishweb/supabase/verify-identity-access.sql`.
  - Estimated scope: Medium.

- [x] Task 2: Add the opt-in PostgreSQL identity repository and provider
  selection.
  - [x] Add `IDENTITY_DATABASE`, defaulting to SQL Server, independently of
    `EVENTS_DATABASE`.
  - [x] Add parameterized PostgreSQL repository operations for identity
    lookups and shared current-user role/permission state.
  - [x] Require a configured PostgreSQL URL when PostgreSQL is explicitly
    selected; repository errors propagate and cannot fall back to SQL Server.
  - Acceptance: Existing behavior remains SQL Server-backed by default.
  - Acceptance: PostgreSQL selection is server-only and fails visibly and
    safely when unavailable.
  - Verify: Focused auth tests, full suite, build, and lint pass. A live
    restricted-role read-only lookup returns no matching staff record and
    changes no data.
  - Dependencies: Task 1.
  - Files likely touched: `parishweb/src/db/`, `parishweb/src/auth/`,
    environment example, focused tests.
  - Estimated scope: Medium.

## Checkpoint: Database boundary

- [x] Schema and RLS/grants are checked as the restricted runtime role.
- [ ] PostgreSQL remains opt-in and SQL Server remains the default.
- [ ] No owner credential or connection string is added to app config,
  browser code, logs, or tracked files.

## Phase 2: Authentication

- [x] Task 3: Add signed staff tokens and PostgreSQL-backed authorization.
  - [x] Implement versioned HMAC token issue/verification with an
    `ADMIN_TOKEN_SIGNING_SECRET`, constant-time signature comparison, and the
    existing eight-hour lifetime.
  - [x] Update `requireAdmin` to load current account/role/permissions and
    password-change state through the selected identity provider on every
    protected request.
  - [x] Fail closed with a safe response on identity database errors; do not
    authorize from token claims or stale state.
  - Acceptance: The browser contract remains a `token` response and the
    `x-admin-token` header; the signing secret is never returned.
  - Acceptance: Invalid, tampered, expired, deleted-user, and unavailable
    database cases cannot authorize protected work.
  - Verify: Unit-test token issue, tampering, expiry, malformed tokens,
    secret configuration, current role refresh, permission overrides, forced
    password change, and database failure propagation. Full tests/build/lint
    pass.
  - Dependencies: Task 2.
  - Files likely touched: `parishweb/src/auth/`, `parishweb/server.js`,
    focused auth tests.
  - Estimated scope: Medium.

- [ ] Task 4: Port staff sign-in and verification to the selected provider.
  - [x] Query PostgreSQL for email/username and current supported roles;
    retain ASP.NET Identity V3 PBKDF2 hash compatibility.
  - [x] Issue signed tokens and preserve the current response shape, generic
    invalid-login response, local-preview restrictions, and rate limiter.
  - [x] Keep `/api/admin/verify` consistent with fresh current-database
    authorization.
  - Acceptance: PostgreSQL sign-in works for a disposable labeled test
    account; invalid credentials receive the established response.
  - Acceptance: SQL Server login remains selectable and is still the default.
  - Verify: Auth service tests cover supported/unsupported roles, invalid
    credentials, and PostgreSQL errors; full tests/build/lint pass. Live
    restricted-role sign-in with a labeled disposable account remains pending.
  - Dependencies: Tasks 2 and 3.
  - Files likely touched: `parishweb/server.js`, `parishweb/src/auth/`,
    auth route tests.
  - Estimated scope: Medium.

## Checkpoint: Sign-in

- [x] Signed token compatibility, expiry, and tamper rejection pass.
- [x] Current role and permission state is refreshed from PostgreSQL for
  every protected request.
- [x] The SQL Server fallback remains the default and does not mask an
  explicitly selected PostgreSQL failure.

## Phase 3: Passwords and staff management

- [ ] Task 5: Port password change and reset flows.
  - [x] Route authenticated password changes through PostgreSQL when
    selected, retaining current-password verification, ASP.NET Identity
    hashing, forced-change clearing, and best-effort audit behavior.
  - [x] Port forgot-password lookup/token creation and reset-password writes
    to PostgreSQL when selected; reset token consumption and password update
    run in one transaction.
  - [x] Preserve password validation, rate limiting, email delivery
    behavior, 30-minute reset expiry, hashed reset tokens, one-time use,
    and current API responses.
  - [x] Ensure reset-token invalidation and password update are atomic; do
    not log or return the raw reset token except in the email link.
  - Acceptance: Invalid/expired/reused reset tokens fail and valid tokens
    can be used once.
  - Acceptance: Forced-password-change behavior is preserved.
  - Verify: Repository unit tests cover successful/invalid password changes,
    best-effort audit failure, reset token lifetime/query flow, invalid/reused
    tokens, and transaction rollback. Route-level/email-failure tests and live
    PostgreSQL verification remain pending.
  - Dependencies: Tasks 2-4.
  - Files likely touched: `parishweb/server.js`, `parishweb/src/auth/`,
    password-flow tests.
  - Estimated scope: Medium.

- [x] Task 6: Port profiles, users, roles, permissions, and audit records.
  - [x] Move own-profile changes, staff listing/creation/edit/delete, role
    assignment, permission overrides, and user-management audit writes to
    PostgreSQL.
  - [x] Preserve route-level role checks, validation, duplicate handling,
    transaction boundaries, audit details, and safe response fields.
  - [x] Ensure role/permission changes affect the next protected request
    through the existing per-request authorization refresh.
  - Acceptance: Staff management operations and audit history work against
    PostgreSQL without exposing password hashes or private fields.
  - Acceptance: Failed writes roll back related role/permission/audit
    changes as one unit.
  - Verify: Focused repository tests cover staff listing, duplicate handling,
    admin-target protection, atomic user/role/audit writes, deletion, and
    permission transactions; all 10 focused tests pass. Route-level checks
    remain pending live integration verification.
  - Dependencies: Tasks 1-4.
  - Files likely touched: `parishweb/server.js`, `parishweb/src/auth/`,
    staff-management tests.
  - Estimated scope: Medium.

## Checkpoint: Staff workflows

- [ ] Password, profile, user, role, permission, and audit tests pass.
- [ ] Email and authorization behavior match the approved spec.
- [ ] Disposable test identities are removed after live integration checks.

## Phase 4: Provisioning and release gate

- [ ] Task 7: Add secure PostgreSQL first-admin bootstrap.
  - [ ] Add a separate PostgreSQL bootstrap command; leave the existing
    SQL Server bootstrap command available.
  - [ ] Require hidden interactive password and confirmation, an empty
    staff table under a transaction/lock, valid configured Admin role,
    operator confirmation, and an audit record.
  - [ ] Never run bootstrap on server startup or include a default password.
  - Acceptance: Bootstrap creates exactly one Admin on an empty test schema
    and refuses a non-empty table or invalid confirmation.
  - Acceptance: Password entry is not echoed, stored in shell history,
    printed, or logged.
  - Verify: Unit-test validation and transaction failures; run only against a
    disposable schema/account after review.
  - Dependencies: Tasks 1-2.
  - Files likely touched: `parishweb/scripts/`, `parishweb/package.json`,
    bootstrap tests.
  - Estimated scope: Medium.

- [ ] Task 8: Complete identity integration verification and document the
  opt-in cutover.
  - [ ] Verify PostgreSQL login, verify, password flows, profile, management,
    permissions, and audit with the restricted role and disposable data.
  - [ ] Run focused auth/database tests, full test suite, build, and lint.
  - [ ] Document provider configuration, signing-secret rotation and token
    invalidation, first-admin operator steps, fallback, and remaining
    SQL Server-backed modules.
  - [ ] Keep SQL Server as the default until an explicit production
    enablement decision; do not remove `mssql`.
  - Acceptance: No identity route reports success when PostgreSQL is
    unavailable, and all authorization checks fail closed.
  - Acceptance: Documentation states that Supabase contains schema only and
    no historical parish data/staff accounts were recovered.
  - Verify: `npm run test:run -- src/db src/auth`, `npm run test:run`,
    `npm run build`, `npm run lint`, plus live restricted-role checks.
  - Dependencies: Tasks 1-7.
  - Files likely touched: `README.md`, `parishweb/.env.example`,
    auth/database tests, migration docs.
  - Estimated scope: Medium.

## Checkpoint: Identity module complete

- [ ] Focused tests, full tests, build, and lint pass.
- [ ] Restricted-role live integration checks pass with disposable data.
- [ ] First-admin bootstrap and signing-secret rotation have named operators.
- [ ] SQL Server remains the default until production enablement is approved.
- [ ] No unrelated feature routes are described as PostgreSQL-backed.
