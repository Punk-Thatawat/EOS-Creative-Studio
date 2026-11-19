// Links .claude/skills into .agents/skills so Codex and Claude Code share one set of skills.
import { existsSync, mkdirSync, lstatSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, '.claude', 'skills');
const target = resolve(root, '.agents', 'skills');

if (!existsSync(source)) {
  console.error(`Missing ${source}`);
  process.exit(1);
}

let alreadyThere = false;
try {
  lstatSync(target);
  alreadyThere = true;
} catch {}

if (alreadyThere) {
  console.log(`${target} already exists; nothing to do.`);
} else {
  mkdirSync(dirname(target), { recursive: true });
  // 'junction' works on Windows without admin rights; it is ignored on macOS/Linux.
  symlinkSync(source, target, 'junction');
  console.log(`Linked ${target} -> ${source}`);
}
