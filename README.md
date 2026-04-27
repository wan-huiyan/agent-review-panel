[![GitHub release](https://img.shields.io/github/v/release/wan-huiyan/agent-review-panel)](https://github.com/wan-huiyan/agent-review-panel/releases) [![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-orange)](https://claude.com/claude-code) [![license](https://img.shields.io/github/license/wan-huiyan/agent-review-panel)](LICENSE) [![last commit](https://img.shields.io/github/last-commit/wan-huiyan/agent-review-panel)](https://github.com/wan-huiyan/agent-review-panel/commits)
[![Tests](https://github.com/wan-huiyan/agent-review-panel/actions/workflows/test.yml/badge.svg)](https://github.com/wan-huiyan/agent-review-panel/actions/workflows/test.yml)
[![Research Papers](https://img.shields.io/badge/research%20foundations-9%20papers-orange)](#research-foundations)

# Agent Review Panel

**4–6 AI reviewers independently evaluate your code, plan, or docs, then debate each other's findings. A judge resolves disagreements. You get three artifacts: a Markdown report (`review_panel_report.md`), a verbatim process log (`review_panel_process.md`), and an interactive HTML dashboard (`review_panel_report.html`).**

A [Claude Code](https://claude.ai/code) **plugin** that orchestrates multi-agent adversarial review panels backed by [9 research papers](#research-foundations) on multi-agent debate.

> Packaged as a Claude Code plugin (`roundtable`) that bundles **two skills**: `agent-review-panel` (the panel itself) and `plan-review-integrator` (applies findings back into a plan). One install gets you both; details under [Bundled skills](#bundled-skills).
>
> **Runs only on Claude Code surfaces** — CLI, IDE extension, or the **Code tab inside the Claude Desktop app**. Does not work with claude.ai web chat or the Anthropic API direct ([why](#requires-claude-code)).

[![Agent Review Panel — pipeline architecture](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/v3.1.0/docs/hero-flow.svg)](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/v3.1.0/docs/hero-flow.svg)

[![Agent Review Panel — terminal demo](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/v3.1.0/docs/demo.gif)](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/v3.1.0/docs/demo.gif)

[![Agent Review Panel — interactive HTML dashboard with expandable issue cards](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/v3.1.0/docs/html-demo.gif)](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/v3.1.0/docs/html-demo.gif)

*The HTML report: expandable 10-section issue cards (narrative, code evidence with Prism.js syntax highlighting, debate transcripts, judge rulings, fix recommendations, cross-references), deep-linkable, keyboard-navigable, print-friendly.*

## Contents

- [Quick Start](#quick-start) — install + first-run verification
- [Installation](#installation) — supported surfaces, marketplace, manual clone
- [How It Works](#how-it-works) — the 16-phase pipeline
- [Features](#features) — review process, verification layer, anti-groupthink, advanced
- [Usage Examples](#usage-examples) and [Configuration / Modes](#configuration--modes)
- [Cost & Performance](#cost--performance) and [Known Limitations](#known-limitations)
- [Migration](#migration-from-previous-marketplaces) and [Troubleshooting](#troubleshooting)
- [Reading the Report](#reading-the-report) — vocabulary, severity rubric, epistemic labels

<a id="quick-start"></a>
## Quick Start

**In your terminal** (bash/zsh):

```bash
claude plugin marketplace add wan-huiyan/agent-review-panel
claude plugin install roundtable@agent-review-panel
```

Then restart your Claude Code session — skills load at session start.

**After install — verify it loaded.** In a fresh Claude Code session, type `/roundtable:agent-review-panel` (with no target). The skill should respond by introducing itself and asking what to review. If you get `unknown command` instead, the skills didn't load — see [Troubleshooting → After install, slash command not recognized](#after-install-roundtableagent-review-panel-is-not-recognized).

<details>
<summary>Already inside a Claude Code session? Use the slash-command form instead</summary>

Type these at the REPL prompt (note the leading `/` and no `claude` prefix):

```
/plugin marketplace add wan-huiyan/agent-review-panel
/plugin install roundtable@agent-review-panel
```

Both forms do the same thing. Pick whichever matches where you are: shell-form `claude plugin …` for terminal, REPL-form `/plugin …` for inside Claude Code.
</details>

<a id="upgrading-from-v2x"></a>
<details>
<summary><strong>Upgrading from v2.x?</strong> Have Claude Code do the cleanup + install for you (recommended)</summary>

If you already installed under an older marketplace name (`@wan-huiyan-agent-review-panel`, `@agent-review-panel` pre-v2.16.1, or the bare `plugin` name pre-v2.16) you may have stale state that silently shadows the new install. The fastest fix is to paste the prompt below into any Claude Code session and let Claude do the cleanup, install, and verification:

> Install the `agent-review-panel` plugin from `wan-huiyan/agent-review-panel`. Before installing:
> 1. Check `~/.claude/plugins/known_marketplaces.json` for any cached registration of this repo under an old name (`plugin`, `wan-huiyan-agent-review-panel`) — if found, `claude plugin marketplace remove <old-name>` first.
> 2. Check `~/.claude/plugins/marketplaces/` for orphan directories with trailing whitespace.
> 3. Check `~/.claude/skills/` for loose-clone shadows of `agent-review-panel`, `agent-review-panel-workspace`, `plan-review-integrator`, or `roundtable` — back up to `*.bak.<timestamp>` then remove.
> 4. Then run `claude plugin marketplace add wan-huiyan/agent-review-panel` and `claude plugin install roundtable@agent-review-panel`.
> 5. Verify the install by listing `~/.claude/plugins/cache/agent-review-panel/roundtable/*/skills/` and confirming both `agent-review-panel/SKILL.md` and `plan-review-integrator/SKILL.md` are present.
> 6. Remind me to restart my Claude Code session.
> Report each step's outcome.

Claude will ask you to confirm any destructive `rm` actions before running them. Manual equivalent is in [Migration](#migration-from-previous-marketplaces).
</details>

> The `roundtable` plugin bundles **two skills**: `agent-review-panel` (the review panel) and `plan-review-integrator` (the review→integrate companion). One install gets you both. See [Bundled skills](#bundled-skills) below. Upgrading from v2.x? See [Migration](#migration-from-previous-marketplaces).

**Use:**
```
> Review this implementation plan from multiple perspectives: docs/my_plan.md

> /roundtable:agent-review-panel
```

> ⚠️ Slash commands are `/<plugin>:<skill>` — `/roundtable:agent-review-panel` and `/roundtable:plan-review-integrator`. Natural-language invocation also works (the skill's description triggers it), so use whichever feels natural.

**What you get:** Three output files:
- `review_panel_report.md` — executive summary, consensus, disagreements (with judge rulings), prioritized action items tagged with epistemic labels
- `review_panel_process.md` — full "director's cut" log of every agent's verbatim output with persona profiles
- `review_panel_report.html` — interactive dashboard with **expandable 10-section issue cards** (Narrative, Code Evidence, Debate, Judge Ruling, Fix Recommendation, and more — new in v2.15), filterable issue cards, charts, and a Panel Gallery

_See the [demo GIFs](#agent-review-panel) at the top of this README for what the markdown report and HTML dashboard look like._

## Installation

### Requires Claude Code

This plugin **only works on Claude Code surfaces** — or on the **[Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/plugins)** — because it needs the `Agent` tool for subagent spawning, local-filesystem access for output files, and a plugin-loader. Supported surfaces:

**Works ✅**
- ✅ **CLI** — `claude` command in your terminal
- ✅ **VS Code extension** — Claude Code extension from the VS Code marketplace
- ✅ **JetBrains IDE extension** — IntelliJ, PyCharm, WebStorm, GoLand, Rider, etc.
- ✅ **Claude Desktop app → Code tab** — the Desktop app bundles a Claude Code surface in its dedicated "Code" tab; the plugin installs and runs there the same way it does in the CLI. ([official docs](https://code.claude.com/docs/en/desktop))
- ✅ **Claude Agent SDK** — programmatic agent-building library on top of the Anthropic API. Load this plugin with `options.plugins: [{ type: "local", path: "./agent-review-panel" }]` in TypeScript or Python; subagents, skills, slash commands, and filesystem tools all work. See [Plugins in the SDK](https://code.claude.com/docs/en/agent-sdk/plugins).

**Does not work ❌**
- ❌ **Claude Desktop app → regular chat tabs** — the chat surface has no `/plugin` marketplace; and although [Agent Skills](https://www.anthropic.com/news/skills) can run there, this plugin's 4–6 parallel reviewers plus three local-file outputs need Claude Code's subagent + filesystem infrastructure. Use the Code tab instead.
- ❌ **claude.ai web chat** — same reason: no `/plugin` marketplace, and Skills on the web surface can't spawn the parallel subagents or write the `review_panel_*.md`/`.html` files the plugin produces.
- ❌ **Anthropic Messages API called directly (without the Agent SDK)** — the raw API is a prompt→response interface; it has no plugin loader, no subagent orchestration, and no filesystem. If you want to run the plugin against the API, use the **Claude Agent SDK** entry above.

**Why:** the panel spawns 4–6 reviewer subagents in parallel via Claude Code's `Agent` tool, reads/writes files on your local filesystem to generate the three output reports, and responds to the `/roundtable:agent-review-panel` slash command (or any natural-language "review panel" request). Only Claude Code surfaces expose those capabilities.

Don't have Claude Code yet? Install it from **[claude.ai/code](https://claude.ai/code)**, then come back and run the [Quick Start](#quick-start) commands above.

### Claude Code marketplace (recommended)

Install commands are in [Quick Start](#quick-start) above. Claude Code caches the plugin, loads its skills, and activates trigger phrases automatically. Two things worth knowing about the install handle:

<!-- release-check:marketplace-name-callout — load-bearing for scripts/release-check.sh; do not delete without updating both -->
> **Command format:** `@<marketplace-name>`, not `@<repo-name>`. The marketplace name is `agent-review-panel` (defined in `.claude-plugin/marketplace.json`); the plugin install name inside it is `roundtable`. Hence `roundtable@agent-review-panel`. Pre-v2.16.1 releases used `@wan-huiyan-agent-review-panel`; pre-v2.16 used `@agent-review-panel`. If you installed under an older marketplace name, see [Migration](#migration-from-previous-marketplaces).
<!-- /release-check:marketplace-name-callout -->

**Why the marketplace path?** The repo ships `.claude-plugin/marketplace.json` + `.claude-plugin/plugin.json` manifests (v3.0+ single-plugin layout) that Claude Code reads to register the plugin — the marketplace install handles caching, version tracking, and activation in one step. [Manual clone](#manual-clone-development--custom-setup) works but bypasses the manifests.

### Updating to the latest version

New releases land on `main`; Claude Code does not auto-pull. Run the update flow after each release (or any time you want the newest features) **in your terminal**:

```bash
claude plugin marketplace update agent-review-panel
claude plugin update roundtable@agent-review-panel
```

<details>
<summary>Or, if you're already in a Claude Code session, use the slash-command form</summary>

```
/plugin marketplace update agent-review-panel
/plugin update roundtable@agent-review-panel
```

</details>

**Verify the update worked:**
```bash
ls ~/.claude/plugins/cache/agent-review-panel/roundtable/
```
The directory name is the installed version (e.g. `3.1.0`). It should match the [latest GitHub release](https://github.com/wan-huiyan/agent-review-panel/releases/latest). If you have the [GitHub CLI](https://cli.github.com/), `gh release view --repo wan-huiyan/agent-review-panel` is the most direct check.

(Cache layout is `cache/<marketplace-name>/<plugin-name>/<version>/` — the `plugins/` intermediate directory from the repo is flattened out during install, and a version segment is added.)

**If the update appears to work but you're still getting old behavior** (e.g. missing the HTML report, missing expandable cards, or missing the data-flow trace phase), check for a **stale local clone** that shadows the marketplace install:

```bash
ls ~/.claude/skills/agent-review-panel 2>/dev/null
```

If that directory exists, it's loaded *before* the marketplace cache and pins you to whatever version was cloned. Back it up first (irreversible if you delete it outright with local edits inside), then remove the original:

```bash
mv "$HOME/.claude/skills/agent-review-panel" "$HOME/.claude/skills/agent-review-panel.bak.$(date +%s)"
```

Then restart Claude Code. The marketplace install in `~/.claude/plugins/cache/agent-review-panel/` will take over. Delete the `.bak.*` directory once the marketplace version is confirmed working.

**Fallback — clean reinstall:** If the update commands misbehave, uninstall and reinstall from scratch. From your terminal:

```bash
claude plugin uninstall roundtable@agent-review-panel
claude plugin marketplace remove agent-review-panel
claude plugin marketplace add wan-huiyan/agent-review-panel
claude plugin install roundtable@agent-review-panel
```

<details>
<summary>REPL-form equivalent (inside a Claude Code session)</summary>

```
/plugin uninstall roundtable@agent-review-panel
/plugin marketplace remove agent-review-panel
/plugin marketplace add wan-huiyan/agent-review-panel
/plugin install roundtable@agent-review-panel
```

</details>

<a id="manual-clone-development--custom-setup"></a>
### Manual clone (development / custom setup)

For local development, forking, or air-gapped environments. **Do NOT clone into `~/.claude/skills/`** — that path shadows marketplace installs and is the destructive-cleanup target in [Updating](#updating-to-the-latest-version) above. Use a separate workspace path instead:

```bash
git clone https://github.com/wan-huiyan/agent-review-panel.git ~/projects/agent-review-panel-dev
```

Then load the cloned repo as a local plugin for testing without committing to a marketplace install:

```bash
claude --plugin-dir ~/projects/agent-review-panel-dev
```

### Claude Code version requirement

**Claude Code v1.0+** — the plugin uses the `Agent` tool for parallel subagent spawning. Reviewer model selection is documented under [How It Works](#how-it-works).

### Cursor (experimental)

<details>
<summary>Cursor installation options</summary>

> **Confidence: untested by maintainers.** Community PRs welcome — see [Contributing](#contributing). The recipes below are starting points, not verified flows.

This skill was built for Claude Code's Agent tool (parallel subagent spawning, model selection). Cursor has its own mechanisms that may require adaptation.

**Per-project rule (most reliable):**
```bash
mkdir -p .cursor/rules
# Create .cursor/rules/agent-review-panel.mdc with the content of SKILL.md
# Add frontmatter: alwaysApply: true
```

**Manual global install:**
```bash
git clone https://github.com/wan-huiyan/agent-review-panel.git ~/.cursor/skills/agent-review-panel
```

The core pattern is straightforward — one subagent/task per reviewer in Phase 3, collect results, then one per reviewer in Phase 5 (debate), then single agents for verification and judge. If you adapt it, PRs are welcome.

</details>

## Why Use a Panel Instead of a Single Reviewer?

When you ask Claude to "review this code," you get one perspective. It won't argue with itself, catch its own blind spots, or tell you "I'm not sure about this."

The panel spawns independent reviewers that genuinely engage:

> **Feasibility Analyst:** "The `data_available_through` hardcoding is minor — it's documented."
>
> **Risk Assessor:** "Disagree. If stale, the lookforward extends past actual data — model trains on incomplete outcomes — silent false-negative bias."
>
> **Feasibility Analyst (Round 2):** "Valid point. I upgrade this to IMPORTANT."

A single reviewer gives you a list. The panel gives you a deliberation — with structured disagreements, judge rulings, and confidence levels.

## How It Works

16 phases + optional multi-run merge. Phase numbers are sequential integers (v2.14 cleanup — old decimal numbering like Phase 4.55 retired).

| Stage | Phase | Action |
|---|---|---|
| **Gather** | 1. | Setup — scan sibling dirs, trace references, discover safeguards, detect signals, select personas |
| | 2. | **Data Flow Trace** *(v2.14, code only)* — trace critical path(s), document schemas at each function boundary, flag composition/seam bugs |
| **Review** | 3. | Independent Review — 4-6 reviewers evaluate in parallel (no cross-talk) |
| | 4. | Private Reflection — each reviewer re-reads and rates own confidence |
| **Debate** | 5. | Adversarial Debate (1-3 rounds) — reviewers engage + find new issues |
| | 6. | Round Summarization — distill resolved/unresolved points between rounds |
| | 7. | Blind Final — each reviewer gives final score independently |
| **Verify** | 8. | Completeness Audit — dedicated agent scans for what the panel missed |
| | 9. | Verify Commands — run reviewer grep/read commands for P0/P1 findings (advisory) |
| | 10. | Claim Verification — verify all line-number citations against source |
| | 11. | Severity Verification — read actual code for every P0/P1; downgrade if overstated; **web-verify external domain claims** *(v2.16.3)* |
| | 12. | Tier Assignment — confidence-based draft → judge-advised refinement per dispute |
| | 13. | Targeted Verification — persona-matched agents investigate each dispute point |
| **Adjudicate** | 14. | Supreme Judge — Opus arbitrates everything including verification round evidence |
| **Output** | 15. | Triple output: Primary Report (`.md`) + Process History (`.md`) + **Expandable-card Dashboard (`.html`)** *(v2.15)* |
| **Merge** | 16. | **Multi-Run Merge** *(v2.14, optional)* — deduplicate findings across runs, score stability, resolve judge divergence |

## Features

**Review process:**
- 4-6 reviewers with distinct personas evaluate in parallel, then debate across 1-3 rounds
- Auto-selects personas based on content type (code, plan, docs, mixed) and technology signals across 10 signal groups (SQL, ML, Terraform, Auth, API, Frontend, Cost, Pipeline, Portability, Repo Hygiene)
- Each reviewer uses a different reasoning strategy (systematic enumeration, adversarial simulation, backward reasoning, etc.)
- Auto Precise/Exhaustive mode: code requires line citations; plans allow broader risk identification

**Verification layer:**
- Claim verification checks all reviewer citations against actual source code
- Severity verification reads the codebase to confirm P0/P1 findings before the judge sees them. **External domain claims** (product limits, regulatory jurisdiction, API behavior) are automatically web-searched and tagged `[WEB-VERIFIED]`, `[WEB-CONTRADICTED]`, or `[WEB-INCONCLUSIVE]`
- Verification commands: runs read-only grep/cat commands from reviewers to confirm or contradict claims
- Defect classification: findings labeled [EXISTING_DEFECT] or [PLAN_RISK] — P0 requires existing defect evidence
- Completeness audit: post-debate agent re-reads source line-by-line for what everyone missed
- **Targeted verification round:** each unresolved dispute gets a tiered (Light ~2k / Standard ~8k / Deep ~32k tokens) verification agent matched to the claim type (statistician for stats claims, security auditor for security claims, etc.) — verdicts feed directly into the judge's rulings
- **Data Flow Trace:** a dedicated agent traces data through critical paths before reviewers begin, flagging composition/seam bugs (two individually-correct functions producing incorrect results together). Three tiers: Standard (default, single path), Thorough (top 3 paths + transform-completeness checks), Exhaustive (all paths, no token limit). Uses Meta's semi-formal certificate prompting. Skipped for pure docs/plans or code with no data transforms.
- **Force opus on all launches:** every `subagent_type` launch — including VoltAgent specialist agents — passes `model: "opus"` explicitly. Fixes an invisible source of cross-run variance where VoltAgent agents silently fell through to their frontmatter-declared default model (potentially sonnet or haiku), producing different reasoning depths across otherwise identical runs.

**Anti-groupthink safeguards:**
- Blind final scoring, private reflection, calibrated skepticism levels (20-60%)
- Sycophancy detection intervenes when >50% of position changes lack new evidence
- Anti-rhetoric assessment flags position changes driven by eloquence rather than evidence
- Judge confidence gating: low-confidence verdicts flag "HUMAN REVIEW RECOMMENDED"
- Correlated-bias warning when all reviewers converge (unanimous agreement is the most dangerous failure mode)

**Output (three files per review):**
- **Primary report** (`review_panel_report.md`): executive summary, consensus, disagreements (with judge rulings), prioritized action items with epistemic labels ([VERIFIED], [CONSENSUS], [SINGLE-SOURCE], [UNVERIFIED], [DISPUTED], [WEB-VERIFIED], [WEB-CONTRADICTED], [WEB-INCONCLUSIVE])
- **Process history** (`review_panel_process.md`): verbatim "director's cut" of every agent's output with persona profiles at each entry point — full transparency into the panel's reasoning
- **Interactive HTML dashboard** (`review_panel_report.html`) with expandable 10-section issue cards. Each card opens a nested accordion:
  - 📖 **Narrative** — full reviewer reasoning
  - 📄 **Code Evidence** — Prism.js-highlighted snippets with `file:line` headers
  - 👥 **Raised by** — per-reviewer rating and reasoning
  - 🔍 **Verification Trail** — full output of the verification-round agent
  - 💬 **Debate** — round-by-round transcript
  - ⚖️ **Judge Ruling**
  - 🛠️ **Fix Recommendation** — proposed change, before/after code, regression test, blast radius, effort
  - 🔗 **Cross-references**
  - 🏷️ **Epistemic Tags** — with hover tooltips
  - 📊 **Prior Runs**

  Plus deep-link support (`report.html#issue-A1`), keyboard navigation, expand-all / collapse-all controls, and print-friendly `@media print` CSS. Dashboard also includes a filterable/sortable issue list, Panel Gallery with avatar cards for every agent, and confidence/tier/verdict charts (Tailwind CSS + Chart.js + Prism.js via CDN).
- Scope & limitations disclosure — every report states what the panel cannot evaluate

**Advanced:**
- VoltAgent integration — maps personas to 127+ specialist agents for deeper domain-specific reviews when installed
- **Multi-Run Union Protocol** — invoke `--runs N` or "run 3 times and merge" to execute the panel N times with rotated persona compositions (Run 1: standard base; Run 2: complementary set; Run 3: adversarial-heavy 3 DAs + Correctness Hawk). Phase 16 merges findings by location + bug class, scores stability as `[K/N RUNS]`, uses highest severity when runs disagree, resolves judge divergence. Designed to mitigate the ~30% single-run blind spot observed in early consistency analyses.
- Codebase state check — detects worktree/branch divergence to prevent false "missing code" findings
- Tiered knowledge mining (L0/L1/L2) — scans index lines first, then summaries, then full content only for relevant items
- Deep research mode — opt-in web research for domain best practices

## Usage Examples

```
> Review this implementation plan from multiple perspectives: docs/my_plan.md

> /roundtable:agent-review-panel

> Get a panel review of the authentication module — I want to stress-test the design

> Red team this deployment strategy

> Have agents debate whether this refactor is worth the complexity

> /roundtable:agent-review-panel deep   # adds web research for domain best practices

> Do a deep review of this ML pipeline          # also triggers deep research mode
```

After a panel review of a plan document, integrate the findings back into the plan with traceability:

```
> /roundtable:plan-review-integrator review_panel_report.md docs/my_plan.md
```

The integrator classifies each panel finding (apply / defer / reject), edits the plan in place, and produces a per-finding traceability summary so a later reviewer can see what landed and why.

The panel skill auto-detects content type and selects appropriate personas and review mode. You can also specify custom reviewers.

<a id="configuration--modes"></a>
## Configuration / Modes

All modes are LLM-interpreted phrases — the skill's description matches them at invocation. There are no shell flags; whichever phrasing you use, the same configuration knobs are read.

| Mode | Invoke with | Effect |
|---|---|---|
| **Default panel** | `/roundtable:agent-review-panel` (or any "review panel" phrasing) | 4-reviewer panel; auto-personas; auto Precise/Exhaustive |
| **Deep research** | `/roundtable:agent-review-panel deep` or "do a deep review of …" | Adds opt-in web research for domain best practices |
| **Multi-run union** | `--runs 3` or "run 3 times and merge" | Runs the panel N times with rotated persona compositions; Phase 16 deduplicates findings, scores stability `[K/N RUNS]` |
| **Trace tier** | "use Thorough trace" / "use Exhaustive trace" | Phase 2 Data Flow Trace tier (Standard ~default / Thorough top-3 paths / Exhaustive all paths) |
| **Custom personas** | "include a Security Auditor and a Cost Modeler" | Overrides auto-persona detection with the named reviewers; panel size still 4–6 |

<a id="cost--performance"></a>
## Cost & Performance

A single panel run is in the 150k–350k total-token range across all subagents (input + output). Concrete budget by content type:

| Content type | Duration | Tokens | Approx $ at current Opus pricing |
|---|---|---|---|
| Docs / README review | ~6 min | ~150k | ~$3 |
| Plan document (small) | ~6–8 min | ~180k | ~$5 |
| Code (4-reviewer, auto Precise) | ~8–10 min | ~250k | ~$10 |
| Code + Exhaustive Data Flow Trace | ~12–15 min | ~350k | ~$20 |
| `--runs 3` multi-run union | 3× base | 3× base | 3× base |

Numbers are rough — Opus pricing varies and reviewer count auto-scales 4–6 by signal density. **Best for** high-stakes reviews where structured disagreement tracking matters. **Not for** quick code reviews, style checks, or single-opinion feedback.

## Known Limitations

- **Same base model:** All reviewers are Claude instances. Unanimous agreement may reflect shared model biases rather than genuine quality. The correlated-bias warning flags this, but cannot eliminate it.
- **No runtime analysis:** The panel reviews static code and documents. It cannot evaluate runtime behavior, production data patterns, or performance under load.
- **Token cost:** Multi-agent review costs more than single-agent. Use for high-stakes reviews, not routine checks.
- **Temporal reasoning:** Despite explicit checks, temporal scope verification (e.g., "excludes Christmas" with multi-year data) remains the hardest class of bug for panels to catch reliably.
- **Privacy & network:** Reviewers run via Claude Code, so reviewed content is subject to Claude Code's standard data-handling policy. The deep-research mode and Phase 11 web-verification step make outbound HTTPS requests to verify external claims; both can be skipped if you stay in default mode and review proprietary code.
- **Output location:** All three files (`review_panel_report.md`, `review_panel_process.md`, `review_panel_report.html`) are written to your Claude Code session's current working directory and overwrite any prior `review_panel_*` files there. Run one panel at a time per directory.

## Research Foundations

Agent Review Panel is grounded in [9 peer-reviewed papers](docs/research-foundations.md) on multi-agent debate and evaluation quality (ChatEval/ICLR 2024, Du et al./ICML 2024, MachineSoM/ACL 2024, and more). Additionally inspired by [MiroFish](https://github.com/666ghj/MiroFish) (multi-agent prediction engine with heterogeneous agent personalities) — MiroFish's research patterns influenced the v2.1 auto-persona detection and the v2.11 persona-matched verification agent design. See [ROADMAP.md](ROADMAP.md) for the full research roadmap.

## Prerequisites

- **Claude Code** v1.0+ (the skill uses the Agent tool for parallel subagent spawning)
- Works with Claude Pro, Max, or API access
- **Optional:** [VoltAgent specialist agents](https://github.com/VoltAgent/awesome-claude-code-subagents) for stronger domain-specific reviews

## Tests

The project includes a comprehensive test suite (379 tests) using Node.js built-in test runner (zero dependencies):

```bash
npm test                    # run all 379 tests
npm run test:triggers       # trigger classification (55+ prompts)
npm run test:manifest       # manifest consistency + phase/opus enforcement
npm run test:eval-suite     # eval suite integrity + v2.14/v2.15 coverage
npm run test:report         # report structure validation
npm run test:behavioral     # behavioral assertion framework
npm run test:golden         # golden-file structural snapshots
```

Manifest tests enforce key invariants introduced in v2.14/v2.15:
- All 16 phases present in SKILL.md (Phase 1 through Phase 16, no decimal numbering)
- Every `subagent_type:` launch co-occurs with `model: "opus"` (force-opus enforcement)
- Phase 15.3 spec documents all 10 expandable-card accordion sections
- The canonical `SKILL.md` lives at `skills/agent-review-panel/SKILL.md` (v3.0+ single-plugin layout)

## Bundled skills

The `roundtable` plugin ships **two skills** in one install. Both load together; you don't install them separately.

| Skill | Source | What It Does | When to Use |
|---|---|---|---|
| `agent-review-panel` | [`skills/agent-review-panel/`](skills/agent-review-panel/) | Multi-agent adversarial review panel — 4–6 reviewers debate, judge renders final verdict (v3.0.0) | When you need a structured review of code, plans, docs, or configs |
| `plan-review-integrator` | [`skills/plan-review-integrator/`](skills/plan-review-integrator/) | Takes review panel output and integrates findings into an implementation plan — classifies each finding, applies concrete edits, produces a traceability summary (v2.0.1) | After a panel review of a plan document, when you need findings reflected in the plan with traceability |

Both are activated by their natural-language descriptions or via slash commands `/roundtable:agent-review-panel` and `/roundtable:plan-review-integrator`.

> **v3.0 layout change:** Pre-v3.0 the marketplace shipped two independently-installable plugins (`roundtable` + `plan-review-integrator`). v3.0 collapses them into one plugin (`roundtable`) bundling both skills, mirroring the single-plugin pattern used by [obra/superpowers](https://github.com/obra/superpowers). If you previously ran `claude plugin install plan-review-integrator@agent-review-panel`, install just `roundtable@agent-review-panel` and you'll get both skills. See [Migration](#migration-from-previous-marketplaces).

<details>
<summary>Why is the plugin named <code>roundtable</code> and not <code>agent-review-panel</code>?</summary>

`roundtable` is a collective noun for the bundle — "the roundtable holds these skills." It also reads more naturally in slash-command form: `/roundtable:agent-review-panel` over the alternative doubled-name form.

`plan-review-integrator` was previously published as a standalone repo at `wan-huiyan/plan-review-integrator`. That repo is **archived** in favor of the bundled distribution here.

</details>

## Migration from previous marketplaces

If you installed before v2.16.1, you used one of the old marketplace names. Migrate from your terminal:

```bash
# Old agent-review-panel install
claude plugin uninstall agent-review-panel@wan-huiyan-agent-review-panel
claude plugin marketplace remove wan-huiyan-agent-review-panel

# Old plan-review-integrator standalone install (if applicable)
claude plugin uninstall plan-review-integrator@wan-huiyan-plan-review-integrator
claude plugin marketplace remove wan-huiyan-plan-review-integrator

# New bundled install (v3.0+: one plugin, both skills bundled)
claude plugin marketplace add wan-huiyan/agent-review-panel
claude plugin install roundtable@agent-review-panel
```

<details>
<summary>REPL-form equivalent (inside a Claude Code session)</summary>

```
/plugin uninstall agent-review-panel@wan-huiyan-agent-review-panel
/plugin marketplace remove wan-huiyan-agent-review-panel
/plugin uninstall plan-review-integrator@wan-huiyan-plan-review-integrator
/plugin marketplace remove wan-huiyan-plan-review-integrator
/plugin marketplace add wan-huiyan/agent-review-panel
/plugin install roundtable@agent-review-panel
```

</details>

Verify both are loaded under the new marketplace:
```
ls ~/.claude/plugins/cache/agent-review-panel/
# expected: roundtable  (one plugin dir; both skills live inside it)
```

<details>
<summary><strong>Plugin install isn't working after migration?</strong> Bash recipe to clear stale state</summary>

If you installed before v3.0, your `~/.claude/` directory may have stale state that silently shadows the new install (the [Upgrading from v2.x?](#upgrading-from-v2x) callout in Quick Start handles this automatically — this is the manual equivalent):

```bash
# Old marketplace name (pre-v2.16.1 was "plugin")
claude plugin marketplace remove plugin 2>/dev/null

# Orphan marketplace dirs (sometimes have trailing whitespace in the name)
rm -rf "$HOME/.claude/plugins/marketplaces/wan-huiyan-agent-review-panel "  # note trailing space
rm -rf "$HOME/.claude/plugins/marketplaces/wan-huiyan-agent-review-panel"   # no space (also possible)

# Loose-clone shadows from pre-marketplace-era manual clones
rm -rf "$HOME/.claude/skills/agent-review-panel" \
       "$HOME/.claude/skills/agent-review-panel-workspace" \
       "$HOME/.claude/skills/plan-review-integrator" \
       "$HOME/.claude/skills/roundtable"

# Fresh install
claude plugin marketplace add wan-huiyan/agent-review-panel
claude plugin install roundtable@agent-review-panel
```

Restart your Claude Code session after install.
</details>

## Troubleshooting

<a id="after-install-roundtableagent-review-panel-is-not-recognized"></a>
### After install, `/roundtable:agent-review-panel` is not recognized

Restart your Claude Code session — skills load at session start, not on install completion. If the slash command still doesn't appear after restart, see "Old version keeps loading" below.

### The panel ran but no output files appeared

The three output files (`review_panel_report.md`, `review_panel_process.md`, `review_panel_report.html`) are written to your Claude Code session's **current working directory**. Run `pwd` in the session to confirm where you are. If you start the session from one directory and `cd` elsewhere, files land in the original cwd. Only one panel can run per directory at a time — concurrent runs in the same directory will overwrite each other.

### Old version keeps loading after `claude plugin update`

A loose clone in `~/.claude/skills/agent-review-panel/` shadows the marketplace install and pins you to whatever version was cloned. Verify, back up, then remove:

```bash
ls ~/.claude/skills/agent-review-panel 2>/dev/null && \
  mv "$HOME/.claude/skills/agent-review-panel" "$HOME/.claude/skills/agent-review-panel.bak.$(date +%s)"
```

Then restart Claude Code. The marketplace install in `~/.claude/plugins/cache/agent-review-panel/` will take over. The backup is reversible — delete it once you've confirmed the marketplace version works.

### `review_panel_report.html` is missing or empty

Phase 15.3 generates the HTML in a separate pass and may retry once on transient failures. If still missing after a run, the markdown report contains the same findings — the HTML is a presentation layer. To regenerate the HTML manually, ask Claude Code in the same session: *"generate the HTML review report"*.

### The HTML report renders unstyled or charts are blank

The dashboard pulls Tailwind, Chart.js, and Prism.js from CDN; first open requires internet. For air-gapped review, use `review_panel_report.md` — same content, no CDN dependency. (The three CDN libraries are MIT-licensed.)

### `npm test` fails locally with `Cannot find module 'node:test'` or similar

The test suite uses Node's built-in test runner, which requires **Node ≥ 18** (stable from 20). Check with `node --version` and upgrade if needed.

### Panel hangs partway through Phase 3

A reviewer subagent may have timed out. The panel doesn't auto-retry across runs — interrupt the session and re-invoke the panel. If it reproduces, file an issue with the content type (code/plan/docs) and approximate size.

### Migration / install state from older marketplace names

If you installed before v2.16.1 or v3.0 and `claude plugin update` misbehaves, the simplest fix is the "Upgrading from v2.x?" prompt in [Quick Start](#quick-start) — Claude Code does the cleanup and reinstall for you. Manual recipe is in [Migration](#migration-from-previous-marketplaces).

## Reading the Report

The panel produces three files per run; here's how to read them.

**Vocabulary.** This README uses these words consistently:

| Term | Means |
|---|---|
| **plugin** | The marketplace package you install (`roundtable`) — one bundle that ships skills, manifests, and assets |
| **skill** | A shipped behavior loaded by Claude Code; this plugin bundles two skills (`agent-review-panel`, `plan-review-integrator`) |
| **reviewer** | One persona in the panel (e.g. Clarity Editor, Devil's Advocate). 4–6 reviewers participate per run |
| **agent / subagent** | The Claude Code launch mechanism the skill uses to spawn each reviewer in parallel — not a synonym for "reviewer" or "skill" |
| **panel** | The full set of reviewers participating in a single run |
| **judge** | The Phase 14 arbiter that ingests all reviewer + verification output and renders the final verdict |

**Severity rubric.** Every finding is tagged with one severity:

- **P0** — ship-blocker. Affects correctness, data integrity, or security. Must fix before merging/releasing.
- **P1** — should fix soon. Real defect, real cost, but not a release-blocker.
- **P2** — nice to have. Stylistic, structural, or future-rot avoidance.
- **P3** — nit. Optional polish.

**Epistemic labels.** Each finding is also tagged with how confident the panel is in the underlying evidence:

| Label | Meaning |
|---|---|
| `[VERIFIED]` | Confirmed against source — line citation matches actual code/text |
| `[CONSENSUS]` | Three or more reviewers raised it independently |
| `[SINGLE-SOURCE]` | One reviewer raised it, no one refuted |
| `[DISPUTED]` | Reviewers split on whether it's a real issue |
| `[UNVERIFIED]` | Stated without a checkable citation; treat with care |
| `[WEB-VERIFIED]` | External fact (product feature, regulation, API behavior) confirmed by an authoritative web source |
| `[WEB-CONTRADICTED]` | External fact contradicted by an authoritative web source — severity demoted |
| `[WEB-INCONCLUSIVE]` | External fact could not be confirmed via web search — flagged for human judgement |
| `[CMD_CONFIRMED]` / `[CMD_CONTRADICTED]` | Reviewer's `verification_command` (read-only grep/cat/head) was run and the result confirmed/contradicted the claim |

**Defect type.** Code/plan reviews additionally label findings as `[EXISTING_DEFECT]` (bug exists right now) or `[PLAN_RISK]` (risk only materializes if the plan is implemented as written). P0 severity requires `[EXISTING_DEFECT]` evidence.

**How to read in priority order:** start with the Executive Summary, then the Action Items table (sorted P0 → P3). Use the HTML dashboard's filter bar to narrow by severity or epistemic label. Process history (`review_panel_process.md`) is the verbatim director's-cut log — read this only when you need to see *why* a finding got a particular ruling.

## Contributing

Contributions welcome! Areas where help is especially useful:

- **Cursor adaptation** — adapting the Agent tool calls to Cursor's subagent mechanism
- **New domain checklists** — adding signal groups beyond the current 10
- **Benchmark cases** — real-world review scenarios for the eval suite

Please open an issue to discuss before submitting large PRs.

## Uninstalling

**If installed via marketplace**, from your terminal:
```bash
claude plugin uninstall roundtable@agent-review-panel
claude plugin marketplace remove agent-review-panel
```

(REPL-form equivalent: `/plugin uninstall roundtable@agent-review-panel` and `/plugin marketplace remove agent-review-panel`.)

**If installed via manual clone:**
```bash
rm -rf ~/.claude/skills/agent-review-panel
```

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history. See [ROADMAP.md](ROADMAP.md) for research sources and deferred items.

| Version | Highlights |
|---------|------------|
| **v3.1** | Silent-phase-compression fix (#35) — file-based subagent state under `state/<phase>.md`, Phase 13.5 Pre-Judge Verification Gate, `⚠️ COMPRESSED RUN` header when phase loss is detected. Eliminates the v3.0 failure mode where context pressure silently inlined Phases 4 / 5 / 7 into the judge step (PR #39) |
| v3.0 | Single-plugin layout (BREAKING) — collapses the multi-plugin marketplace into one plugin (`roundtable`) bundling both skills, mirroring [obra/superpowers](https://github.com/obra/superpowers). Install UX is one command instead of two. `release-check.sh` doc-drift detector folded in (PR #33) |
| v2.16.5 | Plugin skills layout fixed for Claude Code ≥ 2.1.112 manifest validation (PR #30 by @okuuva) |
| v2.16.4 | Phase 15.3 reliability — disk-reading prompt strategy + verification gate; manual HTML report recovery |
| v2.16.3 | External domain claim web verification in Phase 11 — `[WEB-VERIFIED]` / `[WEB-CONTRADICTED]` / `[WEB-INCONCLUSIVE]` labels |
| v2.16.2 | Hotfix for plugin layout bug that silently broke all marketplace installs since 2026-04-07 |
| v2.16.1 | Marketplace bundle (PR #22) |
| v2.16.0 | Plugin layout (PR #18) |
| v2.15 | Expandable 10-section issue cards in HTML dashboard (narrative, code evidence, debate, judge ruling, fix, cross-refs, prior runs); Prism.js syntax highlighting; deep-linking; keyboard nav; print-friendly |
| v2.14 | Phase 2 Data Flow Trace (composition bug detector, 3 tiers); Multi-Run Union Protocol + Phase 16 Merge; force `model: "opus"` on all launches; integer phase renumbering (1–16) |
| v2.13 | Persona profiles in process history + Panel Gallery in HTML dashboard |
| v2.12 | Triple output: primary report + process history + interactive HTML dashboard |
| v2.11 | Verification round: tiered (Light/Standard/Deep) persona-matched agents per dispute |
| v2.10 | Codebase state check — prevents false "missing code" findings in worktrees |
| v2.9 | VoltAgent specialist agent integration (127+ agents, 10 families) |
| v2.8 | Auto Precise/Exhaustive mode, verification commands, tiered knowledge mining |
| v2.7 | Severity verification, defect classification, temporal scope checks |
| v2.6 | Schliff optimization (75 → 86), reference extraction, A/B validated |
| v2.5 | Trust layer: claim verification, epistemic labels, scope disclosure |
| v2.4 | Portability signal group |
| v2.3 | Knowledge mining, domain checklists, deep research mode |
| v2.2 | DMAD reasoning strategies, context gathering, anti-rhetoric guard |
| v2.1 | Auto-persona from content signals, source-grounded debate |
| v2.0 | Completeness auditor, new discovery requirement |
| v1.0 | Initial release: multi-agent review with debate and judge |

## License

[MIT](LICENSE) — Huiyan Wan

## Acknowledgements

- Inspired by [MiroFish](https://github.com/666ghj/MiroFish) — multi-agent prediction engine with heterogeneous agent personalities and memory; influenced auto-persona detection and persona-matched verification agents
- Eval suite improved using [schliff](https://github.com/Zandereins/schliff)
- See [HOW_WE_BUILT_THIS.md](HOW_WE_BUILT_THIS.md) for the design journey

### Contributors

External contributions — thank you!

- [@okuuva](https://github.com/okuuva) — [#30](https://github.com/wan-huiyan/agent-review-panel/pull/30) restructured the plugin to the canonical nested skills layout for Claude Code ≥2.1.112 manifest validation (resolves [#28](https://github.com/wan-huiyan/agent-review-panel/issues/28))
