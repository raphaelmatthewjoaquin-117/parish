# Spec: identity-access

## Objective

Move parish staff authentication and authorization from SQL Server to the
restricted Supabase PostgreSQL runtime, following module
[`identity-access`](./CAPABILITY-MAP.md). Staff sign-in, password recovery,
profiles, users, roles, module permissions, and the authorization checks used
by protected API routes must continue to work when SQL Server is unavailable.

The migration must preserve the existing API contract and authorization
semantics while improving the admin token so the server signing secret is
never returned to a browser. PostgreSQL remains opt-in until this module is
verified; SQL Server remains the default fallback. Supabase has no recovered
parish records, so the first administrator must be provisioned as a new account
through a secure, documented bootstrap process.

This module covers staff/admin identity only. Parishioner portal
authentication, public-content routes, service requests, and operations or
finance data are separate modules in the approved capability map.

## Assumptions

1. Keep the existing API response field (`token`), `x-admin-token` request
   header, eight-hour staff token lifetime, and current frontend storage
   behavior so the UI does not need an unrelated session migration.
2. Replace the current token internals with a cryptographically signed,
   expiring token. The signing secret must not appear in the token or browser
   response. The existing authorization middleware will continue refreshing
   staff role, module permissions, and `MustChangePassword` from PostgreSQL.
3. Keep the existing staff roles (`Admin`, `ParishPriest`, `Secretary`,
   `Bookkeeper`, `Staff`), role precedence, route role checks, permission
   overrides, and forced-password-change behavior.
4. Preserve password verification compatibility with existing
   ASP.NET Identity V3 PBKDF2 hashes and the current password-reset expiration,
   single-use, email, validation, and error-response behavior.
5. Add an explicit server-side identity provider setting with SQL Server as
   the default. Do not silently fall back to SQL Server after PostgreSQL is
   explicitly selected and unavailable.
6. Only the server connects to PostgreSQL. The runtime role remains
   non-superuser, `NOBYPASSRLS`, non-owner, and without inherited role
   memberships. This module adds only the grants and RLS policies needed for
   the identity tables.
7. The Supabase project has no migrated staff rows. Do not claim existing
   staff accounts or passwords were recovered; use a secure first-admin
   bootstrap rather than a known default password.

## Tech Stack

- Node.js ES modules and Express 5 API
- PostgreSQL on Supabase through the existing `pg` 8 pool
- Existing React/TypeScript frontend and `x-admin-token` API contract
- Existing PBKDF2 password-hash format and Resend email integration
- Vitest 4, TypeScript 6, ESLint 10
- PostgreSQL migration SQL under `parishweb/supabase/migrations/`

No new dependency is expected.

## Commands

Run from `parishweb`:

```powershell
npm run test:run -- src/db src/auth
npm run test:run
npm run build
npm run lint
npm run server
```

Tests that use Supabase must use the restricted runtime role and must never
print connection strings, passwords, reset tokens, or signing secrets.

## Project Structure

- `server.js` — admin routes, token validation, authorization middleware,
  provider selection, and SQL Server fallback
- `src/auth/` — PostgreSQL staff identity queries and tested auth helpers
- `src/db/` — existing PostgreSQL pool and readiness foundation
- `parishweb/supabase/migrations/` — identity schema compatibility,
  identity-table grants, and reviewed RLS policies
- `scripts/` — secure first-admin bootstrap using hidden password input
- `src/pages/`, `src/components/`, and `src/api/client.ts` — current admin
  login, user-management, profile, and password-reset client contract
- `README.md` and `.env.example` — server-only identity configuration and
  safe bootstrap instructions

## Code Style

Use the existing project style and parameterized PostgreSQL queries:

```js
const result = await pool.query(
  `SELECT "UserId", "EmailAddress", "PasswordHash", "MustChangePassword"
   FROM "public"."AspNetUsers"
   WHERE lower("EmailAddress") = lower($1)
      OR lower("UserName") = lower($1)
   LIMIT 1`,
  [login],
);
```

Keep password hashing and token signing in server-side helpers, compare
signatures with a constant-time comparison, and surface database errors using
the repository's standard safe logging pattern. Preserve explicit validation
and do not silently return success when a database operation fails.

## Testing Strategy

- Unit tests cover token issue/verification/tampering/expiry, PBKDF2 hash
  compatibility, credential validation, role precedence, module overrides,
  password-change enforcement, and provider selection.
- Route tests cover login, verify, logout/client invalidation expectations,
  password change, forgot/reset flows, profile update, user CRUD, role
  assignment, permissions, audit records, and SQL Server fallback.
- PostgreSQL integration checks verify the restricted role's table grants,
  RLS behavior, uniqueness, transactions, and access to only the required
  identity tables. No real staff records or secrets are used in automated
  tests.
- A clearly labeled disposable test identity may be created and removed in a
  dedicated integration run. Do not use recovered-data claims or known
  production passwords.
- Before completion, run focused auth/database tests, the full test suite,
  build, and lint. Verify the signed token through the real API without
  exposing its contents in logs or chat.

## Boundaries

- Always:
  - Keep credentials, password hashes, reset tokens, and signing secrets out
    of browser bundles, API responses, logs, tracked files, and chat.
  - Keep PostgreSQL connections server-side and use parameterized SQL.
  - Validate the current role and permissions from PostgreSQL on protected
    requests; a token role claim alone is not authorization.
  - Preserve rate limits, generic invalid-login behavior, reset-token
    single-use and expiry, password-change enforcement, and route-level
    authorization.
  - Keep SQL Server as the default until the PostgreSQL identity path is
    tested and explicitly enabled.
  - Provide a secure first-admin bootstrap for an empty database without a
    hard-coded default password.
- Ask first:
  - Any change to the staff roles, permission model, token lifetime, login
    behavior, or public API contract.
  - Any new dependency, production schema/grant change beyond the reviewed
    identity-table scope, or production credential rotation.
- Never:
  - Use the Supabase owner role as the normal application runtime.
  - Expose the token-signing secret in a returned token or browser response.
  - Disable TLS or RLS to make the migration pass.
  - Automatically fall back to SQL Server when PostgreSQL is explicitly
    selected but fails.
  - Create a shared/default production administrator password or claim staff
    accounts were recovered.

## Success Criteria

1. PostgreSQL can authenticate a staff user using the existing ASP.NET
   Identity V3 password-hash format and existing email/username login rules.
2. The returned `token` and `x-admin-token` contract remains compatible with
   the current frontend, but the token is cryptographically signed, expires
   after the configured lifetime, rejects tampering, and does not reveal the
   signing secret.
3. Protected requests read current staff role, permission overrides, and
   `MustChangePassword` from PostgreSQL and preserve existing role and module
   authorization behavior.
4. Password change, forgot-password, and reset-password flows use PostgreSQL
   transactions and preserve validation, rate limiting, email delivery, token
   expiry, and one-time use.
5. Admin profile and user/role/permission management APIs work against
   PostgreSQL, including duplicate handling and user-management audit records.
6. Required PostgreSQL schema fields and constraints are explicitly migrated;
   the restricted runtime role receives only the reviewed identity-table
   grants and policies it needs.
7. A first administrator can be created securely on an empty schema, without
   writing the password to command history, logs, tracked files, or chat.
8. SQL Server remains the default fallback, and the PostgreSQL identity
   provider never reports success-shaped behavior when its database is
   unavailable.
9. Focused tests, full tests, build, lint, and live restricted-role
   verification pass before enabling PostgreSQL identity in production.

## Open Questions

- The existing `ADMIN_TOKEN` value is embedded in current tokens and should
  therefore be treated as exposed to admin browsers. Introduce a new
  `ADMIN_TOKEN_SIGNING_SECRET` and rotate the existing production value when
  deploying the signed-token implementation.
- The schema-only baseline contains no staff accounts. Who will run the
  first-admin bootstrap after identity migrations are applied? The bootstrap
  must use a hidden password prompt and must not run automatically at server
  startup.
- The current Supabase `AspNetUsers` definition may not match every SQL Server
  column length or uniqueness behavior used by existing routes. Reconcile
  schema differences through an additive PostgreSQL migration before routing
  identity writes to PostgreSQL.
- Deployment remains on the existing persistent Render API unless the user
  says otherwise; the restricted runtime connection and readiness checks
  have been verified locally, but production configuration has not been
  changed.
