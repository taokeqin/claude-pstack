# pstack on Claude Code

You are running pstack on Claude Code, not Cursor. pstack's skills were written for Cursor's tools. Apply this mapping wherever a skill names a Cursor tool or behavior.

## Subagents

- A Cursor `Task` call is the `Agent` tool. Several `Agent` calls in one message run in parallel.
- `subagent_type`: `generalPurpose` is `general-purpose`. pstack's own agents are `pstack:poteto-agent`, `pstack:comment-sicko`, and `pstack:readonly`.
- `readonly: true` means `subagent_type: pstack:readonly` (a general agent with edit tools disabled). `readonly: false` or "agent mode" means `general-purpose`, or the named agent.
- `model` takes only `fable`, `opus`, `sonnet`, or `haiku`. Take each role's value from `.pstack/models.md` when present. Otherwise map a Cursor slug by role: `claude-opus-*` → `opus`, `grok-*` and `gpt-*` → `sonnet`. `inherit-parent` or `auto` means omit `model`. Reasoning effort cannot be set per call; subagents use the session effort or their agent definition.
- `run_in_background: true` is the default behavior: subagents run in the background and you are notified when each finishes. Do not poll.
- Resuming a subagent means `SendMessage` to its id or name. Fresh subagents remain the default, per poteto-mode.
- `environment: "cloud"` is unsupported. For parallel writers use `isolation: "worktree"` instead.
- Every subagent runs on Claude. Never route work to external model CLIs or APIs (for example `pi`, or another vendor's key) to fill a reviewer seat. Panels that name other families use different Claude models instead, and their cross-model check is weaker; say so when it matters.

## Tools and built-ins

- `AskQuestion` is `AskUserQuestion`.
- Skills are namespaced: "the **how** skill" is `pstack:how` via the `Skill` tool, `/poteto-mode` is `/pstack:poteto-mode`.
- Cursor's `/loop` and Plan Mode exist here (`/loop`, `/schedule`, plan mode). Cursor automations map to `/schedule` or `/loop`.
- Cursor's built-in `create-skill` is the `skill-creator` skill when installed; otherwise follow the authoring-a-skill playbook.
- Cursor's built-in babysit skill does not exist; use pstack's Babysit playbook.
- `/deslop` (from Cursor's cursor-team-kit) is not installed and needs no search. Review the diff for slop yourself and run the `pstack:no-comments` skill.
- Cursor has a todolist tool; here use `TodoWrite` if available, else keep the playbook checklist in your messages.

## Files

- Model roles: `.pstack/models.md` in the project root. `pstack:setup-pstack` writes it.
- "agent-transcripts" means Claude Code transcripts: `~/.claude/projects/<slug>/<session-uuid>.jsonl`, where `<slug>` is the workspace path with `/` and `.` turned into `-`. Subagent transcripts sit next to the parent's under `<session-uuid>/subagents/`.
