# claude-pstack

把 [pstack](https://github.com/cursor/plugins/tree/main/pstack)（poteto 的严谨 agent 工作流）移植成 Claude Code 插件。只用 Claude 模型（fable / opus / sonnet / haiku），不调用任何外部模型或 CLI。

## 前置条件

- [Claude Code](https://code.claude.com)（在 2.1.289 上测试过）
- Node.js 18 或更高版本，插件的 hook 是 Node 脚本

## 安装 / 试用 / 卸载

在要启用 pstack 的项目根目录执行：

```bash
# 只在当前项目启用（写入 .claude/settings.local.json，默认被 gitignore，不会提交）
claude plugin marketplace add taokeqin/claude-pstack --scope local
claude plugin install pstack@claude-pstack --scope local

# 更新到 GitHub 上的最新版本
claude plugin marketplace update claude-pstack

# 从当前项目卸载
claude plugin uninstall pstack@claude-pstack --scope local
claude plugin marketplace remove claude-pstack --scope local
```

用 local scope 安装时，其他项目的 `claude plugin list` 里会显示 pstack，但状态是 disabled，不会加载。

想改代码，或者只想在一次会话里试用，可以 clone 到任意目录，然后用本地路径：

```bash
git clone https://github.com/taokeqin/claude-pstack.git <任意目录>

# 只试一次：仅这次会话加载，不写任何配置
claude --plugin-dir <任意目录>

# 或者从本地目录安装到当前项目（Claude Code 会保存成绝对路径）
claude plugin marketplace add <任意目录> --scope local
claude plugin install pstack@claude-pstack --scope local
```

**同一台机器上，GitHub 和本地目录两种来源只能选一种。** marketplace 名字 `claude-pstack` 是全局共享的：再用另一种来源添加，会替换掉所有项目共用的来源；移除时也会把这条全局登记一起删掉，导致其他项目里的 pstack 失效。要切换来源，先在所有启用了 pstack 的项目里卸载，再用新来源重新安装。

## 开始用

1. `/pstack:setup-pstack`：写入 `.pstack/models.md`，默认使用 `claude-tiers` 方案，可以按角色修改。
2. `/pstack:poteto-mode <任务>`：主入口，会自动选择 playbook。

`claude-tiers` 方案：

| 角色 | 模型 |
|---|---|
| hardest tasks | `fable` |
| 判断和写作（judgment、how/why 的综合、reflect 的评审） | `opus` |
| 写代码（feature、bug-fix、perf、refactoring、swarm） | `sonnet` |
| 调查（how explorer、why investigators） | `haiku` |
| 评审组（arena、architect、interrogate） | `opus, sonnet, haiku` |

推理强度不按角色设置，跟随会话的 `/effort`。改了 `.pstack/models.md` 之后，`/clear` 或开一个新会话，新的配置才会注入。

如果不想把模型配置提交到项目仓库，把 `.pstack/` 加进项目的 `.gitignore`。

## 和 Cursor 版的差异

转换后的 skill 正文基本保持原样，差异由下面几处补上：

- `CLAUDE-CODE.md`：把 Cursor 的工具和功能逐项映射到 Claude Code，例如 `Task` 对应 `Agent`，`readonly` 对应 `pstack:readonly`，`environment: "cloud"` 对应 `isolation: "worktree"`，`AskQuestion` 对应 `AskUserQuestion`。主会话通过 SessionStart hook 注入这份说明；pstack 的 agent 和 poteto-mode 会自己读取。
- `hooks/session-start.mjs`：把说明、`.pstack/models.md` 和当前 transcript 的路径注入新会话。
- `hooks/allow-plugin-read.mjs`：自动放行对插件目录内文件的 Read、Glob、Grep，因为 skill 需要读取自己的 playbook。插件目录外的路径和指向外部的符号链接，仍然走正常的权限流程。
- `agents/readonly.md`：禁用编辑类工具的通用 agent，对应 Cursor 的 `readonly: true`。
- 配置文件放在 `.pstack/models.md`，而不是 `.claude/` 下。Claude Code 把 `.claude/` 当作敏感目录，每次写入都要确认。

## 跟进上游

```bash
node scripts/sync.mjs                        # 自动浅克隆 github.com/cursor/plugins 到系统临时目录
node scripts/sync.mjs <plugins 仓库>/pstack   # 或者指定本地已有的 checkout
PSTACK_SRC=<plugins 仓库>/pstack node scripts/sync.mjs

test/smoke.sh                                # 离线检查：不调用模型，不消耗额度
```

`sync.mjs` 会重新生成 `skills/` 和 `agents/`，然后叠加 `overrides/`（`setup-pstack` 和 `readonly` agent）。上游版本记录在 `UPSTREAM.json`。

## 许可

pstack 原作者 Lauren Tan，MIT 许可，见 `LICENSE-pstack`。
