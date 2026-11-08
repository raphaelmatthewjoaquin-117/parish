# Spec: postgres-foundation

## Objective

Establish a safe PostgreSQL foundation for migrating the Express application
from SQL Server to Supabase. The backend must connect only from the server,
validate startup/readiness against PostgreSQL, apply schema changes through a
controlled migration path, and use a dedicated restricted runtime database
role instead of the Supabase `postgres` owner role.

This module does not port application feature routes. SQL Server remains
available as a fallback until the later feature modules and cutover are
complete. Supabase currently contains schema only; recovering or importing
parish records is out of scope.

## Assumptions

1. The existing React/Vite frontend and Express API remain in one project.
2. PostgreSQL is accessed with the existing `pg` dependency and a
   server-side `DATABASE_URL`; no Supabase service key or database credential
   is sent to the browser.
3. Schema migrations use a separate owner/admin credential only during
   migration work. The app process uses a dedicated PostgreSQL login with
   only required grants, `NOBYPASSRLS`, and no ownership of application
   tables.
4. RLS stays enabled. Policies and grants are explicit and reviewed for each
   table as feature modules are ported; the runtime role must not gain access
   by inheriting the table owner or a bypass role.
5. SQL Server remains the default until each route group is migrated and
   verified; this foundation does not change the default database provider.
6. There is no recovered dataset to transfer. Any verification writes must be
   clearly labeled test content and removed after testing.

## Tech Stack

- Node.js ES modules and Express 5 backend
- PostgreSQL on Supabase, accessed with `pg` 8
- React 19, TypeScript 6, Vite 8 frontend
- Vitest 4, ESLint 10
- Supabase schema migration SQL under `parishweb/supabase/migrations/`

## Commands

Run from `parishweb`:

```powershell
npm run test:run -- src/db
npm run test:run
npm run build
npm run lint
npm run server
```

The backend smoke check must verify database-backed readiness, not just HTTP
health. Do not print or log `DATABASE_URL`, passwords, or certificate contents.
The server process must shut down its PostgreSQL pool cleanly.

## Project Structure

- `server.js` — Express startup, health/readiness endpoints, and existing
  SQL Server fallback
- `src/db/` — PostgreSQL pool, configuration, readiness checks, and related
  tests
- `parishweb/supabase/migrations/` — reviewed PostgreSQL schema/role/policy
  migrations
- `.env.example` — variable names and placeholders only
- ignored `parishweb/.env` — local runtime database URL and certificate path;
  never committed

## Code Style

Keep the runtime API parameterized and preserve certificate verification:

```js
const result = await pool.query(
  'SELECT "EventId" FROM "public"."Events" WHERE "EventId" = $1',
  [eventId],
);
```

Use the existing project formatting and naming. Keep database setup in
`src/db`, avoid adding a framework or ORM, propagate connection failures
explicitly, and do not silently substitute SQL Server when PostgreSQL is the
selected provider.

## Testing Strategy

- Unit tests cover URL/config validation, TLS CA loading, pool startup failure,
  readiness behavior, and the runtime role's intended permission/RLS posture.
- PostgreSQL integration checks use the configured Supabase project and verify
  connectivity and permissions with read-only checks before any writes.
- Any temporary write is labeled as test data, constrained to its test flow,
  and deleted in cleanup.
- Before this module is complete, run the focused database tests, full Vitest
  suite, TypeScript/Vite build, and ESLint.
- Browser/API checks are required for later feature modules; foundation
  success alone does not count as a full application migration.

## Boundaries

- Always:
  - Keep credentials and CA contents out of browser configuration, responses,
    logs, diffs, and commits.
  - Keep TLS certificate verification enabled.
  - Use a restricted runtime role with `NOBYPASSRLS`; keep migration
    credentials separate from the app process.
  - Preserve SQL Server fallback behavior while any routes still depend on it.
  - Report missing schema/data or database permission failures explicitly.
- Ask first:
  - Any change to production database grants, roles, RLS policies, or schema
    that is not required by the approved module spec.
  - Any new dependency, deployment target, or credential-rotation procedure.
- Never:
  - Run the application with the Supabase owner credential as its normal
    runtime role.
  - Disable TLS verification or RLS to make a connection or test pass.
  - expose `DATABASE_URL`, CA material, or admin credentials to Vite/client
    code.
  - Claim old parish records were migrated when no source dataset exists.

## Success Criteria

1. The Express backend connects to Supabase using a dedicated restricted role
   that is not a table owner, is not superuser, and does not bypass RLS.
2. Required database privileges and RLS policies are explicit, reproducible,
   and tested against that runtime role.
3. Startup/readiness reports PostgreSQL availability and returns not-ready
   when the connection or required schema is unavailable.
4. TLS verification remains enabled and accepts only a trusted CA; invalid or
   missing connection settings fail with actionable, non-secret errors.
5. Connection credentials exist only in ignored server environment
   configuration and are never exposed in frontend assets or API responses.
6. Existing SQL Server behavior remains available and unchanged as a fallback.
7. Focused database tests, the full test suite, build, and lint pass.

## Open Questions

- What is the deployment environment for the Express API (local only,
  persistent VM/container, or serverless)? The Supabase connection mode and
  pool limits should be confirmed before production configuration.
- Who will apply the owner-only role/grant migrations in Supabase? The
  application must not perform these privileged operations at startup.
