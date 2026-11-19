<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shared Codex + Claude setup

`CLAUDE.md` imports this file, so Codex and Claude Code follow the same rules. Keep shared rules here.

- Skills live in `.claude/skills/`. Codex reads `.agents/skills/`, which is a local link to the same folder — run `node scripts/link-agent-skills.mjs` once after cloning. `.agents/` is git-ignored.
- MCP servers are declared twice because the formats differ: `.mcp.json` (Claude) and `.codex/config.toml` (Codex). Change both together.
- `.claude/commands/` and `.claude/hooks/` (the secret scanner) are Claude Code only. Codex does not run them.

### Second-opinion review (Claude Code only)

Claude Code has the Codex plugin. Before reporting work as done, run `/codex:review` when the change:

- edits more than 3 files, or more than about 150 lines, or
- touches auth (`src/app/(auth)`, `src/app/auth`, `src/lib/auth`, `src/lib/supabase`), credits (`src/lib/credits`), affiliate code, API routes (`src/app/api`) or generation flows.

Skip it for small copy, style or docs edits. Apply findings you agree with, and say briefly why you rejected any you did not. Do not use `/codex:rescue` or the review gate unless the user asks. Codex itself should ignore this section.
