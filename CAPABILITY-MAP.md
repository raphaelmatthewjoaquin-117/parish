# Capability Map: Supabase Application Migration

The Express API currently depends on SQL Server for most routes. Supabase has
the schema but no recovered parish records. The migration must preserve the
existing app as a fallback until the PostgreSQL-backed app is verified.

| Module id | Responsibility | Depends on |
|---|---|---|
| `postgres-foundation` | Server-only PostgreSQL pool, connection/readiness checks, migrations, least-privilege database role and RLS posture | — |
| `identity-access` | Admin sign-in, password handling, users, roles, module permissions, and request authorization on PostgreSQL | `postgres-foundation` |
| `public-content` | Public events, news, gallery and site content, including authorized admin management. Event PostgreSQL paths are implemented; the event access migration and restricted-role verifier are now available for live verification. | `postgres-foundation`, `identity-access` |
| `community-requests` | Contact and prayer submissions and their authorized admin workflows | `postgres-foundation`, `identity-access` |
| `service-requests` | Service bookings, availability, certificate requests, documents/uploads, and required email behavior | `postgres-foundation`, `identity-access` |
| `operations-finance` | PostgreSQL paths cover finance, schedules, admin database health/system information, and status summaries. System audit, email logs, and backup/restore still need separate migration decisions. | `postgres-foundation`, `identity-access`, `service-requests` |
| `sacramental-registers` | Sacramental record search/detail/audit reads, record/archive CRUD, and statistics. PostgreSQL paths are implemented and tested; register write access still needs its Supabase migration applied and verified. | `postgres-foundation`, `identity-access` |
| `postgres-cutover` | End-to-end verification, PostgreSQL default selection, and removal of SQL Server dependencies only after no app route uses them | `public-content`, `community-requests`, `service-requests`, `operations-finance` |

Build order: `postgres-foundation` → `identity-access` → (`public-content`,
`community-requests`, `service-requests`, `operations-finance`,
`sacramental-registers`, in small independently tested slices) →
`postgres-cutover`.

All modules must keep credentials on the server, preserve existing validation,
authorization, email and upload behavior where applicable, and use
clearly-labeled test data. The migration does not recreate unavailable parish
records; data recovery or import is a separate task requiring a source dataset.
