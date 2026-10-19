# Santo Domingo Parish Website

This repository contains the website and administration system for Santo Domingo Parish, National Shrine of La Naval de Manila. Parishioners can find parish information, browse news and events, view the gallery, request services or certificates, contact the parish, and submit prayer requests. Authorized staff use the administration workspace to manage website content and parish operations.

The application is in [`parishweb`](./parishweb/). It has a React/Vite frontend and a separate Express API backed by Microsoft SQL Server.

## Technology stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, TypeScript 6, Vite 8 |
| Navigation and UI | React Router 7, Bootstrap 5, FullCalendar |
| Backend API | Node.js (ES modules), Express 5 |
| Database | Microsoft SQL Server, accessed with `mssql` |
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

The baseline was refreshed from the schema-only export of the current database. It creates 39 tables, 18 foreign keys, and 5 triggers, plus the exported defaults, indexes, and other constraints. The export contained no records. It intentionally does not create the old SQL login or use the old laptop's physical database-file paths. The numbered `001`–`024` SQL files are historical incremental migrations; do not replay them on top of this baseline.

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
