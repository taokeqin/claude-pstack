---
name: setup-pstack
description: Configure which Claude model pstack uses per role, for this project only. Proposes the claude-tiers preset (fable for the hardest tasks, opus for judgment, sonnet for code, haiku for exploration) and writes .pstack/models.md, which the pstack SessionStart hook injects. Use for /pstack:setup-pstack, "configure pstack models", or changing pstack's model choices.
---

# Setup pstack (Claude Code)

Write `.pstack/models.md` in the project root. The pstack SessionStart hook injects it into every new session, and skills read it directly when they pick a subagent model. It is project-local by design. Other projects are not affected.

Every role runs on Claude. The only valid values are `fable`, `opus`, `sonnet`, `haiku`, and `inherit-parent` (omit `model`, so the subagent runs on the session model). Never configure external models, CLIs, or other vendors' keys.

## Preset: claude-tiers

Stronger models use more of the subscription's usage. The strongest model goes only where it changes the outcome, code goes to the efficient model because pstack spawns many code delegates, and exploration goes to the fastest one.

```
feature, refactoring: sonnet
bug-fix: sonnet
perf-issue: sonnet
hillclimb: sonnet
judgment and prose: opus
hardest tasks: fable
how explorer: haiku
how explainer: opus
why investigators: haiku
why synthesizer: opus
reflect tooling: sonnet
reflect judgment, divergent, synthesizer: opus
arena runners: opus, sonnet, haiku
arena cross-judge pool: opus, sonnet, haiku
swarm workers: sonnet
architect runners: opus, sonnet, haiku
interrogate reviewers: opus, sonnet, haiku
```

## Steps

### 1. Load current state

If `.pstack/models.md` exists, read it and treat its values as the current choices. Otherwise start from the preset. A line whose role is not in the preset is from a retired role. Drop it.

### 2. Apply the user's request

When the request already names models or rules (for example "judgment on fable too" or "no fable"), apply them over the preset. The strongest model in the mapping should still go only to `hardest tasks` unless the user asks otherwise.

### 3. Show and confirm

Show a table of every role with its model. Note that panel roles (arena runners, architect runners, interrogate reviewers) run one subagent per entry, so the list length sets the count, and that a panel of Claude tiers gives a weaker cross-check than different vendors would. Ask with `AskUserQuestion` whether to accept as-is or change specific roles, offering `fable`, `opus`, `sonnet`, `haiku`, and `inherit-parent`. Without an interactive user, accept and say so.

Reasoning effort is not set per role. Subagents use the session effort (`/effort`) or the effort in their agent definition. Mention this once if the user asks for a budget.

### 4. Write the file

Write `.pstack/models.md` (create `.pstack/` if needed), overwriting the whole file so re-runs stay idempotent:

```
# pstack model configuration for this project. One line per role. Delete a line to fall back to the skill default.
# Values: fable, opus, sonnet, haiku, or inherit-parent (session model).
# preset: claude-tiers
<one line per role>
```

Never commit the file or run any git command that changes history. Ask once whether to add `.pstack/models.md` to `.gitignore`. Without an interactive user, leave `.gitignore` alone and mention the choice in the reply.

### 5. Confirm

Tell the user the file was written. Skills read it from the next subagent spawn; the hook injects it into new sessions (or after `/clear`). Re-running this skill updates it. Deleting it restores the skill defaults.

### 6. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /pstack:create-verification-skill." On yes, run that skill. On no, move on without pushing.
