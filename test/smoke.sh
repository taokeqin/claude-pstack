#!/usr/bin/env bash
# Offline checks: no model calls, no subscription usage.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pass=0 fail=0
ok() { echo "ok   $1"; pass=$((pass + 1)); }
no() { echo "FAIL $1"; fail=$((fail + 1)); }

claude plugin validate "$ROOT/.claude-plugin/plugin.json" >/dev/null 2>&1 && ok "plugin manifest" || no "plugin manifest"
claude plugin validate "$ROOT" >/dev/null 2>&1 && ok "marketplace manifest" || no "marketplace manifest"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
hook() { echo "{\"cwd\":\"$TMP\",\"transcript_path\":\"/t.jsonl\"}" | CLAUDE_PLUGIN_ROOT="$ROOT" node "$ROOT/hooks/session-start.mjs"; }
out="$(hook)"
grep -q 'pstack on Claude Code' <<<"$out" && grep -q 'No .pstack/models.md' <<<"$out" && ok "hook without config" || no "hook without config"
mkdir -p "$TMP/.pstack" && echo "bug-fix: sonnet" >"$TMP/.pstack/models.md"
out="$(hook)"
grep -q '<pstack_models' <<<"$out" && grep -q 'bug-fix: sonnet' <<<"$out" && grep -q 'Current transcript: /t.jsonl' <<<"$out" && ok "hook with config" || no "hook with config"

left="$(grep -rnE '\.cursor/rules|pstack-models\.mdc|AskQuestion\b|generalPurpose|claude-opus-5-5-|grok-4\.7|gpt-5\.6-sol|`readonly`: `true`' "$ROOT/skills" "$ROOT/agents" --include='*.md' || true)"
[ -z "$left" ] && ok "no Cursor tool/model leftovers" || { no "Cursor leftovers"; echo "$left" | head; }

pre() { echo "{\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"$1\"}}" | CLAUDE_PLUGIN_ROOT="$ROOT" node "$ROOT/hooks/allow-plugin-read.mjs"; }
grep -q '"allow"' <<<"$(pre "$ROOT/CLAUDE-CODE.md")" && ok "read hook allows plugin files" || no "read hook allows plugin files"
[ -z "$(pre "$ROOT/../x/y")" ] && [ -z "$(pre /etc/hosts)" ] && ok "read hook defers outside paths" || no "read hook defers outside paths"
ln -s /etc/hosts "$TMP/link" && mkdir -p "$ROOT/.smoke" && ln -sf "$TMP/link" "$ROOT/.smoke/link"
[ -z "$(pre "$ROOT/.smoke/link")" ] && ok "read hook defers symlinks out" || no "read hook defers symlinks out"
rm -rf "$ROOT/.smoke"

for a in poteto-agent comment-sicko readonly; do
	grep -q "^name: $a$" "$ROOT/agents/$a.md" 2>/dev/null && ok "agent $a" || no "agent $a"
done
for f in "$ROOT"/agents/poteto-agent.md "$ROOT"/agents/comment-sicko.md "$ROOT"/skills/poteto-mode/SKILL.md; do
	grep -q 'CLAUDE-CODE.md' "$f" && ok "notes pointer in ${f#$ROOT/}" || no "notes pointer in ${f#$ROOT/}"
done
bad="$(for d in "$ROOT"/skills/*/; do n="$(basename "$d")"; grep -q "^name: $n$" "$d/SKILL.md" || echo "$n"; done)"
[ -z "$bad" ] && ok "skill names match directories" || no "skill names: $bad"

echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
