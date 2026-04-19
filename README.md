# Spy Signal Backoffice

Admin-only operational console (separate app) for analyst job workflows.

## Features

- Clerk-authenticated access
- Email allowlist admin authorization (`ADMIN_EMAIL_ALLOWLIST`)
- Analyst job creation (`ticker_snapshot`, `coverage_report`)
- Job status polling and persisted result rendering
- Recent jobs history with failed-job retry

## Environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ADMIN_EMAIL_ALLOWLIST` (comma-separated, lowercase email list)
- `BACKEND_BASE_URL`
- `BACKEND_SERVICE_TOKEN` (optional)

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
