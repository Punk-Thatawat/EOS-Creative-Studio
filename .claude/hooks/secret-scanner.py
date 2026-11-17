#!/usr/bin/env python3
"""
Secret scanner hook (PreToolUse / Bash) - EOS variant.

Blocks `git commit` when the lines that are about to be committed contain
high-confidence secrets. Based on the aitmpl "secret-scanner" hook, changed to:
  * scan only ADDED lines (git diff -U0), not whole files
  * block only high-confidence rules (no UUID / JWT / Telegram / Cloudflare guesses)
  * never print the secret value (only rule, file:line, first 4 chars + length)
  * work with `git -C path commit`, `cd path && git commit`, `git add x && git commit`
  * use ASCII output and UTF-8 pipes (the original prints emoji and can crash on Windows code pages)
  * refuse to commit real .env files / private key files by name

Exit codes: 0 = allow, 2 = block (stderr is shown to Claude). Internal errors fail open.
Allow a line on purpose by adding the marker  secret-scanner:ignore  to it.
Local only: runs `git` and reads files, no network, writes nothing.
"""

import json
import math
import os
import re
import subprocess
import sys

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

IGNORE_MARKER = "secret-scanner:ignore"
MAX_LINE = 3000
MAX_UNTRACKED_BYTES = 1_000_000
EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

# (rule id, regex, group with the secret value (0 = whole match), min entropy or None)
RULES = [
    ("AWS access key id", r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b", 0, None),
    ("AWS secret access key", r"(?i)aws[_\-\s]*secret[_\-\s]*access[_\-\s]*key['\"\s]*[=:]['\"\s]*([A-Za-z0-9/+=]{40})\b", 1, 3.5),
    ("Anthropic API key", r"\bsk-ant-[A-Za-z0-9_\-]{20,}", 0, None),
    ("OpenAI project key", r"\bsk-proj-[A-Za-z0-9_\-]{32,}", 0, None),
    ("OpenAI API key", r"\bsk-[A-Za-z0-9]{48,}\b", 0, None),
    ("Google API key", r"\bAIza[0-9A-Za-z_\-]{35}\b", 0, None),
    ("Google OAuth token", r"\bya29\.[0-9A-Za-z_\-]{30,}", 0, None),
    ("Stripe live key", r"\b[sr]k_live_[0-9a-zA-Z]{24,}", 0, None),
    ("GitHub token", r"\bgh[posr]_[0-9a-zA-Z]{36}\b", 0, None),
    ("GitHub fine-grained token", r"\bgithub_pat_[0-9a-zA-Z_]{22,}", 0, None),
    ("GitLab token", r"\bglpat-[0-9a-zA-Z_\-]{20,}", 0, None),
    ("Slack token", r"\bxox[baprs]-[0-9a-zA-Z\-]{10,}", 0, None),
    ("npm token", r"\bnpm_[0-9a-zA-Z]{36,}\b", 0, None),
    ("PyPI token", r"\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_\-]{50,}", 0, None),
    ("Hugging Face token", r"\bhf_[a-zA-Z0-9]{34,}\b", 0, None),
    ("Replicate token", r"\br8_[a-zA-Z0-9]{38,}\b", 0, None),
    ("Groq key", r"\bgsk_[a-zA-Z0-9]{48,}\b", 0, None),
    ("SendGrid key", r"\bSG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}\b", 0, None),
    ("Twilio key", r"\bSK[0-9a-f]{32}\b", 0, 3.0),
    ("DigitalOcean token", r"\bdo[po]_v1_[0-9a-f]{64}\b", 0, None),
    ("Discord webhook", r"https://discord(?:app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_\-]+", 0, None),
    ("Private key block", r"-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----", 0, None),
    (
        "Database URL with password",
        r"\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?)://[^\s'\"/:@]*:([^\s'\"@/]{3,})@(?!localhost\b|127\.0\.0\.1|\[::1\]|host\.docker\.internal|example\.)[^\s'\"/]+",
        1,
        None,
    ),
    (
        "Hardcoded API key / token / secret",
        r"(?i)\b(?:api[_\-]?key|secret[_\-]?key|access[_\-]?token|auth[_\-]?token|client[_\-]?secret)\b['\"]?\s*[:=]\s*['\"]([A-Za-z0-9_\-+/=]{24,})['\"]",
        1,
        3.5,
    ),
]
COMPILED = [(name, re.compile(rx), grp, ent) for name, rx, grp, ent in RULES]

PLACEHOLDER_WORDS = (
    "example", "placeholder", "your", "dummy", "changeme", "change-me", "sample",
    "redacted", "fake", "xxxx", "0000", "1234", "<", "${", "{{", "...",
)

SKIP_DIR_PARTS = {"node_modules", "vendor", ".git", "dist", "build", ".next", "coverage",
                  "__pycache__", ".pytest_cache", "venv", ".venv", ".turbo", "out"}
SKIP_FILE_NAMES = {".env.example", ".env.sample", ".env.template", ".env.dist", "package-lock.json",
                   "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "Pipfile.lock", "Cargo.lock", "go.sum",
                   ".gitignore", "secret-scanner.py"}
SKIP_EXTENSIONS = (".lock", ".map", ".min.js", ".min.css", ".svg", ".png", ".jpg", ".jpeg", ".gif",
                   ".webp", ".ico", ".pdf", ".woff", ".woff2", ".ttf", ".mp4", ".mp3", ".wav", ".zip")

SENSITIVE_NAME = re.compile(r"^(?:\.env(?:\..+)?|id_rsa|id_ed25519|id_ecdsa|.+\.(?:p12|pfx|jks|keystore))$")
SAFE_ENV_NAME = re.compile(r"^\.env\.(?:example|sample|template|dist|defaults?)$")


def entropy(value):
    if not value:
        return 0.0
    counts = {}
    for ch in value:
        counts[ch] = counts.get(ch, 0) + 1
    return -sum((n / len(value)) * math.log2(n / len(value)) for n in counts.values())


def looks_placeholder(value):
    low = value.lower()
    return any(word in low for word in PLACEHOLDER_WORDS)


def skip_path(path):
    norm = path.replace("\\", "/")
    parts = norm.split("/")
    if set(parts[:-1]) & SKIP_DIR_PARTS:
        return True
    name = parts[-1]
    return name in SKIP_FILE_NAMES or name.endswith(SKIP_EXTENSIONS)


def redact(value):
    return f"{value[:4]}... ({len(value)} chars)"


def scan_line(path, lineno, line):
    if IGNORE_MARKER in line or len(line) > MAX_LINE:
        return []
    found = []
    for name, rx, grp, min_entropy in COMPILED:
        for match in rx.finditer(line):
            value = match.group(grp)
            if looks_placeholder(value):
                continue
            if min_entropy is not None and entropy(value) < min_entropy:
                continue
            found.append({"rule": name, "file": path, "line": lineno, "shown": redact(value)})
    return found


def run_git(args, cwd):
    result = subprocess.run(
        ["git", "-c", "core.quotepath=off", *args],
        cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    return result.returncode, result.stdout


def parse_added_lines(diff_text):
    """Yield (path, lineno, text) for every added line of a -U0 diff."""
    path = None
    lineno = 0
    for raw in diff_text.split("\n"):
        if raw.startswith("+++ "):
            target = raw[4:].strip()
            path = None if target == "/dev/null" else (target[2:] if target.startswith("b/") else target)
        elif raw.startswith("@@"):
            match = re.search(r"\+(\d+)", raw)
            lineno = int(match.group(1)) if match else 0
        elif raw.startswith("+") and not raw.startswith("+++") and path:
            yield path, lineno, raw[1:]
            lineno += 1


def strip_quotes(command):
    return re.sub(r"\"[^\"]*\"|'[^']*'", '""', command)


def git_commit_in(command):
    return re.search(r"\bgit\b(?:\s+-[Cc]\s+\S+|\s+--?[\w-]+(?:=\S+)?)*\s+commit\b", command) is not None


def to_native_path(path, cwd):
    path = path.strip("\"'")
    if os.name == "nt":
        match = re.match(r"^/([a-zA-Z])/(.*)$", path)
        if match:
            path = f"{match.group(1).upper()}:/{match.group(2)}"
    return path if os.path.isabs(path) else os.path.join(cwd, path)


def resolve_dir(command, cwd):
    match = re.search(r"\bgit\s+-C\s+(\"[^\"]+\"|'[^']+'|\S+)", command)
    if not match:
        match = re.match(r"\s*cd\s+(\"[^\"]+\"|'[^']+'|[^\s;&|]+)\s*(?:&&|;)", command)
    if match:
        candidate = to_native_path(match.group(1), cwd)
        if os.path.isdir(candidate):
            return candidate
    return cwd


def collect(command, repo):
    """Return ({path: [(lineno, text)]}, [paths]) describing what the commit would contain."""
    plain = strip_quotes(command)
    lines = {}
    paths = set()

    def add_diff(args):
        code, out = run_git(["diff", "--no-ext-diff", "--no-color", "-U0", "--diff-filter=ACMR", *args], repo)
        if code == 0:
            for path, lineno, text in parse_added_lines(out):
                lines.setdefault(path, []).append((lineno, text))
        code, out = run_git(["diff", "--no-ext-diff", "--name-only", "--diff-filter=ACMR", *args], repo)
        if code == 0:
            paths.update(p for p in out.split("\n") if p.strip())

    add_diff(["--cached"])

    commit_part = re.split(r"\bgit\b[^;&|]*?\bcommit\b", plain, maxsplit=1)
    after_commit = commit_part[1] if len(commit_part) > 1 else ""
    if re.search(r"(?:^|\s)(?:-[A-Za-z]*a[A-Za-z]*|--all)(?=\s|$)", after_commit):
        add_diff([])

    for part in re.split(r"&&|;|\|\|", plain):
        add = re.search(r"\bgit\b(?:\s+-C\s+\S+)?\s+add\s+(.*)$", part.strip())
        if not add:
            continue
        tokens = add.group(1).split()
        flags = [t for t in tokens if t.startswith("-")]
        specs = [t.strip('"') for t in tokens if not t.startswith("-") and t != '""']
        everything = any(t in {"-A", "--all"} for t in flags) or any(s in {".", ":/"} for s in specs)
        tracked_only = any(t in {"-u", "--update"} for t in flags)
        pathspec = [] if everything or (tracked_only and not specs) else (["--", *specs] if specs else [])
        if everything or specs or tracked_only:
            code, _ = run_git(["rev-parse", "--verify", "-q", "HEAD"], repo)
            add_diff(["HEAD", *pathspec] if code == 0 else [EMPTY_TREE, *pathspec])
        if not tracked_only and (everything or specs):
            code, out = run_git(["ls-files", "--others", "--exclude-standard", *pathspec], repo)
            if code == 0:
                for rel in out.split("\n"):
                    rel = rel.strip()
                    full = os.path.join(repo, rel)
                    if not rel or not os.path.isfile(full) or skip_path(rel):
                        continue
                    paths.add(rel)
                    try:
                        if os.path.getsize(full) > MAX_UNTRACKED_BYTES:
                            continue
                        with open(full, "rb") as handle:
                            data = handle.read()
                        if b"\0" in data[:1024]:
                            continue
                        for index, text in enumerate(data.decode("utf-8", errors="ignore").split("\n"), 1):
                            lines.setdefault(rel, []).append((index, text))
                    except OSError:
                        pass
    return lines, sorted(paths)


def report(findings, name_hits):
    err = sys.stderr
    print("", file=err)
    print("SECRET SCANNER: commit blocked, possible secrets in the lines to be committed.", file=err)
    for hit in name_hits:
        print(f"  [file] {hit}: sensitive file name, do not commit it (add it to .gitignore).", file=err)
    for item in findings:
        print(f"  [{item['rule']}] {item['file']}:{item['line']}  value starts {item['shown']}", file=err)
    print("", file=err)
    print("Fix: move the value to an environment variable / untracked .env, rotate it if it was real.", file=err)
    print(f"False positive: add the marker '{IGNORE_MARKER}' to that line, or put 'example'/'placeholder' in the value.", file=err)


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0
    command = (data.get("tool_input") or {}).get("command", "")
    if not command or not git_commit_in(strip_quotes(command)):
        return 0

    cwd = data.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    repo = resolve_dir(command, cwd)
    code, _ = run_git(["rev-parse", "--show-toplevel"], repo)
    if code != 0:
        return 0

    lines, paths = collect(command, repo)
    name_hits = sorted({p for p in paths
                        if SENSITIVE_NAME.match(os.path.basename(p)) and not SAFE_ENV_NAME.match(os.path.basename(p))})
    findings = []
    seen = set()
    for path, entries in lines.items():
        if skip_path(path):
            continue
        for lineno, text in entries:
            for item in scan_line(path, lineno, text):
                key = (item["file"], item["line"], item["rule"])
                if key not in seen:
                    seen.add(key)
                    findings.append(item)

    if findings or name_hits:
        report(findings, name_hits)
        return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as exc:  # fail open: a broken hook must not freeze every commit
        print(f"secret-scanner: internal error, commit not scanned: {exc}", file=sys.stderr)
        sys.exit(0)
