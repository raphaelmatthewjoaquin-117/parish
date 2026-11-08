# Supabase Foundation Tasks

Implementation tracker for
[`supabase-foundation-plan.md`](./supabase-foundation-plan.md) and
[`SPEC-postgres-foundation.md`](../SPEC-postgres-foundation.md). The existing
deployment task list in `tasks/todo.md` is separate and unchanged.

## Phase 1: Secure runtime role

- [ ] Task 1: Define and provision a restricted PostgreSQL runtime role.
  - [x] Add startup validation rejecting superuser, `BYPASSRLS`, object-owner,
    database-owner, and role-membership connections.
  - [x] Add and apply a manual owner-only setup script that creates no app
    grants and exposes no password. Catalog checks confirm the role is a
    login, not a superuser or RLS-bypass role, owns no app objects/database,
    and has no role memberships.
  - [x] Set its password through the hidden-input helper and configure the
    ignored backend `.env` to use this restricted role; credentials were not
    printed or shared.
  - [x] Add `npm run db:configure-runtime` for systems without `psql`; it
    uses hidden terminal input and updates only the ignored `.env`.
  - [x] Run the local helper and verify TLS connection using the new URL.
  - Acceptance: A reviewed, repeatable role setup uses a non-superuser,
    non-owner role with `NOBYPASSRLS`; no password is committed.
  - Acceptance: Read-only checks prove the runtime role has no app-table
    grants until a feature migration explicitly adds them.
  - Verify: Apply role setup in Supabase and inspect catalog role attributes,
    ownership, and grants using the runtime role.
  - Dependencies: None.
  - Files likely touched: `parishweb/supabase/migrations/`,
    `parishweb/src/db/`, `README.md`.
  - Estimated scope: Medium.

- [x] Task 2: Configure the backend with the restricted runtime URL.
  - Acceptance: The server reads only the restricted role URL and trusted CA
    path from ignored environment configuration; secrets remain server-side.
  - Acceptance: SQL Server remains the default provider until later cutover.
  - Verify: Confirm the env file is ignored; run a TLS PostgreSQL ping and
    verify no credentials appear in logs or build output.
  - Dependencies: Task 1.
  - Files likely touched: `parishweb/.env.example`, `README.md`, database
    configuration tests.
  - Estimated scope: Small.

## Checkpoint: Restricted role

- [x] Runtime connection succeeds with TLS verification enabled.
- [x] Runtime role has `NOBYPASSRLS`, is not an owner/superuser, has no
  memberships or ownership, and has no public table data privileges.
- [ ] No secrets or certificate contents are tracked or logged.

## Phase 2: Startup and readiness

- [ ] Task 3: Add PostgreSQL-specific readiness while preserving whole-app
  readiness semantics.
  - [x] Implement `/readyz/postgres` and verify the required Events table
    through `to_regclass`; keep `/readyz` dependent on all remaining stores.
  - [x] Verify PostgreSQL database readiness live with the restricted role.
  - [x] Verify both HTTP readiness endpoints against an isolated local server
    process: `/readyz/postgres` returned 200 and `/readyz` returned 503 while
    SQL Server was unavailable, as expected.
  - Acceptance: PostgreSQL readiness reflects the actual PostgreSQL query and
    required schema check, independently of SQL Server status.
  - Acceptance: Whole-app readiness remains not-ready while still-required
    SQL Server-backed routes are unavailable; responses expose no internals.
  - Verify: Test PostgreSQL success/failure and SQL Server unavailable cases;
    request both readiness endpoints locally.
  - Dependencies: Task 2.
  - Files likely touched: `parishweb/server.js`,
    `parishweb/src/db/readiness.js`, readiness tests/declarations.
  - Estimated scope: Medium.

- [ ] Task 4: Close the PostgreSQL pool during graceful shutdown.
  - [x] Add SIGINT/SIGTERM shutdown handling and stop scheduled intervals.
  - [x] Test that pool shutdown waits for any in-flight initialization.
  - [ ] Verify graceful shutdown against the live restricted-role connection.
  - Acceptance: SIGINT/SIGTERM closes the PostgreSQL pool once without
    hanging or masking the original startup error.
  - Verify: Unit-test lifecycle helpers and start/stop the backend with the
    restricted role.
  - Dependencies: Task 2.
  - Files likely touched: `parishweb/server.js`,
    `parishweb/src/db/postgres-pool.js`, pool tests/declarations.
  - Estimated scope: Medium.

## Checkpoint: Foundation verification

- [x] `npm run test:run -- src/db` passes.
- [x] `npm run test:run` passes.
- [x] `npm run build` and `npm run lint` pass.
- [x] PostgreSQL-specific database readiness succeeds with the restricted role.
- [ ] Whole-app readiness stays not-ready while SQL Server is unavailable.

## Phase 3: Handoff

- [ ] Task 5: Document verified role setup, runtime connection, readiness,
  fallback, and the lack of recovered parish data.
  - [x] Document the role validator, manual setup script, readiness routes,
    and no-grant status.
  - [ ] Confirm documentation against the live restricted-role setup.
  - Acceptance: README and env example distinguish owner-only setup from the
    restricted app runtime and contain placeholders only.
  - Verify: Review docs against a successful restricted-role connection and
    run `git diff --check`.
  - Dependencies: Tasks 1-4.
  - Files likely touched: `README.md`, `parishweb/.env.example`.
  - Estimated scope: Small.

- [ ] Foundation review: inspect the diff, report unresolved deployment/user
  actions, then prepare and approve the `identity-access` spec before
  migrating authentication.

## Checkpoint: Foundation complete

- [ ] Restricted role, TLS, readiness, and pool lifecycle are verified.
- [ ] SQL Server fallback remains intact.
- [ ] Feature routes and app-wide cutover remain explicitly incomplete.
