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
- `FINANCE_BACKEND_URL`
- `FINANCE_BACKEND_SERVICE_TOKEN` (optional)

## Development

```bash
npm install
npm run dev
```

## Deployment

Deploy as a separate Vercel project/subdomain (example: `admin.yourdomain.com`) so admin tooling is isolated from the public app.

## CI/CD (GitHub Actions -> Vercel)

This repo includes `.github/workflows/deploy-vercel.yml`.
On every merge/push to `main`, it runs lint/build and deploys to Vercel production.

Required GitHub repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Recommended Vercel production environment variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `ADMIN_EMAIL_ALLOWLIST`
- `FINANCE_BACKEND_URL`
- `FINANCE_BACKEND_SERVICE_TOKEN` (if backend expects bearer auth)
