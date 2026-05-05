# Spy Signal Backoffice

Admin-only operational console (separate app) for analyst and data-ops workflows.

## Features

- Clerk-authenticated access
- Email allowlist admin authorization (`ADMIN_EMAIL_ALLOWLIST`)
- Analyst job creation (`ticker_snapshot`, `coverage_report`)
- Job status polling and persisted result rendering
- Recent jobs history with failed-job retry
- Data Ops health calendar (`/data-ops`)
- Targeted rebuild/refill job submission + retry history
- Macro series upsert and release-calendar row upsert job forms
- Read-only model registry inspection backed by the `finance-model-registry` API (`/registry`)

## Environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ADMIN_EMAIL_ALLOWLIST` (comma-separated, lowercase email list)
- `BACKEND_BASE_URL`
- `BACKEND_SERVICE_TOKEN` (optional)
- `MODEL_REGISTRY_API_URL` (for `/registry`, for example `http://localhost:8000`)
- `MODEL_REGISTRY_API_TIMEOUT_SECONDS` (optional, defaults to `10`)

## Model Registry Views

The `/registry` area is read-only and consumes the `finance-model-registry` HTTP API. It does not read registry Postgres tables or local JSON state directly.

Implemented views:

- registry dashboard and candidate list
- candidate detail and lineage
- bundle detail
- promotion history
- active pointer dashboard
- readiness report detail and latest candidate readiness

Useful local check:

```bash
MODEL_REGISTRY_API_URL=http://localhost:8000 npm run dev
```

Then open `/registry` while the `finance-model-registry` API is running. If `MODEL_REGISTRY_API_URL` is missing, unavailable, times out, or returns a stable registry error payload, the UI renders a clear error state instead of attempting any write action.

## Development

```bash
npm install
npm run dev
```

## Deployment

Deploy as a separate Vercel project/subdomain (example: `admin.yourdomain.com`) so admin tooling is isolated from the public app.

## CI/CD

This repo includes `.github/workflows/ci.yml`.
On every merge/push to `main`, it runs lint/build checks.
Production deployment should use native Vercel Git integration (no per-repo deploy tokens).

Recommended Vercel production environment variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `ADMIN_EMAIL_ALLOWLIST`
- `BACKEND_BASE_URL`
- `BACKEND_SERVICE_TOKEN` (if backend expects bearer auth)
- `MODEL_REGISTRY_API_URL`
- `MODEL_REGISTRY_API_TIMEOUT_SECONDS`
