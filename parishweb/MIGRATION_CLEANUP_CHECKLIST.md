# Migration cleanup checklist

This project now has two useful kinds of SQL files in the migrations folder:

1. Historical migrations: the numbered files that document how the schema evolved.
2. A current baseline: a restartable baseline that matches the project’s current database state.

## Keep these as historical documentation
- 001_staff_mass_schedule.sql
- 002_sacramental_records.sql
- 003_migrate_legacy_sacramental_data.sql
- 004_administrative_operations.sql
- 005_user_management_audit.sql
- 006_parishioner_portal_certificates.sql
- 007_sacramental_audit.sql
- 008_finance_controls.sql
- 009_certificate_request_documents.sql
- 010_certificate_requests_guest.sql
- 011_scheduled_finance_reports.sql
- 012_security_audit.sql
- 013_verification_tokens.sql

These are useful for understanding the project’s database history and for debugging partial migrations.

## Use this as the clean rebuild starting point
- 1000_current_database_baseline.sql

This file is intended for creating a fresh or intentionally empty database that matches the project’s current schema state.

## Recommended usage rules
- Do not run the numbered historical migrations blindly against a populated database.
- Do not delete the historical files; they are the project’s migration history.
- Use 1000_current_database_baseline.sql when you want a clean rebuild.
- Use the numbered files only when you intentionally want to replay the project’s historical schema evolution.

## Current known problems to watch for
- 006_parishioner_portal_certificates.sql reflects the older, pre-guest certificate-request design.
- 010_certificate_requests_guest.sql is the updated guest-capable version and should be treated as the current change set for guest requests.
- If the database is partially migrated, fix the live schema before rerunning any script.

## Safest workflow
1. Back up the current database.
2. If you want a fresh local database, run 1000_current_database_baseline.sql.
3. If you want to preserve historical evolution, run the numbered scripts in order only on a clean database.
4. Never rerun a migration script on a live database without confirming the prior state.
