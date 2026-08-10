# EOS Creative Studio — Module Boundaries

## Proposed source layout

```text
src/
  app/
    (marketing)/
    (auth)/
    (studio)/
    api/
      webhooks/fal/route.ts
  components/
    ui/
    studio/
  modules/
    identity/{application,domain,infrastructure}
    workspace/{application,domain,infrastructure}
    projects/{application,domain,infrastructure}
    assets/{application,domain,infrastructure}
    generation/{application,domain,infrastructure}
    credits/{application,domain,infrastructure}
    templates/{application,domain,infrastructure}
    brand-kit/{application,domain,infrastructure}
    activity/{application,domain,infrastructure}
    administration/{application,domain,infrastructure}
  infrastructure/
    config/
    database/
    fal/
    storage/
    auth/
    observability/
  lib/
    validation/
    result/
```

`app` folders define URLs; they do not become the domain layer. Private helpers may be colocated in route groups, but reusable business logic belongs in `modules`.

## Module responsibilities and ownership

| Module | Owns | Public application capabilities | Must not own |
|---|---|---|---|
| Identity | User profile, auth session mapping, invitations identity data | Resolve current user; profile operations | Workspace billing decisions |
| Workspace | Workspaces, memberships, roles, membership status | Create workspace; verify membership; role checks | Provider jobs or asset bytes |
| Projects | Projects and project membership/settings | Create/archive project; list project context | Credit accounting |
| Assets | Asset metadata, versions, provenance, visibility | List, tag, move, archive, download authorization | Rendering or provider submission |
| Generation | Generation requests/jobs, model/input snapshots, provider IDs | Validate and submit generation; query status; retry policy | Direct SQL or UI concerns |
| Credits | Credit accounts, reservations, ledger entries, pricing rules | Quote, reserve, release, capture, refund | Provider payload parsing |
| Templates | Reusable prompt/settings templates | CRUD with workspace visibility rules | Job execution |
| Brand Kit | Logos, colors, fonts, brand instructions | CRUD and approved asset references | Storage credential handling |
| Activity | Audit/activity events | Record and query workspace activity | Source-of-truth mutations |
| Administration | Workspace policy, quotas, provider/model enablement, support operations | Admin-only controls and reconciliation | Bypassing domain invariants |

## Dependency rules

- Presentation may call application services and view DTO mappers only.
- Application services may depend on domain types and injected ports.
- Domain modules may depend on shared primitives, never on Next.js, Supabase, fal.ai, React, or storage SDKs.
- Repositories implement ports defined by the owning module.
- `generation` may call the `credits` application port and provider ports; it may not update credit tables directly.
- `assets` may call storage ports for signed URLs; storage adapters never decide whether a user may access an asset.
- `activity` receives domain/application events and is not used as a transaction substitute.
- Webhook route handlers only authenticate/parse transport input and delegate to `generation` application services.

## Cross-module contracts

### Generation provider port

The generation module defines a provider-neutral port with operations equivalent to:

- `enqueue(request): Promise<{ providerRequestId, acceptedAt }>`
- `getStatus(providerRequestId)` for reconciliation only
- `verifyWebhook(rawBody, headers)`
- `normalizeWebhook(payload): ProviderJobEvent`

The fal.ai adapter implements this port and maps model-specific output into normalized asset candidates.

### Storage provider port

The storage module exposes upload initialization, object metadata, signed download URL, and deletion/retention operations. The application stores an object key and provider metadata; it does not store public secrets or assume a provider-specific URL shape.

### Credit port

Generation asks credits to quote and reserve a cost. Credits returns a reservation ID. On terminal provider outcome, generation requests capture, release, or refund using the reservation ID and an idempotency key.

## Route/API shape (planned)

- `/` and marketing routes: public presentation.
- `/login`, `/signup`, `/auth/callback`: Supabase Auth flow.
- `/studio`, `/studio/projects/[projectId]`: authenticated Server Component views.
- Server Actions or route handlers for authenticated mutations; every action repeats auth and workspace authorization.
- `POST /api/webhooks/fal`: public transport endpoint protected by fal.ai webhook verification and idempotency.

