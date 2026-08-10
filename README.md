# EOS Creative Studio

EOS Creative Studio is a production-oriented AI creative workspace foundation built with Next.js App Router, TypeScript strict mode, Tailwind CSS, shadcn/ui-style primitives, Lucide React, Zod, React Hook Form, and Supabase-ready infrastructure boundaries.

## Current foundation

- Responsive studio shell with sidebar navigation, top bar, and desktop usage rail.
- Route skeleton for dashboard, projects, creation flows, templates, assets, brand kit, team, history, usage, settings, and login.
- Server Components by default, with small Client Components only for interactive navigation and form state.
- Semantic design tokens and custom UI primitives for buttons, cards, badges, empty states, and loading states.
- Provider interfaces for generation and storage; fal.ai calls and Supabase migrations are intentionally deferred.
- Route-level metadata plus loading, error, not-found, and forbidden states.

## Development

```bash
npm run dev
npm run lint
npm run build
```

Open [http://localhost:3000](http://localhost:3000). The root route redirects to `/dashboard`.

## Architecture

See [`docs/architecture/`](./docs/architecture/) for the system overview, module boundaries, generation lifecycle, security boundaries, environment contract, and implementation plan.

## Deferred work

Supabase Auth/session wiring, database migrations, repositories, credit ledger persistence, fal.ai queue/webhook processing, asset storage, moderation, and production reconciliation are planned for later implementation phases. No Remotion, HyperFrames, FFmpeg, Redis, BullMQ, or custom rendering worker is used.
