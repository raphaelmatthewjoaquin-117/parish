# Deployment Plan: Vercel Frontend, Test API, and Resend Email

## Overview

Publish the Parish website for a father-friendly acceptance test while preserving the existing Express API, SQL Server database, file uploads, scheduled jobs, and Resend email flow. Vercel will host the Vite/React frontend. The Express API will run on a persistent Node.js host, and the database will remain on a reachable SQL Server/Azure SQL instance.

## Recommended Architecture

```text
Father's browser
        |
        v
Vercel: parishweb/dist (React/Vite frontend)
        |
        | VITE_API_URL + HTTPS
        v
Persistent Node host: parishweb/server.js (Express API)
        |                  |
        v                  v
   SQL Server/Azure SQL   Resend API
```

Do not deploy the current `server.js` directly as a Vercel frontend project. It uses `app.listen`, scheduled in-process jobs, SQL Server connectivity, and disk-backed Multer uploads. These are not a good fit for a Vercel static frontend deployment and local uploaded files would not be durable on a serverless filesystem.

## Phases

### Phase 1: Safety and deployment readiness

- Confirm the working tree changes intended for testing are committed and pushed to a testing branch or repository.
- Verify that no real credentials are exposed in tracked files. The local `parishweb/.env` is tracked by Git, so inspect it and rotate any credential that may have been committed.
- Use a test database or a backup of the production database.
- Decide whether test users and seeded data should be separate from production records.

### Phase 2: Prepare the API host

- Choose a persistent Node.js host that supports a long-running Express process, outbound connections to SQL Server, environment variables, and durable or external file storage.
- Configure the API host with `NODE_ENV=production`, `PORT`, `FRONTEND_URL`, `ADMIN_TOKEN`, SQL Server settings, and `RESEND_API_KEY`.
- Configure the database with SQL authentication and a public/private network route that the API host can reach. Use a trusted CA certificate; do not enable `DB_TRUST_SERVER_CERTIFICATE` for production-like testing unless the database is intentionally self-signed.
- Decide how uploads will persist. For a disposable test, local disk may be acceptable on a persistent host; for reliable testing, use object storage or another durable volume and adapt the upload path before deployment.
- Apply migrations `001` through `023` in order to the test database, including newer migrations present in the repository.
- Verify the API health and basic endpoints from the deployed API URL before connecting the frontend.

### Phase 3: Configure Resend email testing

- Create or use a Resend API key with the minimum permissions needed for testing.
- For the quickest test, keep the current `from: 'onboarding@resend.dev'` sender and send only to an address allowed by the Resend account's test/sandbox restrictions.
- For testing email delivery to the father's address or other real recipients, verify a domain in Resend and change the sender to an address on that verified domain. Do not put the API key in frontend variables; it belongs only on the API host.
- Confirm the API logs both successful message IDs and failures, then test the actual flows that call `sendEmail` (registration verification, password reset, or other relevant notifications).
- Use a dedicated test mailbox and avoid sending real parish or personal data during the acceptance test.

### Phase 4: Deploy the Vercel frontend

- Import the repository into Vercel and set the project root to `parishweb`.
- Use:
  - Install command: `npm ci`
  - Build command: `npm run build`
  - Output directory: `dist`
- Add `VITE_API_URL` as a Vercel environment variable pointing to the HTTPS API origin, with no trailing path unless the API host requires it.
- Add the variable for Preview deployments first. Add Production only after the preview passes.
- Deploy a preview URL and verify that browser requests go to the deployed API rather than `localhost:5000`.
- Set the API host's `FRONTEND_URL` to the exact Vercel preview origin used for testing. If the URL changes, update CORS configuration.

### Phase 5: Father acceptance test

- Give the tester the Vercel preview URL and simple test credentials or registration instructions.
- Test public pages, mobile layout, registration, login, service requests, event viewing, and any intended admin workflow.
- Test one email flow using a mailbox that can be checked immediately.
- Verify the email arrives, links point to the deployed frontend, and verification/reset links work from a second browser or private window.
- Test failed-email behavior and inspect API logs for a clear Resend error rather than reporting success when delivery failed.
- Check uploads, protected downloads, and any workflow depending on scheduled jobs.

### Phase 6: Cleanup and handoff

- Remove test users and test records, or clearly mark them as test data.
- Revoke temporary API keys and rotate `ADMIN_TOKEN` if it was shared during testing.
- Record the final frontend URL, API URL, database used, Resend sender, and known test limitations.
- Keep the Vercel project as a Preview deployment until the test results are reviewed.

## Verification Checklist

- [ ] `npm ci` succeeds in `parishweb`
- [ ] `npm run build` succeeds
- [ ] Vercel preview loads without frontend console errors
- [ ] Frontend requests use `VITE_API_URL`, not `http://localhost:5000`
- [ ] API CORS allows only the exact test frontend origin
- [ ] API connects to the test database over TLS
- [ ] Public registration/login flow works
- [ ] One Resend email is received and its link works
- [ ] Resend failures are visible in API logs
- [ ] Admin authentication requires the configured `ADMIN_TOKEN`
- [ ] Upload/download behavior is verified or explicitly excluded from the test
- [ ] No secrets are committed or exposed in Vercel client-side variables

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Deploying Express as a static Vercel frontend | High | Host the API separately on a persistent Node service. |
| Vercel frontend still points to localhost | High | Set `VITE_API_URL` in Vercel Preview environment variables and verify browser network requests. |
| CORS rejects the Vercel origin | High | Set `FRONTEND_URL` to the exact deployed origin. |
| SQL Server is not reachable from the API host | High | Use Azure SQL or configure secure firewall/network access before frontend deployment. |
| Uploaded files disappear | Medium/High | Use durable storage or explicitly treat the deployment as a disposable test. |
| Scheduled jobs stop or run unpredictably | Medium | Use a persistent host and verify job behavior; add an external scheduler for production. |
| Resend sender cannot deliver to the intended mailbox | Medium | Verify a sending domain or follow the account's current test restrictions. |
| Test data reaches production | High | Use a separate database and test accounts. |

## Open Decisions

1. Which persistent API host will be used: Render, Railway, Fly.io, or an existing server?
2. Will the test use a separate Azure SQL/database instance?
3. Is the father's email address on a domain/mailbox permitted by the current Resend account, or should a sending domain be verified?
4. Are uploads required for this first test, or can they be excluded until durable storage is configured?
