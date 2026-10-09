# Deployment Test Tasks

## Phase 1: Safety and readiness

- [ ] Inspect and protect environment secrets before pushing deployment code.
- [ ] Create or confirm a separate test database and apply the repository migrations.
- [ ] Run the frontend build and focused tests locally.

## Phase 2: API deployment

- [ ] Deploy `parishweb/server.js` to a persistent Node.js host.
- [ ] Configure production environment variables and SQL Server connectivity.
- [ ] Configure and verify Resend API credentials and sender restrictions.
- [ ] Verify API health, CORS, authentication, and database access.

## Checkpoint: API ready

- [ ] API is reachable over HTTPS.
- [ ] API can read/write test data.
- [ ] One email flow produces a successful Resend message or a clearly logged failure.

## Phase 3: Vercel frontend

- [ ] Create a Vercel project rooted at `parishweb`.
- [ ] Configure `npm ci`, `npm run build`, and `dist`.
- [ ] Set `VITE_API_URL` for the Vercel Preview environment.
- [ ] Deploy and verify browser requests use the deployed API.

## Phase 4: Acceptance test

- [ ] Share the Vercel preview URL with the father.
- [ ] Test the agreed public and authenticated workflows.
- [ ] Test registration/password-reset or another real email flow.
- [ ] Verify links, uploads, scheduled behavior, and API logs as applicable.

## Checkpoint: Test complete

- [ ] Test data is identified and cleaned up.
- [ ] Temporary credentials and keys are revoked or rotated.
- [ ] Known limitations and final URLs are documented.
