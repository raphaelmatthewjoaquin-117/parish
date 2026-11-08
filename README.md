# Santo Domingo Parish Website

This repository contains the website and administration system for Santo Domingo Parish, National Shrine of La Naval de Manila. Parishioners can find parish information, browse news and events, view the gallery, request services or certificates, contact the parish, and submit prayer requests. Authorized staff use the administration workspace to manage website content and parish operations.

The application is in [`parishweb`](./parishweb/). It has a React/Vite frontend and a separate Express API that supports the legacy SQL Server configuration and a PostgreSQL-only Supabase deployment.

## Technology stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, TypeScript 6, Vite 8 |
| Navigation and UI | React Router 7, Bootstrap 5, FullCalendar |
| Backend API | Node.js (ES modules), Express 5 |
| Database | Microsoft SQL Server (existing routes) and optional Supabase PostgreSQL |
| Authentication and security | Staff roles and module permissions, Helmet, CORS, rate limiting |
| Email and file handling | Resend for email (optional local configuration), Multer for uploads |
| Tests and checks | Vitest, Testing Library, Happy DOM, ESLint, TypeScript |

## Getting started on a new computer

### Install prerequisites

Install:

- Git
- Node.js LTS supported by Vite 8 (Node 22 LTS is recommended) and npm
- SQL Server 2022 Developer or Express (or newer), plus SQL Server Management Studio (SSMS) or another SQL client

You need a SQL Server instance available to the API. The schema export used for the baseline was generated from SQL Server 2022. For the simplest local setup, enable SQL Server authentication and create a development database login with permission to use the parish database.

### Clone and install

From PowerShell:

```powershell
git clone https://github.com/raphaelmatthewjoaquin-117/parish.git
cd parish\parishweb
npm ci
```

### Create a local database

You can start with a **new, empty database** on the new laptop; the old laptop's records are not required. The application needs SQL Server running locally, plus the schema script that creates the tables the app expects.

1. Install SQL Server 2022 Developer or Express with the **Database Engine Services**. Install SSMS (SQL Server Management Studio) separately if the SQL Server installer does not include it.
2. Start the SQL Server service and connect to the local Database Engine in SSMS. If using SQL Server Express, the instance is often named `.\SQLEXPRESS`; use that in SSMS to connect.
3. In SSMS, connect to the SQL Server instance using an account allowed to create databases, open [`migrations/1000_current_database_baseline.sql`](./parishweb/migrations/1000_current_database_baseline.sql), and execute it. The script creates `ParishDB` if it does not exist, then creates the tables, keys, indexes, constraints, defaults, and triggers. It contains no parish records. Run it only against a new or empty `ParishDB`; it is not an upgrade script for an existing database.
4. Configure a local SQL Server login and database access for the app. The PowerShell example below uses SQL authentication: SQL Server must allow SQL Server Authentication, and that login needs access to `ParishDB` (for a private local development database, `db_owner` is the simplest setup). Restart SQL Server after changing its authentication mode.
5. Set `DB_SERVER`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD` in the API terminal to match that SQL Server instance. The example assumes SQL Server accepts TCP connections at `localhost:1433`. SQL Server Express may use a different or dynamic port; enable TCP/IP and configure a static port in SQL Server Configuration Manager, restart the SQL Server service, and set `DB_PORT` to that port. A default instance often uses port 1433, but verify the configured port rather than assuming it.

The baseline is based on the schema-only export of the current database and is reconciled with schema changes through migration `027`. It creates 42 tables, 20 foreign keys, and 6 triggers, plus defaults, indexes, and other constraints. It contains no parish records, does not create the old SQL login, and does not use the old laptop's physical database-file paths. The numbered `001`–`027` SQL files are historical incremental migrations; do not replay them on top of this baseline. Migration `003` is a legacy-data migration and is intentionally not part of this empty-database baseline.

For a PostgreSQL/Supabase schema, [`supabase/migrations/20261108094830_initial_schema.sql`](./parishweb/supabase/migrations/20261108094830_initial_schema.sql) is adapted from that baseline. It is also schema-only: it does not recover or transfer database records, seed the service catalog, or create a staff account. It enables row-level security without adding client policies; access must go through a secured server-side database role until policies are designed. Apply it only to a new/empty Supabase project.

The Express API can use a server-side `DATABASE_URL` to connect to Supabase PostgreSQL. Keep this value in the ignored `parishweb/.env` and do not give it a `VITE_` prefix. The pool rejects superuser, `BYPASSRLS`, object-owner, database-owner, and role-membership connections; use a dedicated restricted runtime login, never the Supabase owner credential. SQL Server remains the local/legacy default. Before setting a provider to `postgres`, apply its reviewed access migration using an owner/admin connection and verify it as the restricted runtime role. The identity verifier is `npm run db:verify-identity`; public content uses `npm run db:verify-content`; events use `npm run db:verify-events`; service catalog and bookings use `npm run db:verify-service-catalog`; certificates use `npm run db:verify-certificates`; operations use `npm run db:verify-operations`; sacramental records use `npm run db:verify-sacramental`. In Render's PostgreSQL-only mode, set all seven provider variables to `postgres`; startup then connects only to PostgreSQL, validates the Events table and required Storage buckets, and `/readyz` reports PostgreSQL readiness. The parishioner portal and SQL Server-specific backup, audit, and email-log tools return HTTP 501 in this mode. TLS certificate verification stays enabled; if Node does not trust the Supabase certificate by default, set `DATABASE_SSL_CA_PATH` to the path of the CA PEM from Supabase Database Settings > SSL Configuration (or provide the PEM in `DATABASE_SSL_CA`). The Supabase schema contains no recovered parish data; use clearly labeled test content when verifying writes.

Sacramental archive and register reads and writes have PostgreSQL code paths. Apply [`20261108180000_sacramental_register_write_access.sql`](./parishweb/supabase/migrations/20261108180000_sacramental_register_write_access.sql) in Supabase SQL Editor with owner/admin access and run `npm run db:verify-sacramental` from `parishweb` before enabling `SACRAMENTAL_DATABASE=postgres`.

The manual owner-only starting point for the restricted role is
[`supabase/role-setup.sql`](./parishweb/supabase/role-setup.sql). It creates
the role without a password or application-table grants and prints a
read-only privilege/ownership check. Run it only after confirming the role
name is unused or reviewing the existing role. Set its password interactively
with `psql`'s `\password parish_app_runtime` command, or run
`npm run db:configure-runtime` from `parishweb`. The helper asks for the new
password without echoing it, sets it through the existing private owner
connection, and changes only `DATABASE_URL` in the ignored `.env` to the
restricted login. No password is printed. The helper requires the current
owner/admin URL in that local `.env` and replaces it; keep owner credentials
separate for future migrations. Do not use the owner URL as the app's runtime
URL; feature-specific grants and RLS policies are separate and must be
reviewed before enabling a feature.

The baseline also does not populate service-catalog entries or create a staff account. Run [`scripts/seed-service-catalog.sql`](./parishweb/scripts/seed-service-catalog.sql) to add the initial services, and use [`create_admin_user.sql`](./parishweb/create_admin_user.sql) only for a private local development database if you need a staff login.

If you need a local staff account, [`create_admin_user.sql`](./parishweb/create_admin_user.sql) contains a development seed script. It uses a known development password and marks the account as requiring a password change, so use it only in a private local database and change the password before the account is used anywhere shared.

### Configure environment variables

The API and Vite can read environment variables from `parishweb\.env` (next to `package.json`) or from the process environment. The existing `.env` has been removed from Git tracking while leaving the local copy on this laptop. After that removal is committed, a fresh clone will not contain the file; create a new local one or use the PowerShell commands below. The root `.gitignore` ignores new `.env` files. Removing a file from the latest Git snapshot does not erase it from earlier commits, so rotate any real credentials that may have been committed.

Run these in the API terminal, replacing the SQL login and password with your local values:

```powershell
$env:NODE_ENV = "development"
$env:PORT = "5000"
$env:DB_AUTH = "sql"
$env:DB_SERVER = "localhost"
$env:DB_PORT = "1433"
$env:DB_NAME = "ParishDB"
$env:DB_USER = "your_local_sql_login"
$env:DB_PASSWORD = "your_local_sql_password"
$env:DB_TRUST_SERVER_CERTIFICATE = "true"
$env:ADMIN_TOKEN = "replace_with_a_random_local_value"
$env:FRONTEND_URL = "http://localhost:5173"
# Optional; only needed to send email through Resend:
$env:RESEND_API_KEY = "your_resend_api_key"
```

In the frontend terminal, set its API URL before starting Vite:

```powershell
$env:VITE_API_URL = "http://localhost:5000"
```

Adjust `DB_SERVER`, `DB_PORT`, and the login values to match your SQL Server instance. `DB_AUTH=sql` selects SQL Server username/password authentication. `DB_TRUST_SERVER_CERTIFICATE=true` is for local development certificates only; do not use that setting as a production security shortcut. `VITE_API_URL` defaults to `http://localhost:5000`; the API allows the local Vite origin `http://localhost:5173`, and `FRONTEND_URL` adds a different frontend origin if needed. Email delivery is optional for local development; without a Resend API key, email sending is skipped. PowerShell environment variables apply only to processes started from that terminal, so configure each terminal separately.

### Run the website and API

Open two PowerShell terminals, both in `parish\parishweb`.

**Terminal 1 — API server** (connects to SQL Server):

```powershell
npm run server
```

**Terminal 2 — Vite frontend:**

```powershell
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. The API listens on `http://localhost:5000` by default. Check the API terminal for the message that the database pool initialized successfully; the API's `/health` endpoint alone only confirms that the API process is responding, not that SQL Server is connected. Both application processes and the SQL Server database need to be available for database-backed pages and actions to work. If you change environment settings, restart the affected process.

Common connection problems:

- **Connection refused or timeout:** make sure the SQL Server service is running, TCP/IP is enabled, and `DB_PORT` matches the instance's TCP port.
- **Login failed:** check that SQL Server Authentication is enabled and that the configured login/password are correct and the login can access `ParishDB`.
- **Invalid object/table name:** confirm the query window was set to `ParishDB` before executing the baseline, and that the baseline completed without errors.

## Production deployment (Vercel + Render)

The frontend is a Vite static site on Vercel. The Express API runs as a
persistent Node.js web service on Render. They are separate deployments: the
Vercel build must use the public Render API URL, and Render must allow the
public Vercel origin.

### Render API service

Create or update a Render Web Service for this repository. Use the repository
root so npm can resolve the `parishweb` workspace:

| Setting | Value |
| --- | --- |
| Root Directory | repository root |
| Build Command | `npm ci` |
| Start Command | `npm run start --workspace parishweb` |
| Health Check Path | `/readyz` |

Configure these environment variables in Render's service settings. Set values
in the Render dashboard, not in Git or chat.

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | Let Render provide it |
| `FRONTEND_URL` | One or more HTTPS frontend origins, comma-separated, with no paths |
| `ADMIN_TOKEN` | Long, random secret |
| `ADMIN_TOKEN_SIGNING_SECRET` | Separate random secret of at least 32 characters |
| `DATABASE_URL` | Restricted PostgreSQL runtime connection string; never the owner role |
| `DATABASE_SSL_CA_PATH` | Optional path to the trusted Supabase CA PEM |
| `IDENTITY_DATABASE`, `EVENTS_DATABASE`, `CONTENT_DATABASE` | Set each to `postgres` |
| `CERTIFICATE_DATABASE`, `SERVICE_DATABASE`, `OPERATIONS_DATABASE` | Set each to `postgres` |
| `SACRAMENTAL_DATABASE` | Set to `postgres` |
| `SUPABASE_URL` | Supabase project API URL |
| `SUPABASE_SECRET_KEY` | Supabase server-only secret key (`sb_secret_...`); never put it in Vercel or frontend variables |
| `SUPABASE_PUBLIC_BUCKET` | `parish-public-assets` |
| `SUPABASE_PRIVATE_BUCKET` | `parish-private-documents` |
| `RESEND_API_KEY` | Optional; set only if production email is enabled |
| `RESEND_FROM_EMAIL` | Optional verified sender for Resend |

For PostgreSQL-only deployment, set **all seven** database provider variables
to `postgres`; a missing or SQL Server provider setting does not silently fall
back to SQL Server. Use Supabase's Session pooler connection string if Render
cannot connect over IPv6, and use the restricted runtime login. Startup checks
the PostgreSQL connection and required Events table. Render's `/readyz` health
check verifies database readiness; `/health` only reports that the process is
running.

Create the `parish-public-assets` Storage bucket with public access enabled
and `parish-private-documents` with public access disabled before deploying.
The API uses the secret key only on the server. Public images are served only
after the PostgreSQL content references them; archive and certificate files
remain behind admin authorization.

This API starts scheduled finance, appointment, and token-cleanup jobs inside
the web process. Keep one running Render instance unless those jobs are moved
to a separate single worker; multiple instances would run duplicate schedules.

The parishioner portal and SQL Server-only backup, system-audit, and email-log
admin tools are not available in PostgreSQL-only mode; the API responds with
HTTP 501 rather than attempting SQL Server access. Render's local filesystem
is used only for temporary upload processing, not durable storage.

### Vercel frontend

Configure the Vercel project to build the `parishweb` app with the Vite build
command `npm run build` and output directory `dist`. Set `VITE_API_URL` in
Vercel's production environment to the Render service's public HTTPS origin,
for example `https://<your-render-service>.onrender.com` (no path). Set it
before building: the client rejects a missing, non-HTTPS, or localhost API URL
in production. After changing it, redeploy the frontend.

Set production variables in Vercel's dashboard. Do not put
`NODE_ENV=production` in a `.env` file used by Vite; Vite warns on that
configuration. The API's `NODE_ENV=production` belongs in Render's settings.

Use the exact Vercel site origin(s) for Render's `FRONTEND_URL`, separated by
commas when both a production domain and a preview domain must call the API.
The first origin is used for password-reset links. The API's CORS policy allows
only those production origins and permits the `PATCH` method used by admin
screens. Keep localhost origins for local development only.

### Rotate the exposed Azure Storage key

The Azure Storage key shown in the shared IDE/chat context must be treated as
exposed. In the Azure portal, open the storage account and go to **Security +
networking → Access keys**. First switch Render's
`AZURE_STORAGE_CONNECTION_STRING` to the other key's connection string and
redeploy. Verify that uploads work; then regenerate the exposed key in Azure.
If you cannot identify which of the two keys was exposed, rotate both in a
planned sequence, updating Render and verifying access between rotations.
Never paste the replacement key into Git or chat. See Microsoft's
[Azure Storage key rotation guide](https://learn.microsoft.com/en-us/azure/storage/common/storage-account-keys-manage?tabs=azure-portal).

## Testing and development commands

Run these from `parishweb`:

| Command | Purpose |
| --- | --- |
| `npm run test:run` | Run the Vitest test suite once |
| `npm test` | Run Vitest in watch mode |
| `npm run test:ui` | Open the Vitest UI |
| `npm run test:coverage` | Run tests and collect coverage |
| `npm run lint` | Check the project with ESLint |
| `npm run build` | Type-check and create the production frontend build in `dist` |
| `npm run preview` | Preview the built frontend locally |
| `npm run admin:reset-password` | Run the staff password reset utility |

For a quick check before sharing changes, run:

```powershell
npm run test:run
npm run lint
npm run build
```

The automated tests are Vitest tests; they do not replace checking the application against a running local SQL Server. For end-to-end manual testing, start both the API and frontend as above and exercise the relevant public or staff workflow.

## Features

### Public parish website

- **Home page:** parish highlights, upcoming events, featured gallery imagery, and Vatican News content supplied by the API.
- **About page:** parish information and editable content sections.
- **News and events:** parish news and events, including event details and descriptions.
- **Photo gallery:** browsable photo albums and images.
- **Parish services and appointments:** information and booking flows for available services, including sacraments and other parish services. Visitors can choose available dates and time slots, provide contact details, and complete service-specific form fields.
- **Certificate requests:** request sacramental certificates, choose an appointment, provide supporting information or documents, and check a request using its reference details.
- **Contact:** send a message to the parish; staff can review and manage submitted messages in the admin workspace.
- **Prayer requests:** submit an intention with a category, choose whether to identify yourself, and choose whether it can be shared with the community. Publicly shared requests are subject to staff review.
- **English and Tagalog:** a language toggle is available, with translations for interface and content that have Tagalog versions.
- **Responsive navigation and layout:** the public site adapts its navigation and pages to smaller screens.

### Staff administration workspace

The `/admin` workspace is protected by staff authentication and role-based access. Staff roles and module permissions determine which sections and actions are available.

- **Dashboard and events:** review and manage parish events, including bilingual event content.
- **Website content editor:** update the About, Gallery, Contact, News, and Footer content shown on the public site.
- **Contact messages:** review, update, and manage messages received through the contact form.
- **Mass schedule and intentions:** maintain schedules and record Mass intentions and offerings.
- **Service requests and booking availability:** review incoming service bookings, manage appointment availability, block unavailable slots, and configure service booking form fields.
- **Certificate appointments:** review certificate requests and their supporting documents.
- **Sacramental ledger and archives:** search sacramental records and manage associated archive entries and files.
- **Finance and reports:** record and review financial entries, manage approval or reconciliation workflows, inspect audit history, and view scheduled weekly/monthly report snapshots.
- **Statistics and demographics:** view yearly sacramental totals and demographic summaries.
- **Staff and permissions:** manage staff accounts, roles, passwords, and module-level access.
- **Account profile:** maintain the signed-in staff member's profile and password.
- **Parishioner account API:** the backend also provides parishioner registration/login and certificate-request tracking endpoints.

### Data and uploaded files

SQL Server stores operational records, staff and parishioner accounts, content, requests, and audit information. Database schema scripts are in [`parishweb/migrations`](./parishweb/migrations/). Uploaded files are stored under `parishweb/uploads/`, which is ignored by Git; copy or back it up separately if you need to move local uploads between computers.

## Project layout

```text
parish/
└── parishweb/
    ├── src/
    │   ├── api/          # Frontend API client and hooks
    │   ├── components/   # Shared UI components
    │   ├── pages/        # Public pages and admin sections
    │   ├── db/           # Typed database pool helpers
    │   └── utils/        # Permissions, rules, logging, and helpers
    ├── migrations/       # SQL Server schema migrations and baseline
    ├── scripts/          # Local maintenance utilities
    ├── server.js         # Express API
    ├── package.json      # Dependencies and npm commands
    └── vite.config.ts    # Frontend development/build configuration
```
