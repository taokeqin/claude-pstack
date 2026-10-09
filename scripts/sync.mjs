#!/usr/bin/env node
// Regenerates skills/ and agents/ from an upstream pstack checkout for Claude Code.
// Usage: node scripts/sync.mjs [path/to/plugins/pstack]
// Source: the argument, else $PSTACK_SRC, else a shallow clone of
// https://github.com/cursor/plugins in the OS temp dir.
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UPSTREAM = "https://github.com/cursor/plugins.git";

function upstreamCheckout() {
	const dir = path.join(os.tmpdir(), "pstack-upstream");
	if (fs.existsSync(path.join(dir, ".git"))) {
		execFileSync("git", ["-C", dir, "pull", "--ff-only", "--quiet"], { stdio: "inherit" });
	} else {
		execFileSync("git", ["clone", "--depth", "1", "--quiet", UPSTREAM, dir], { stdio: "inherit" });
	}
	return path.join(dir, "pstack");
}

const src = path.resolve(process.argv[2] ?? process.env.PSTACK_SRC ?? upstreamCheckout());
if (!fs.existsSync(path.join(src, "skills", "poteto-mode", "SKILL.md"))) {
	console.error(`not a pstack checkout: ${src}`);
	process.exit(1);
}

// Agent names must be lowercase-hyphen in Claude Code; plugin agents are
// addressed as `pstack:<name>`.
const AGENT_RENAMES = { "Comment Sicko": "comment-sicko" };

// Ordered: specific strings before the generic prefixes they contain.
const REPLACEMENTS = [
	["~/.cursor/rules/pstack-models.mdc", ".pstack/models.md"],
	["the `pstack-models.mdc` rule", "`.pstack/models.md`"],
	[/(?<![\w./-])pstack-models\.mdc/g, ".pstack/models.md"],
	[
		"Transcripts live at `~/.cursor/projects/<slug>/agent-transcripts/<uuid>/<uuid>.jsonl`, where `<slug>` is the workspace path with the leading slash dropped and each \"/\" turned into \"-\" (so `/Users/you/proj` becomes `Users-you-proj`). Every line is one chat message.",
		"Transcripts live at `~/.claude/projects/<slug>/<session-uuid>.jsonl`, where `<slug>` is the workspace path with each \"/\" and \".\" turned into \"-\" (so `/Users/you/proj` becomes `-Users-you-proj`). Every line is one transcript entry.",
	],
	["~/.cursor/projects/*/", "~/.claude/projects/*/"],
	["~/.cursor/projects/", "~/.claude/projects/"],
	["~/.cursor/skills/", "~/.claude/skills/"],
	["~/.cursor/plugins/", "~/.claude/plugins/"],
	[".cursor/skills/", ".claude/skills/"],
	["`AskQuestion`", "`AskUserQuestion`"],
	[/\bAskQuestion\b/g, "AskUserQuestion"],
	['subagent_type: "Comment Sicko"', 'subagent_type: "pstack:comment-sicko"'],
	['subagent_type: "poteto-agent"', 'subagent_type: "pstack:poteto-agent"'],
	["Cursor's built-in `create-skill` skill", "the `skill-creator` skill (if installed; else the **authoring-a-skill** playbook)"],
	["Cursor's built-in `create-skill`", "the `skill-creator` skill (if installed; else the **authoring-a-skill** playbook)"],
	["Cursor's `/loop` command", "Claude Code's `/loop` command"],
	// A read-only generalPurpose spawn becomes the plugin's read-only agent.
	[/- `subagent_type`: `generalPurpose`\n((?:- (?!`readonly`).*\n)*?)- `readonly`: `true`\n/g, "- `subagent_type`: `pstack:readonly`\n$1"],
	["generalPurpose", "general-purpose"],
	// Cursor model slugs become Claude Code aliases (judgment → opus, code and second opinions → sonnet).
	[/claude-opus-5-5-(?:max|medium)/g, "opus"],
	[/grok-4\.7-(?:xhigh|medium)-fast/g, "sonnet"],
	["gpt-5.6-sol-max", "sonnet"],
];

// Subagents do not receive the SessionStart context, so every pstack agent and
// the mode skill point at the adaptation notes directly.
const NOTES_POINTER =
	"\n\n## Claude Code\n\nBefore any work, read `${CLAUDE_PLUGIN_ROOT}/CLAUDE-CODE.md` for how this pstack maps Cursor tools to Claude Code.\n";

function transform(text) {
	for (const [from, to] of REPLACEMENTS) text = typeof from === "string" ? text.split(from).join(to) : text.replace(from, to);
	return text;
}

function editFrontmatter(text, edit) {
	const m = text.match(/^---\n([\s\S]*?)\n---\n/);
	if (!m) return text;
	return `---\n${edit(m[1].split("\n")).join("\n")}\n---\n${text.slice(m[0].length)}`;
}

function walk(dir, fn) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, fn);
		else fn(p);
	}
}

for (const dir of ["skills", "agents"]) {
	fs.rmSync(path.join(root, dir), { recursive: true, force: true });
	fs.cpSync(path.join(src, dir), path.join(root, dir), {
		recursive: true,
		filter: (p) => !p.includes(`${path.sep}node_modules`),
	});
	walk(path.join(root, dir), (p) => {
		if (p.endsWith(".md")) fs.writeFileSync(p, transform(fs.readFileSync(p, "utf-8")));
	});
}

// Skill `name` must match its directory (it becomes /pstack:<name>). Drop
// Cursor-only frontmatter keys Claude Code would ignore or misread.
const CURSOR_SKILL_KEYS = ["mode:", "icon:", "color:", "reminder:"];
for (const name of fs.readdirSync(path.join(root, "skills"))) {
	const file = path.join(root, "skills", name, "SKILL.md");
	if (!fs.existsSync(file)) continue;
	fs.writeFileSync(
		file,
		editFrontmatter(fs.readFileSync(file, "utf-8"), (lines) =>
			lines
				.filter((l) => !CURSOR_SKILL_KEYS.some((k) => l.startsWith(k)))
				.map((l) => (l.startsWith("name:") ? `name: ${name}` : l)),
		),
	);
}

for (const file of fs.readdirSync(path.join(root, "agents"))) {
	const p = path.join(root, "agents", file);
	fs.writeFileSync(
		p,
		editFrontmatter(fs.readFileSync(p, "utf-8"), (lines) =>
			lines
				.filter((l) => !l.startsWith("is_background:"))
				.map((l) => {
					const m = l.match(/^name:\s*(.+)$/);
					return m && AGENT_RENAMES[m[1].trim()] ? `name: ${AGENT_RENAMES[m[1].trim()]}` : l;
				}),
		),
	);
}

const overrides = path.join(root, "overrides");
if (fs.existsSync(overrides)) fs.cpSync(overrides, root, { recursive: true });

for (const p of [
	...fs.readdirSync(path.join(root, "agents")).map((f) => path.join(root, "agents", f)),
	path.join(root, "skills", "poteto-mode", "SKILL.md"),
]) {
	const text = fs.readFileSync(p, "utf-8");
	if (!text.includes("CLAUDE-CODE.md")) fs.writeFileSync(p, text.trimEnd() + NOTES_POINTER);
}

function grepLeft(pattern) {
	try {
		return execFileSync("grep", ["-rlnE", "--include=*.md", pattern, "skills", "agents"], { cwd: root, encoding: "utf-8" });
	} catch {
		return "";
	}
}
const rev = (() => {
	try {
		return execFileSync("git", ["-C", src, "rev-parse", "--short", "HEAD"], { encoding: "utf-8" }).trim();
	} catch {
		return "unknown";
	}
})();
const version = JSON.parse(fs.readFileSync(path.join(src, ".cursor-plugin", "plugin.json"), "utf-8")).version;
fs.writeFileSync(path.join(root, "UPSTREAM.json"), `${JSON.stringify({ pstack: version, commit: rev }, null, "\t")}\n`);
console.log(`synced pstack ${version} (${rev}) from ${src}`);
const left = grepLeft("\\.cursor/|AskQuestion");
if (left) console.log(`files still mentioning .cursor/ or AskQuestion:\n${left}`);
