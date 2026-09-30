# React + TypeScript + Vite

## Database migration order

Use the SQL scripts in the `migrations` folder in this order against the correct parish database:

1. `001_staff_mass_schedule.sql`
2. `002_sacramental_records.sql`
3. `003_migrate_legacy_sacramental_data.sql`
4. `004_administrative_operations.sql`
5. `005_user_management_audit.sql`
6. `006_parishioner_portal_certificates.sql`
7. `007_sacramental_audit.sql`
8. `008_finance_controls.sql`
9. `009_certificate_request_documents.sql`
10. `010_certificate_requests_guest.sql`
11. `011_scheduled_finance_reports.sql`
12. `012_security_audit.sql`
13. `013_verification_tokens.sql`

Important: these scripts are intended for schema setup and upgrades. Do not blindly rerun them on a populated database unless you know the previous migration state. The guest certificate migration is intentionally idempotent so it can be rerun safely on a partially applied schema.

## Staff roles

Run `migrations/001_staff_mass_schedule.sql` against ParishDB before using the Mass Schedule tab.
Run `migrations/004_administrative_operations.sql` after the other migrations before using the administrative operations workspace at `/admin/operations`.
Run `migrations/006_parishioner_portal_certificates.sql` to enable parishioner accounts, request tracking, and certificate claiming appointments at `/portal`.
Run `migrations/007_sacramental_audit.sql` to enable sacramental record change history in the digital ledger.
Run `migrations/008_finance_controls.sql` to enable expense entries, draft/approval/reconciliation states, and finance audit history.

Configure staff logins with environment variables:

```text
TREASURER_USERNAME=treasurer
TREASURER_PASSWORD=change-this-password
SECRETARY_USERNAME=secretary
SECRETARY_PASSWORD=change-this-password
PRIEST_USERNAME=priest
PRIEST_PASSWORD=change-this-password
```

Treasurers are restricted to the future finance workspace. Secretaries manage events and service requests. Priests can view pastoral requests and see upcoming Masses assigned to their username.

The administrative operations workspace supports editable service schedules, Mass intentions, finance entries and reports, printable/editable service applications with edit history, attendance marking, and automatic no-show voiding.

The parishioner portal allows account registration, service-request status tracking, and appointment requests to claim Baptism, Confirmation, Marriage, or Death certificates. Certificates are prepared and released by parish staff; the portal does not generate certificates online.

## Operational safeguards

- **Scheduling conflicts.** Creating or editing a Mass schedule entry returns HTTP 409 when the same minister or location is already booked at that date and time. Mass intentions are limited to one per date/time slot and can be cancelled to release the slot.
- **Automatic appointment voiding.** A server job runs hourly: confirmed appointments whose scheduled time passed by 24 hours without attendance marked become `Voided` with `NoShow` attendance, and bookings left in `PendingVerification` for 48 hours expire automatically, releasing their slots.
- **Finance workflow.** Entries follow `Draft → Submitted → Approved → Reconciled`. Drafts and rejected entries can be edited or deleted by the Bookkeeper; approved and reconciled entries are immutable. Priests/secretaries approve or reject submitted entries; only the Bookkeeper reconciles. Every transition is written to `FinancialEntryAudit`. The finance report supports `start`, `end`, and `type` filters plus `format=csv` export.
- **Sacramental ledger.** Baptism, Confirmation, Marriage, and Death records support create/edit/delete with field-level audit history (who, when, previous and new values). Scanned archives support search by sacrament, book, page, and registry number, in-place edit, delete (which also removes the stored file), and protected downloads through `/api/admin/sacramental/archives/:id/file`, which requires a staff token.
- **Reporting.** `/api/admin/operations/reports/utilization` returns per-service utilization and no-show counts per year (JSON or `format=csv`), alongside the existing annual sacramental statistics endpoint.
- **Shared business rules.** `server-rules.js` contains the pure rule functions (service windows/quotas, schedule and intention conflict detection, finance state machine, no-show/expiration rules, CSV rendering) and is covered directly by `src/server-rules.test.ts`.


This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
