---
name: eos-qa
description: QA a change in EOS Creative Studio (Next.js frontend, with the NestJS backend beside it). Use after editing UI, auth, API clients, i18n or generation flows, or when asked to "QA", "test", "verify", "ตรวจ", "ทดสอบ" a page or feature. Runs static gates, checks the real app in a browser in Thai and English at three widths, avoids credit-spending actions, and reports in the repo's QA format.
---

# EOS QA

Verify a change against the running app and report only what you actually ran. Reuse the habits already visible in `design-qa.md`, `docs/qa-history/README.md` and `scripts/*qa*`.

## 0. Scope the change
1. `git status --short` and `git diff --stat` to see what changed. Map files to routes: `src/app/(studio)/<route>`, `src/features/<area>`, `src/lib/api/*`, `src/lib/i18n/dictionary.ts`.
2. Write down 3-6 concrete behaviours to verify (the happy path, one empty/error state, one keyboard path). Test what the change touches first, then a short regression pass on neighbours (same route, shared components).
3. This repo's Next.js has breaking changes (see `AGENTS.md`). If you must change code while fixing a finding, read the relevant guide under `node_modules/next/dist/docs/` first.

## 1. Static gates (always, from `EOS-Creative-Studio/`)
```bash
npx tsc --noEmit
npx eslint <changed files>      # scoped; `npm run lint` for a wide change
git diff --check                # CRLF warnings are pre-existing noise
npm run build                   # for route, config, auth or dependency changes
```
Existing plain-Node checks (no browser, no network): `node scripts/usage-qa.mjs` (10 checks, passes as of 2026-10-20) and `node scripts/qa-history-api.cjs` (fails as of 2026-10-20 with "History response was invalid" on a clean tree, so treat it as a pre-existing failure and say so, do not "fix" it silently). `scripts/qa-image-completion.cjs` has hard-coded paths from another machine and will not run here; use it only as a pattern. When a bug is fixed, add a regression check in the same style rather than only re-clicking.

Backend change or API-contract change (`../EOS-Studio-Creative-Backend/`): `npm run typecheck`, `npm run lint`, `npm test` (jest, unit specs). Never run `db:*` scripts: they talk to a real database.

## 2. Browser QA
- App: `http://localhost:3000` (`npm run dev`, webpack). First check readiness (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` returns 200; poll rather than assuming a fresh server is up) and whether something already listens on the port. Start a server only if none is running, and **stop only what you started**, even when a check fails. Backend is `http://localhost:4000` and may point at real services.
- The browser pane throttles `requestAnimationFrame` and reports `innerWidth` 0 until it has rendered a frame. After navigate, reload or `resize_window`, take a screenshot first, then read state with JS. Without it the English switch (applied inside rAF) looks like it failed, and layout measurements are wrong. A screenshot taken right after a resize or modal open can show the old layout; take a second one.
- First visit to `/` shows a cookie banner (choose "ปิดและปฏิเสธคุกกี้ที่ไม่จำเป็น"), and after consent an intro-video dialog auto-opens once per day (`eos-intro-video-shown-date-v1`). Close it with its button before testing the login modal. Clear the keys you set (`eos-locale`, the intro key) when you finish.
- **Signed-in QA:** use the user's own Chrome through Claude in Chrome (`mcp__claude-in-chrome__*`; its extension must be allowed on `localhost`, otherwise navigations bounce back to New Tab). Never enter their password; they sign in themselves. Refs go stale after a tab switch, so re-`find` or use `read_page` again. Before pressing Enter after Tab, read `document.activeElement`: focus can land on an unrelated action (it landed on "ส่งออก"). Do not `resize_window` the user's real Chrome. Loading `/create/image` fires read-only `generations/image/quote` POSTs by itself; that is expected.
- In a fresh Chrome tab the first `navigate` to localhost can bounce back to New Tab; navigate once more. Send keys that depend on React state (open a menu, then arrow) as separate calls: a second key in the same call can arrive before focus has moved. `PowerShell`-style multi-key strings like `ArrowDown ArrowDown` are fine when no re-render sits between them.
- Capture the observation (snapshot text, console, network, screenshot) **before** asserting on it; a verdict without captured evidence is not a pass.
- Use the built-in browser (`mcp__Claude_Browser__*`); prefer `read_page`/`get_page_text` over screenshots, take screenshots as evidence.
- **Copy lives in two places:** `src/lib/i18n/dictionary.ts` (most pages) and `src/lib/i18n/studio-copy.ts` (usage, history, assets, templates, clear-all, studio not-found). Pages whose root has `data-no-translate` skip the automatic translator, so every string must come from one of those tables. After a copy change, grep the rendered page for leftover Thai in English (ignore the baht sign ฿ and user-generated titles).
- **Locale:** a fresh browser is **Thai**. English is `localStorage["eos-locale"]="en"`. Any copy, label, validation or a11y-name change must be checked in both, with no raw dictionary keys, no mixed languages and no clipped Thai text.
- **Auth:** everything under `(studio)` redirects to `/?login=1` without a session. The public surface (landing page, login/register/forgot modal, `/legal/*`, `/intro-video`) needs no account. For logged-in pages ask the user for a test account or a signed-in browser session; never use real customer credentials, never type secrets into chat, and do not edit `.env` or turn on `NEXT_PUBLIC_DEV_AUTH_BYPASS` without asking (it only works with `NODE_ENV=development`).
- **Each page:** loads without console errors or failed network requests; loading, empty, error and long-content states; images actually load (`naturalWidth > 0`); Escape closes dialogs and returns focus; Tab order and accessible names make sense.
- **Responsive:** 1440 (desktop), 900 (tablet), 390 (mobile). At each width check `document.documentElement.scrollWidth <= innerWidth` (no horizontal overflow) and that content is not hidden behind the floating generation widget. Reset the viewport to desktop afterwards.
- **Design fidelity:** when a mockup exists in `docs/reference/`, compare the same viewport side by side and list differences; do not claim pixel-perfect.

## 3. Hard limits (ask first, per action)
Do not, in a QA pass: submit a generation (it spends credits), delete or rename user data, download or export, open Stripe checkout or pay, register an account or request a password reset or confirmation email, click Google sign-in, or call `db:*` scripts. For generation-flow logic use the mocked-API approach in `scripts/qa-image-completion.cjs` (mock `@/lib/api/*`, real hook, no credits). Say in the report which such actions were deliberately not executed.

## 4. Reading results
- A failing check is a finding until you know why. Classify it: **app bug**, **test/QA-method error**, **environment** (server down, model/auth/quota, stale `.next`) or **pre-existing**. Do not weaken an expectation to get a pass; fix the method and re-run only the affected check.
- A skipped, interrupted or unexecuted check is **not run**, never passed.
- Severity: P1 blocks the user flow or loses data/credits; P2 visibly wrong or inaccessible; P3 polish.

## 5. Report (Thai unless asked otherwise)
Use the structure of the existing QA docs. Record each browser check as a case so a reader can replay it:
```
TC1  <what>          steps: ...   expected: ...   actual: ...   PASS | FAIL | NOT RUN
```
```
# QA — <area> (<date>)
## Evidence       route, locale, viewport(s), build/commit or branch, account type used
## Verification   gates + cases TC1..TCn, then a one-line total (N run, X passed, Y failed, Z not run)
## Findings       P1/P2/P3 with steps to reproduce and screenshot or console/network snippet
## Not executed   the hard-limit actions and any check you could not run, with the reason
final result: passed | passed with follow-ups | failed | blocked
```
Only write into `docs/<area>-qa-<date>/` (screenshots named `01-before.png`, `02-after.png` ...) when the user asks to keep the record. Never commit QA output on your own; follow the user's git flow (from `develop`, new branch `YYYYMMDD/type/slug`) and confirm before committing or pushing.

## 6. Fixing what you find
QA reports; it does not silently implement. Fix a finding only when the user asked for QA-and-fix, and then only findings inside the requested change; report the rest. After a fix, re-run the failed check plus the static gates, and say what was re-verified. Leave the machine as you found it: stop servers you started, close tabs you opened, reset the viewport.
