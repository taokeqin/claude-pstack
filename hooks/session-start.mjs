// Injects the Claude Code adaptation notes and the project's model roles,
// the way Cursor injects an always-applied rule.
import * as fs from "node:fs";
import * as path from "node:path";

const root = process.env.CLAUDE_PLUGIN_ROOT ?? path.resolve(import.meta.dirname, "..");
let input = {};
try {
	input = JSON.parse(fs.readFileSync(0, "utf-8") || "{}");
} catch {}
const cwd = input.cwd ?? process.cwd();
const read = (p) => {
	try {
		return fs.readFileSync(p, "utf-8").trim();
	} catch {
		return undefined;
	}
};

const models = read(path.join(cwd, ".pstack", "models.md"));
const parts = [
	read(path.join(root, "CLAUDE-CODE.md")) ?? "",
	models
		? `<pstack_models file=".pstack/models.md">\n${models}\n</pstack_models>`
		: "No .pstack/models.md in this project: map roles with the defaults above, or run /pstack:setup-pstack.",
];
if (input.transcript_path) parts.push(`Current transcript: ${input.transcript_path}`);

process.stdout.write(
	JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: parts.join("\n\n") } }),
);
