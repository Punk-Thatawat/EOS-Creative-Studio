# EOS Creative Studio — Security Boundaries

## Trust zones

| Zone | Examples | Trust level | Rules |
|---|---|---|---|
| Browser | Forms, route params, uploaded files, client state | Untrusted | Treat all values as attacker-controlled; no provider secrets or pricing authority |
| Next.js server | Server Components, Actions, Route Handlers | Privileged application edge | Authenticate, authorize, validate, rate-limit, and return DTOs only |
| Domain/application | Use cases and policies | Trusted business logic | No network/SQL framework dependencies; enforce invariants consistently |
| Supabase | Auth, PostgreSQL, Storage | Managed boundary | Use least-privilege keys, RLS, transactions, and private buckets |
| fal.ai | Queue and webhook sender | External provider | Verify webhook authenticity; normalize and constrain payloads |
| Storage provider | Supabase Storage or R2 | External provider | Private objects by default; signed URLs with short TTL |
| Operations | Logs, admin tools, support access | Highly privileged | Audit every access and avoid raw prompt/output leakage |

## Authentication and authorization

- Supabase Auth establishes identity; application code resolves the session on the server.
- Workspace membership and role are checked for every workspace-scoped read and mutation, not only at page render time.
- Project access is checked independently where project-level restrictions exist.
- Administration operations require an explicit admin capability; UI hiding is not authorization.
- Repository methods require a workspace context and include `workspace_id` in predicates. Never fetch by opaque ID alone.
- Service-role Supabase access, if needed for webhooks or privileged jobs, is isolated to server-only infrastructure and must perform application-level scope checks.

## Data protection

- Keep Supabase service-role, fal.ai, storage, and webhook secrets server-only.
- Only variables prefixed `NEXT_PUBLIC_` may be exposed to the browser, and only when their public nature is intentional.
- Mark privileged modules with `server-only` and prevent imports into Client Components.
- Pass narrow view DTOs to Client Components; never pass raw database rows, provider payloads, or internal ledger records.
- Use private storage buckets and short-lived signed download URLs. Never expose bucket credentials.
- Store prompt/input/output metadata according to a retention policy; default logs should be redacted.
- Encrypt in transit and rely on managed database/storage encryption at rest; document key ownership and rotation operationally.

## Input and output controls

- Validate JSON, form data, query parameters, file metadata, and webhook bodies with Zod or equivalent schemas.
- Enforce limits on prompt length, number of images, file size, MIME type, model selection, aspect ratio, duration, and generation frequency.
- Maintain an allowlisted model catalog; do not accept arbitrary fal.ai model IDs from the client.
- Treat generated text and media metadata as untrusted content when rendered. Escape text and use safe media URL policies.
- Consider malware scanning and content moderation for uploaded and generated assets before sharing publicly.

## Webhook security

- Preserve the raw request body for signature verification before JSON parsing.
- Verify fal.ai signature, timestamp/replay window, and expected event shape.
- Reject unknown or stale events safely; return an acknowledgment only after deciding whether the event was accepted or intentionally ignored.
- Use an inbox/idempotency table with a unique provider event key.
- Never authorize a user action from webhook payload fields; look up the EOS job and its workspace from the stored provider request ID.

## Abuse and reliability controls

- Rate-limit generation submission, upload initialization, webhook processing, and expensive reads.
- Add per-workspace concurrency and credit limits before provider submission.
- Audit login/security events, membership changes, credit mutations, generation commands, webhook outcomes, and admin actions.
- Redact tokens, cookies, signed URLs, prompts where sensitive, and provider payload secrets from logs.
- Define retention/deletion behavior for assets, prompts, documents, and activity records before launch.

