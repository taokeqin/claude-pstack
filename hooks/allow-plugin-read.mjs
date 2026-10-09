// pstack skills read their own playbooks, references, and CLAUDE-CODE.md from
// the plugin directory, which sits outside the project. Approve read-only tool
// calls whose target resolves inside the plugin root; defer everything else to
// the normal permission flow.
import * as fs from "node:fs";
import * as path from "node:path";

const root = fs.realpathSync(process.env.CLAUDE_PLUGIN_ROOT ?? path.resolve(import.meta.dirname, ".."));

let input = {};
try {
	input = JSON.parse(fs.readFileSync(0, "utf-8") || "{}");
} catch {
	process.exit(0);
}

const target = input.tool_input?.file_path ?? input.tool_input?.path;
if (typeof target !== "string" || !target) process.exit(0);

let resolved;
try {
	resolved = fs.realpathSync(path.resolve(input.cwd ?? process.cwd(), target));
} catch {
	process.exit(0);
}
if (resolved !== root && !resolved.startsWith(root + path.sep)) process.exit(0);

process.stdout.write(
	JSON.stringify({
		hookSpecificOutput: {
			hookEventName: "PreToolUse",
			permissionDecision: "allow",
			permissionDecisionReason: "pstack reads its own plugin files",
		},
	}),
);
