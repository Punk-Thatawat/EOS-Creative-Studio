---
description: "Refactor code safely in small steps without changing behaviour (frontend)"
---

# Refactor code: $ARGUMENTS

Refactoring keeps external behaviour the same and improves internal structure. Do only what the goal needs; do not add features, patterns or optimisations nobody asked for.
Do NOT create a branch, commit or push. The user decides that.

1. **Goal and scope** - State in one or two lines what "better" means here (readability, duplication, size, separation of concerns) and which files are in scope. If `$ARGUMENTS` is unclear, ask before changing anything.
2. **Understand first** - Read the code and find every place that imports or uses it (Grep). Note the behaviour that must not change, including i18n keys (Thai and English) and exported names.
3. **Safety net** - Find tests or QA scripts that cover it (see the `eos-qa` skill). If nothing covers the behaviour, say so and agree on how to check it (browser check, small test) before editing. Run what exists and note the baseline.
4. **Small steps** - One focused change at a time (extract, rename, remove dead code, simplify a condition). Update all dependants in the same step. Re-check after each step.
5. **Static checks** - `npx tsc --noEmit` and `npm run lint` on the project (if tsc shows errors only in `.next/dev/types` after a branch switch, they are stale, not real). Fix what the refactor caused; report unrelated existing problems instead of fixing them.
6. **No regressions** - Run the checks from step 3 again and, for UI, verify the affected pages in the browser in both languages.
7. **Summary** - List what changed and why, which checks passed, and anything you left alone on purpose.

Priority: safety over speed. If a step cannot be verified, stop and say so.
