# Spy Signal Backoffice

Admin-only operational console (separate app) for analyst and data-ops workflows.

## Features

- Clerk-authenticated access
- Email allowlist admin authorization (`ADMIN_EMAIL_ALLOWLIST`)
- Analyst job creation (`ticker_snapshot`, `coverage_report`, `ticker_signal_v1`)
- Research experiment launch and inspection backed by `finance-backend` (`/research`)
- Job status polling and persisted result rendering
- Recent jobs history with failed-job retry
- Data inventory and entity-level coverage inspection (`/data`)
- Data Ops health calendar (`/data-ops`)
- Targeted rebuild/refill job submission + retry history
- Macro series upsert and release-calendar row upsert job forms
- Read-only registry / evidence inspection backed by `finance-backend` registry proxy routes (`/registry`)

## Environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ADMIN_EMAIL_ALLOWLIST` (comma-separated, lowercase email list)
- `BACKEND_BASE_URL`
- `BACKEND_SERVICE_TOKEN` (required for authenticated backend research/admin calls)
- `CF_ACCESS_CLIENT_ID` (optional for local localhost dev, required when `finance-backend` is behind Cloudflare Access)
- `CF_ACCESS_CLIENT_SECRET` (optional for local localhost dev, required when `finance-backend` is behind Cloudflare Access)

## Boundaries

- `/research` launches and inspects orchestrated research experiments through `finance-backend`.
- `/registry` remains read-only inspection through `finance-backend` registry façade routes.
- Backoffice does not execute feature engineering, ML training, strategy construction, backtests, or orchestrator logic.
- Backoffice does not directly access backend Supabase tables, registry DB tables, or other internal databases.

## Model Registry Views

The `/registry` area is read-only and consumes `finance-backend` registry proxy routes. It does not call the registry service directly from the backoffice.

Implemented views:

- registry dashboard and candidate list
- candidate detail and lineage
- bundle detail
- promotion history
- active pointer dashboard
- readiness report detail and latest candidate readiness

Useful local check:

```bash
BACKEND_BASE_URL=http://localhost:8001 BACKEND_SERVICE_TOKEN=local-dev-token npm run dev
```

Then open `/registry` while `finance-backend` is running with its registry façade enabled. If the backend reports `registry_unavailable`, the UI renders a safe unavailable state instead of attempting any direct registry access.

## Research Views

The `/research` area is an admin UI for launching and observing orchestrated research experiments through these backend routes:

- `POST /analyst/research/experiments`
- `GET /analyst/research/experiments`
- `GET /analyst/research/experiments/{experiment_id}`
- `GET /analyst/research/experiments/{experiment_id}/events`
- `GET /analyst/research/experiments/{experiment_id}/artifacts`

The browser never receives `BACKEND_SERVICE_TOKEN` directly. All research requests go through Next server route handlers in this repo.
When configured, those server-side research proxy handlers also attach `CF-Access-Client-Id` and `CF-Access-Client-Secret` for Cloudflare Access. If the Cloudflare vars are unset, the same research proxies still work for local development against an unprotected localhost backend.

## Data View

The `/data` page is an inventory-first operational view backed by these `finance-backend` routes:

- `GET /analyst/data-ops/inventory`
- `GET /analyst/data-ops/coverage`

It does not fall back to the legacy `/analyst/data-ops/health` contract. If the new contract is unavailable, the page renders a visible `Data Ops contract unavailable` state with the endpoint and status instead of showing guessed coverage.

## Development

```bash
npm install
npm run dev
```

### Local Clerk bypass

For local debugging with automation tools, Clerk can be bypassed by starting the dev server with:

```bash
ADMIN_AUTH_BYPASS=true npm run dev
```

This bypass is intentionally local-only. The code checks both conditions before skipping Clerk:

- `ADMIN_AUTH_BYPASS=true`
- `NODE_ENV !== 'production'`

That means a normal Vercel production deployment still requires Clerk even if `ADMIN_AUTH_BYPASS` is accidentally present in the environment. Do not add `ADMIN_AUTH_BYPASS` to Vercel production environment variables.

For agent/browser troubleshooting, see `AGENTS.md`. It documents the `ADMIN_AUTH_BYPASS=true npm run dev` flow, `agent-browser` install notes, screenshot/snapshot commands, error-overlay checks, and backend connectivity checks.

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
- `BACKEND_SERVICE_TOKEN`
- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`

Do not set `ADMIN_AUTH_BYPASS` in production. It is only for local `next dev`, and the app ignores it when `NODE_ENV=production`.
