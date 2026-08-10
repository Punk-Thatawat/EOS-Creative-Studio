# EOS Creative Studio — Implementation Plan

## Now: architecture/documentation baseline

Completed by this deliverable:

- Repository and dependency inventory.
- Modular monolith boundaries.
- Generation state machine and failure/idempotency rules.
- Security zones and authorization rules.
- Environment-variable contract.
- Deferred work and unresolved decisions.

No business feature code, database migration, provider integration, rendering worker, or new dependency was added.

## Phase 1: platform foundation

1. Add strict runtime configuration parsing and server-only boundaries.
2. Add Supabase Auth session handling, database client factories, and RLS baseline.
3. Establish `modules/*` layout, shared result/error types, logging, and test tooling.
4. Add shadcn/ui and Tailwind design tokens based on the supplied EOS references.
5. Define migrations and repository contract tests.

## Phase 2: tenant and content foundations

1. Identity, workspace membership, roles, and invitation flows.
2. Projects and asset metadata with private storage abstraction.
3. Activity/audit event recording.
4. Initial studio shell and Server Component navigation.

## Phase 3: generation vertical slice

1. Model catalog and Zod schemas for image generation first.
2. Credit quote/reservation/capture/release ledger with transactional invariants.
3. Generation job creation and server-side fal.ai queue submission.
4. Verified fal.ai webhook route, inbox idempotency, normalized output, and asset persistence.
5. Job status UI with bounded polling/revalidation and failure states.
6. Add video generation using the same provider port; fal.ai remains responsible for rendering.

## Phase 4: product modules

- Audio generation.
- AI presenter integration, subject to provider/model selection.
- Document processing pipeline and document asset lifecycle.
- Templates and Brand Kit.
- Usage dashboard, credit history, quotas, and administration.

## Phase 5: production hardening

- Reconciliation and stuck-job recovery.
- Rate limiting, abuse controls, moderation, malware scanning, and retention enforcement.
- Observability dashboards, alerting, audit review, backup/restore drills, and load testing.
- Contract tests against fal.ai webhook fixtures and storage providers.

## Explicitly deferred

- Microservices and separate workers.
- BullMQ, Redis, or any queue infrastructure owned by EOS.
- Remotion, HyperFrames, FFmpeg, local rendering, and composition engines.
- Billing provider integration and paid plan enforcement until pricing/entitlement rules are approved.
- Realtime transport until polling/revalidation is proven insufficient.
- Multi-region deployment and cross-region storage replication.

## Definition of done for the first production slice

- An authenticated member can create a project and submit an allowlisted image generation.
- Credit reservation and terminal settlement are atomic and idempotent.
- fal.ai credentials are server-only and webhook authenticity is verified.
- Duplicate, delayed, failed, and out-of-order webhook events do not double-create assets or charge credits.
- Assets are private by default and downloadable only after authorization.
- Job, ledger, and audit records are queryable for support and reconciliation.
- Unit, repository, application, webhook contract, and end-to-end smoke tests cover the lifecycle.

## Assumptions

- Supabase is the initial system of record for PostgreSQL and Auth.
- Storage is behind an adapter so Supabase Storage can be used first and R2 can be introduced without changing domain code.
- fal.ai supports the required queue/webhook flow for the selected models; model-specific limits remain configuration data.
- A workspace is the billing and isolation boundary; projects are organizational sub-scopes.
- The product will initially use a single Next.js deployment/runtime.

## Risks

- Provider output URLs and retention may expire before users download or before copies complete.
- Credit pricing can drift from provider costs if model/version configuration is not versioned.
- At-least-once webhooks and lost provider responses require reconciliation before high-value production usage.
- Document and presenter features may require different providers and moderation policies.
- Large media uploads/downloads can exceed serverless request limits if proxied through Next.js.
- Prompt, document, and generated-media retention may create privacy/compliance obligations.

## Unresolved decisions

1. Which fal.ai models and model-version catalog are approved for launch?
2. Should EOS copy all outputs into workspace-owned storage, or retain provider URLs where allowed?
3. What are the credit unit, refund, reservation expiry, and subscription/overage rules?
4. Which roles and project-level permissions are required beyond owner/admin/member?
5. Which moderation, copyright, PII, and malware-scanning policies apply to uploads and outputs?
6. Will realtime updates be needed, or are revalidation and bounded polling sufficient?
7. Which deployment/observability provider will host logs, traces, alerts, and scheduled reconciliation?
8. What retention, export, deletion, and legal-hold requirements apply per asset type?

