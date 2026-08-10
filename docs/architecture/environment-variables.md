# EOS Creative Studio — Environment Variables

Environment variables are read by server-only configuration/infrastructure modules. Do not access secrets from Client Components. `.env*` files must remain untracked.

## Required by environment

| Variable | Scope | Required | Purpose |
|---|---|---:|---|
| `NEXT_PUBLIC_APP_URL` | Public | Yes | Canonical browser/app URL for callbacks and links |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Yes | Supabase browser-safe key, constrained by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Production | Privileged server operations; never expose |
| `FAL_KEY` | Server | When generation enabled | fal.ai API credential |
| `FAL_WEBHOOK_SECRET` | Server | When webhooks enabled | Webhook signature verification secret/configuration |
| `STORAGE_PROVIDER` | Server | Yes | `supabase` or `r2` adapter selection |
| `STORAGE_BUCKET` | Server | Yes | Private workspace asset bucket/container |
| `R2_ACCOUNT_ID` | Server | If `STORAGE_PROVIDER=r2` | Cloudflare account identifier |
| `R2_ACCESS_KEY_ID` | Server | If R2 | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Server | If R2 | R2 secret key |
| `R2_BUCKET` | Server | If R2 | R2 bucket name |
| `R2_ENDPOINT` | Server | If R2 | S3-compatible endpoint |
| `DATABASE_URL` | Server | Deployment-dependent | Direct pooled PostgreSQL connection for migrations/admin tooling, if used |

## Recommended platform/security configuration

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Server | Stable key when self-hosting across multiple instances |
| `LOG_LEVEL` | Server | Structured logging threshold |
| `SENTRY_DSN` | Server/public as designed | Error monitoring destination; add only with a selected monitoring provider |
| `CRON_SECRET` | Server | Authenticate scheduled reconciliation endpoints, if scheduled routes are used |
| `CSP_REPORT_URI` | Public/server | Content Security Policy report destination, if enabled |

## Configuration rules

- Parse and validate variables at startup with Zod, producing actionable errors for missing/invalid values.
- Keep public and server configs in separate modules, for example `config/public.ts` and `config/server.ts`.
- Do not use fallback production secrets or silently switch providers.
- Use separate Supabase, fal.ai, and storage projects/buckets for local, staging, and production.
- Rotate provider credentials and webhook secrets using the deployment platform’s secret manager.
- `FAL_WEBHOOK_SECRET` is shown as a logical variable; the exact verification mechanism must follow fal.ai’s current webhook configuration.

