[![Version](https://img.shields.io/github/package-json/v/wan-huiyan/agent-review-panel)](https://github.com/wan-huiyan/agent-review-panel/releases) [![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-orange)](https://claude.com/claude-code) [![license](https://img.shields.io/github/license/wan-huiyan/agent-review-panel)](LICENSE) [![Tests](https://github.com/wan-huiyan/agent-review-panel/actions/workflows/test.yml/badge.svg)](https://github.com/wan-huiyan/agent-review-panel/actions/workflows/test.yml)

# Agent Review Panel

**4–6 AI reviewers independently evaluate your code, plan, or docs, debate each other's findings, then a judge resolves disagreements.** A [Claude Code](https://claude.ai/code) plugin that orchestrates structured multi-stance review. Each run costs roughly **$3–$20** in Opus tokens and takes **6–15 minutes** — built for high-stakes reviews, not routine code review.

[![Agent Review Panel — watch your code journey through the multi-agent review pipeline](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/quest-hero.gif?v=2)](https://wan-huiyan.github.io/agent-review-panel/quest/)

<p align="center"><em>▶️ <a href="https://wan-huiyan.github.io/agent-review-panel/quest/">Play the interactive version</a> — pause, replay, jump to any stage. Your code/plan journeys <b>Gather → Review → Debate → Verify → Adjudicate → Report</b>. <a href="docs/hero-flow.svg">(static pipeline diagram)</a></em></p>

> Runs only on Claude Code surfaces (CLI, IDE extension, Desktop "Code" tab) and the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/plugins). Does not work on claude.ai web chat or the raw Anthropic API — see [Surfaces & Requirements](#surfaces--requirements).

## Quick Start

```bash
claude plugin marketplace add wan-huiyan/agent-review-panel
claude plugin install roundtable@agent-review-panel
```

Restart your Claude Code session — skills load at session start.

<details>
<summary>Already inside a Claude Code session? Use the slash-command form</summary>

```
/plugin marketplace add wan-huiyan/agent-review-panel
/plugin install roundtable@agent-review-panel
```

Same effect. Shell form (`claude plugin …`) from the terminal; REPL form (`/plugin …`) from inside Claude Code.
</details>

**Verify it loaded.** In a fresh Claude Code session, type `/roundtable:agent-review-panel` with no arguments. The skill should introduce itself and ask what to review. If you get `unknown command`, see [Troubleshooting](TROUBLESHOOTING.md#after-install-roundtableagent-review-panel-is-not-recognized). Migrating from an older install handle? See [MIGRATION.md](MIGRATION.md).

**⚡ Recommended — add VoltAgent specialists.** Reviews get noticeably sharper when [VoltAgent specialist agents](https://github.com/VoltAgent/awesome-claude-code-subagents) are installed: the panel auto-upgrades each reviewer to a real domain specialist (e.g. Security Auditor → `voltagent-qa-sec:security-auditor`) instead of a generic persona. Not installed? It falls back gracefully — nothing breaks.

```bash
claude plugin marketplace add VoltAgent/awesome-claude-code-subagents
claude plugin install voltagent-qa-sec@voltagent-subagents   # backs the core code-review personas
```

Add `voltagent-lang`, `voltagent-data-ai`, `voltagent-infra`, … as you need them (10 families, 130+ agents; the `/plugin …` REPL form works too — takes effect next session). Why it's worth it → [Sharper reviews with VoltAgent](#sharper-reviews-with-voltagent-specialists). *(VoltAgent installs through Claude Code's plugin system.)*

**Use:**

```
> Review this implementation plan from multiple perspectives: docs/my_plan.md

> /roundtable:agent-review-panel
```

Natural-language invocation also works ("red team this", "stress-test this design", "get a panel review of …").

**What you get** — three files written to your current working directory:

- `review_panel_report.md` — executive summary, consensus, judge-resolved disagreements, action items
- `review_panel_process.md` — verbatim "director's cut" of every reviewer's output
- `review_panel_report.html` — interactive dashboard with expandable issue cards, charts, and a panel gallery

See [Sample output](#sample-output) below for what a real report looks like.

## When to use it — and when not

**Use a panel for:** high-stakes plans you'd want a second/third/fourth opinion on; security-sensitive code; architecture decisions that are expensive to reverse; docs that have to be right; "I'm too close to this — stress-test it."

**Don't use a panel for** (use a single review or `/review` instead): a quick look before pushing; type-error fixes; routine code review; addressing existing PR comments; "what does this code do?"; deployments; writing tests or docs from scratch.

The key signal is **multiple independent perspectives** — if one opinion would do, you're paying 4–6× more for nothing.

## Why a panel, not a single reviewer?

Ask one reviewer "review this" and you get one perspective. It won't argue with itself, catch its own blind spots, or volunteer "I'm not sure about this."

The panel forces the same model to take multiple passes from assigned, divergent stances — Correctness Hawk, Security Auditor, Devil's Advocate, etc. — *before* they see each other's output. Then they debate, then a separate judge step resolves disputes against verified evidence. You get a deliberation, not a list:

> **Feasibility Analyst:** "The `data_available_through` hardcoding is minor — it's documented."
>
> **Risk Assessor:** "Disagree. If stale, the lookforward extends past actual data — model trains on incomplete outcomes — silent false-negative bias."
>
> **Feasibility Analyst (Round 2):** "Valid point. I upgrade this to IMPORTANT."

**Honest caveat:** all reviewers are Claude instances running the same base model. This is structured *self-critique*, not independent verification — unanimous agreement may reflect shared model bias rather than ground truth. The architecture includes anti-groupthink safeguards (blind final scoring, sycophancy detection, correlated-bias warnings) but cannot eliminate the structural limitation. The value is the forced multi-stance discipline plus verification against actual source, not the appearance of disagreement.

## Sample output

The panel was run against this very README on 2026-05-14. The interactive HTML dashboard:

[![Agent Review Panel — interactive HTML dashboard with expandable issue cards](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/v3.3.0/docs/html-demo.gif)](docs/reviews/2026-05-14-readme/review_panel_report.html)

*Expandable 10-section issue cards (narrative, code evidence with Prism.js syntax highlighting, debate transcripts, judge rulings, fix recommendations, cross-references), deep-linkable, keyboard-navigable, print-friendly. The GIF above links to the actual generated report for this README.*

Excerpt from the matching `review_panel_report.md`:

```markdown
# Review Panel Report — README.md

**Verdict:** REVISE — substantial edit needed | **Confidence:** Medium-High
**Score:** 5/10 | **Mode:** Exhaustive (pure documentation)

## Executive Summary

The README is factually careful where it counts — install commands, marketplace
handles, slash commands, the test-count claim, and spot-checked anchors all verify
cleanly against the repo. But three problems pull the score to 5/10: the
version/release story is incoherent and actively misleads every current
user, the document is roughly a third too long, and it never shows what a
review actually produces.

## Consensus Points (judge-confirmed)

- Version/release story is broken — all four reviewers, independently.
  package.json declares 3.3.0; the only git tags are up to v3.1.0. The
  "Updating" section tells users to verify against "the latest GitHub
  release" — which resolves to v3.1.0, so every correctly-installed
  v3.3.0 user concludes their install is wrong.  [VERIFIED][CONSENSUS]

## Action Items

| # | Severity | Action                                                       |
|---|----------|--------------------------------------------------------------|
| 1 | P1 [VERIFIED][CONSENSUS] | Fix the version/release story.            |
| 3 | P1 [CONSENSUS]           | Cut ~⅓ length; split audiences.           |
| 4 | P1 [VERIFIED]            | Add a text sample of a real report.       |
```

You're reading the rewrite that lands those findings. The full artifacts live at:

- [`docs/reviews/2026-05-14-readme/review_panel_report.md`](docs/reviews/2026-05-14-readme/review_panel_report.md) — the full markdown report (13 action items)
- [`docs/reviews/2026-05-14-readme/review_panel_report.html`](docs/reviews/2026-05-14-readme/review_panel_report.html) — the interactive HTML dashboard
- [`docs/reviews/2026-05-14-readme/review_panel_process.md`](docs/reviews/2026-05-14-readme/review_panel_process.md) — verbatim process log with all four reviewers' raw output

## Sharper reviews with VoltAgent specialists

By default every reviewer is a *generic* Claude agent wearing a persona prompt ("act as a Security Auditor"). That works — but if you install [VoltAgent's specialist agents](https://github.com/VoltAgent/awesome-claude-code-subagents), the panel **upgrades each persona to a matching domain specialist** whose expertise is built into its own system prompt: a real Security Auditor, Database Optimizer, or SRE instead of a generalist asked to role-play one.

- **Automatic, zero-config.** During setup (Phase 1) the panel scans for installed `voltagent-*` agents and routes personas to them. No specialist installed for a given role? That reviewer falls back to a generic persona — nothing to configure, nothing breaks.
- **130+ specialists across 10 families** — `qa-sec` (code review, security, performance, chaos), `lang` (20+ language experts), `data-ai`, `infra`, `core-dev`, and more. Content signals auto-add the right one: SQL → a database optimizer, Terraform → an IaC engineer, React → a frontend specialist. v3.4 added 30 such signal→specialist mappings, roughly doubling coverage.
- **Install what you review.** `voltagent-qa-sec` backs the core code-review personas; add `voltagent-lang` / `voltagent-data-ai` / `voltagent-infra` for language-, ML-, or infra-heavy work. Commands are in [Quick Start](#quick-start).

> *VoltAgent specialists install through Claude Code's plugin system — the same Claude Code surfaces the panel itself runs on (CLI / IDE / Desktop "Code" tab / Agent SDK). Codex isn't a supported surface for the panel: it needs Claude Code's `Agent` tool to spawn reviewers in parallel — see [Surfaces & Requirements](#surfaces--requirements).*

## Surfaces & Requirements

This plugin needs the Claude Code `Agent` tool for parallel subagent spawning, local-filesystem access for output files, and a plugin loader.

**Works ✅**
- **CLI** — `claude` in your terminal
- **VS Code extension** — Claude Code extension
- **JetBrains IDE extension** — IntelliJ, PyCharm, WebStorm, GoLand, Rider, etc.
- **Claude Desktop app → Code tab** — the dedicated "Code" tab inside the Desktop app ([docs](https://code.claude.com/docs/en/desktop))
- **Claude Agent SDK** — load via `options.plugins: [{ type: "local", path: "./agent-review-panel" }]` ([docs](https://code.claude.com/docs/en/agent-sdk/plugins))

**Does not work ❌**
- **claude.ai web chat** and **Claude Desktop regular chat tabs** — no `/plugin` marketplace; Agent Skills there can't spawn parallel subagents or write the output files
- **Anthropic Messages API called directly** (without the Agent SDK) — no plugin loader, no subagent orchestration, no filesystem. Use the Agent SDK entry above.

**Prerequisites in one place:**

- **Claude Code v1.0+** on a supported surface, or the Claude Agent SDK
- A Claude **Pro / Max** subscription or API access (Opus is the reviewer model)
- **Node ≥18** (only needed if running `npm test` or developing locally)
- **Recommended:** [VoltAgent specialist agents](https://github.com/VoltAgent/awesome-claude-code-subagents) — the panel auto-upgrades reviewers to domain specialists ([why it helps](#sharper-reviews-with-voltagent-specialists))

Don't have Claude Code yet? Install it from [claude.ai/code](https://claude.ai/code), then come back to [Quick Start](#quick-start).

### Marketplace install (recommended)

Install commands are in [Quick Start](#quick-start). The marketplace install handles caching, version tracking, and trigger-phrase activation in one step.

<!-- release-check:marketplace-name-callout — load-bearing for scripts/release-check.sh; do not delete without updating both -->
> **Command format:** `@<marketplace-name>`, not `@<repo-name>`. The marketplace name is `agent-review-panel` (defined in `.claude-plugin/marketplace.json`); the plugin install name inside it is `roundtable`. Hence `roundtable@agent-review-panel`. If you installed under an older marketplace name, see [MIGRATION.md](MIGRATION.md).
<!-- /release-check:marketplace-name-callout -->

**Why the marketplace path?** The repo ships `.claude-plugin/marketplace.json` + `.claude-plugin/plugin.json` manifests that Claude Code reads to register the plugin. The marketplace install reads those manifests and wires everything up in one step. [Manual clone](#manual-clone) works but bypasses the manifests.

### Manual clone

For local development, forking, or air-gapped environments. **Do NOT clone into `~/.claude/skills/`** — that path shadows marketplace installs.

```bash
git clone https://github.com/wan-huiyan/agent-review-panel.git ~/projects/agent-review-panel-dev
claude --plugin-dir ~/projects/agent-review-panel-dev
```

### Cursor (untested by maintainers)

<details>
<summary>Community-contributed starting points — see <a href="#contributing">Contributing</a> if you want to help</summary>

Per-project rule:
```bash
mkdir -p .cursor/rules
# Create .cursor/rules/agent-review-panel.mdc with the content of SKILL.md
# Add frontmatter: alwaysApply: true
```

Manual global install:
```bash
git clone https://github.com/wan-huiyan/agent-review-panel.git ~/.cursor/skills/agent-review-panel
```

The core pattern is straightforward — one subagent per reviewer in Phase 3, collect results, debate in Phase 5, verification and judge after. PRs welcome.
</details>

## How It Works

A run executes 16 top-level phases (plus two verification gates — 13.5 and 14.5 — and an optional multi-run merge at Phase 16). The numbered phase table:

| Stage | Phase | Action |
|---|---|---|
| **Gather** | 1 | Setup — scan sibling dirs, trace references, discover safeguards, detect signals, select personas |
| | 2 | Data Flow Trace (code only) — trace critical path(s), document schemas at each function boundary, flag composition/seam bugs |
| **Review** | 3 | Independent Review — 4–6 reviewers evaluate in parallel (no cross-talk) |
| | 4 | Private Reflection — each reviewer re-reads and rates own confidence |
| **Debate** | 5 | Adversarial Debate (1–3 rounds) — reviewers engage + find new issues |
| | 6 | Round Summarization — distill resolved/unresolved points between rounds |
| | 7 | Blind Final — each reviewer gives final score independently |
| **Verify** | 8 | Completeness Audit — dedicated agent scans for what the panel missed |
| | 9 | Verify Commands — run reviewer grep/read commands for P0/P1 findings (advisory) |
| | 10 | Claim Verification — verify all line-number citations against source |
| | 11 | Severity Verification — read actual code for every P0/P1; downgrade if overstated; web-verify external domain claims |
| | 12 | Tier Assignment — confidence-based draft → judge-advised refinement per dispute |
| | 13 | Targeted Verification — persona-matched agents investigate each dispute point |
| | **13.5** | **Pre-Judge Verification Gate** — orchestrator confirms all phase outputs exist on disk before launching the judge |
| **Adjudicate** | 14 | Supreme Judge — Opus arbitrates everything including verification-round evidence |
| | **14.5** | **Post-Judge Verification Gate** — re-verifies judge-introduced P0/P1 against ground truth (catches judge hallucinations) |
| **Output** | 15 | Triple output: Primary Report (`.md`) + Process History (`.md`) + Expandable-card Dashboard (`.html`) |
| **Merge** | 16 | Multi-Run Merge (optional) — deduplicate findings across runs, score stability, resolve judge divergence |

Phase 15 has three sequential sub-steps (15.1 → 15.2 → 15.3) so the HTML agent can read the already-written markdown and process files from disk.

### Choosing a review mode

This skill is the **full adversarial panel** — its defining feature is the **Phase 5–7 debate**, where reviewers cross-examine each other before a judge rules. Debate is expensive (sequential cross-talk) and only pays off when reviewers would genuinely change each other's verdicts. Pick deliberately:

| You want | Use | Debate? |
|---|---|---|
| Fast eyes on a tiny PR | `/code-review`, single-persona review | no |
| Independent parallel lenses on small / autonomous multi-PR work | streamlined panel (no-debate) | no, by design |
| **Adversarial tradeoff, high-stakes gating, a verdict debate would change** (security vs perf, "is this P0 real", merge go/no-go) | **this skill (full panel) — invoke as a skill, not a workflow** | **yes** |
| **Discriminate the quality of a subjective deliverable** (strategy report, marketing/creative copy, pitch, research synthesis) where every competent draft *reads* good | **this skill — Assessment mode** (auto-detected) | **yes** |
| Adversarial coverage on a cost leash (routine-but-nontrivial changes, cost-sensitive or autonomous runs) | **this skill — Budget mode** ("budget review", explicit opt-in) | yes (1 round) |

Debate lives in the skill's Agent-tool orchestration. Running a review as a **Workflow / ultracode** task routes it through a *parallel fan-out* engine (agents never see each other) whose canonical shape is "find → verify → judge" — structurally debate-less. If a run produces no debate, the report now stamps a loud **`[NO-DEBATE]`** banner and caps confidence at Medium, so a debate-less review is never silent. To get the panel's depth under a Workflow, author an explicit `Debate` phase (see the debate-in-Workflow recipe in `SKILL.md`).

## Features

**Review process**
- 4–6 reviewers with distinct personas evaluate in parallel, then debate across 1–3 rounds
- Auto-selects personas from content type (code, plan, docs, mixed, **subjective-quality deliverables**) and 10 technology signal groups (SQL/Data, Auth/Security, Infrastructure, ML/Statistics, API/Integration, Frontend, Cost, Pipeline, Repo/Data Hygiene, Skill/Docs Portability)
- Each reviewer uses a different reasoning strategy (systematic enumeration, adversarial simulation, backward reasoning, etc.)
- Auto Precise/Exhaustive mode: code requires line citations; plans allow broader risk identification

**Verification layer**
- **Claim verification** checks all reviewer citations against actual source code
- **Severity verification** reads the codebase to confirm P0/P1 findings before the judge sees them. External domain claims (product limits, regulatory jurisdiction, API behavior) are automatically web-searched and tagged `[WEB-VERIFIED]`, `[WEB-CONTRADICTED]`, or `[WEB-INCONCLUSIVE]`
- **Verification commands**: runs read-only grep/cat commands from reviewers to confirm or contradict claims
- **Defect classification**: findings labeled `[EXISTING_DEFECT]` or `[PLAN_RISK]` — P0 requires existing defect evidence
- **Live-State Claim Discipline**: findings asserting facts about *live infrastructure or runtime state* (deployed IAM, running crons, production env vars) must distinguish declarative config from imperative documentation from live `describe`-class output. Tagged `[LIVE-VERIFIED]` or `[STATIC-INFERENCE]` — the latter is capped at P1
- **Completeness audit**: post-debate agent re-reads source line-by-line for what everyone missed
- **Targeted verification**: each unresolved dispute gets a tiered (Light / Standard / Deep) verification agent matched to the claim type
- **Data Flow Trace** (code only, three tiers): a dedicated agent traces data through critical paths before reviewers begin, flagging composition/seam bugs
- **Post-judge verification gate**: re-verifies any P0/P1 the judge introduced (vs. raised by panel) against ground truth; hallucinated findings are demoted and the verdict score is recomputed
- **Explicit model, always**: every subagent launch passes `model:` explicitly to eliminate cross-run reasoning variance — `"opus"` everywhere in the full panel; `"sonnet"` reviewers/verifier + `"opus"` judge in budget mode

**Anti-groupthink safeguards**
- Blind final scoring, private reflection, calibrated skepticism levels (20–60%)
- Sycophancy detection intervenes when >50% of position changes lack new evidence
- Anti-rhetoric assessment flags position changes driven by eloquence rather than evidence
- Judge confidence gating: low-confidence verdicts flag `⚠️ HUMAN REVIEW RECOMMENDED`
- Correlated-bias warning when all reviewers converge (unanimous agreement is the most dangerous failure mode)
- **Control-validation gate** (Assessment mode) — runs a degenerate *no-input* control through the same personas and drops any persona that can't score it clearly below the real deliverable; catches non-discriminating sycophancy that reviewer-agreement checks miss

**Outputs (three files per review)**

- **Primary report** (`review_panel_report.md`): executive summary, consensus, disagreements (with judge rulings), prioritized action items with epistemic labels — see [Reading the Report](#reading-the-report).
- **Process history** (`review_panel_process.md`): verbatim "director's cut" log of every agent's output, with persona profiles embedded.
- **Interactive HTML dashboard** (`review_panel_report.html`) with **expandable 10-section issue cards** — each card opens a nested accordion: 📖 Narrative, 📄 Code Evidence (Prism.js-highlighted), 👥 Raised by, 🔍 Verification Trail, 💬 Debate, ⚖️ Judge Ruling, 🛠️ Fix Recommendation, 🔗 Cross-references, 🏷️ Epistemic Tags, 📊 Prior Runs. Deep-linkable (`report.html#issue-A1`), keyboard-navigable, print-friendly. Tailwind + Chart.js + Prism.js via CDN.

**Advanced**

- **VoltAgent integration** — auto-upgrades personas to 130+ domain specialists across 10 families when installed; content signals route each domain (SQL, Terraform, React, …) to its matching expert. See [Sharper reviews with VoltAgent](#sharper-reviews-with-voltagent-specialists)
- **Multi-Run Union Protocol** — invoke `--runs N` or "run 3 times and merge" to execute the panel N times with rotated persona compositions. Phase 16 merges findings by location + bug class, scores stability as `[K/N RUNS]`, resolves judge divergence. Mitigates the ~30% single-run blind spot observed in early consistency analyses
- **Codebase state check** — detects worktree/branch divergence to prevent false "missing code" findings
- **Tiered knowledge mining** (L0 index / L1 summary / L2 full) — scans index lines first, only reads full content for relevant items
- **Deep research mode** — opt-in web research for domain best practices
- **Budget mode** (v3.7) — explicit opt-in reduced-cost profile (~20–25% of full-run cost) whose every cut targets a *measured* cost driver: orchestrator turn diet (the measured 69%), phase consolidation, single opus judge, markdown-only output, sonnet reviewers. Reports open with a `[BUDGET-MODE]` banner. See [Where the money actually goes](#-where-the-money-actually-goes-measured--and-budget-mode)

## Usage Examples

```
> Review this implementation plan from multiple perspectives: docs/my_plan.md

> /roundtable:agent-review-panel

> Get a panel review of the authentication module — I want to stress-test the design

> Red team this deployment strategy

> Have agents debate whether this refactor is worth the complexity

> /roundtable:agent-review-panel deep   # adds web research for domain best practices

> Do a deep review of this ML pipeline
```

After a panel review of a plan document, integrate findings back into the plan with traceability:

```
> /roundtable:plan-review-integrator review_panel_report.md docs/my_plan.md
```

The integrator classifies each finding (apply / defer / reject), edits the plan in place, and produces a per-finding traceability summary.

## Configuration / Modes

All modes are LLM-interpreted phrases — the skill's description matches them at invocation. There are no shell flags.

| Mode | Invoke with | Effect |
|---|---|---|
| **Default panel** | `/roundtable:agent-review-panel` (or any "review panel" phrasing) | 4-reviewer panel; auto-personas; auto Precise/Exhaustive |
| **Deep research** | `/roundtable:agent-review-panel deep` or "do a deep review of …" | Adds opt-in web research for domain best practices |
| **Multi-run union** | `--runs 3` or "run 3 times and merge" | Runs the panel N times with rotated personas; deduplicates findings; scores stability `[K/N RUNS]` |
| **Trace tier** | "use Thorough trace" / "use Exhaustive trace" | Data Flow Trace tier (Standard default / Thorough top-3 paths / Exhaustive all paths) |
| **Custom personas** | "include a Security Auditor and a Cost Modeler" | Overrides auto-persona detection; panel size still 4–6 |
| **Assessment** | auto-detected for subjective-quality deliverables (or "assess / score this report") | Quality *discrimination*, not defect-finding: subtract-points + veto, the swap test, an out-of-band currency check, and the **control-validation gate** (drop personas that can't beat a no-input control) |
| **Budget** (v3.7) | `/roundtable:agent-review-panel budget`, "budget review of …", "token-efficient review", or any panel request + a cost constraint ("keep the cost down") — explicit opt-in, never auto | Same adversarial shape at **~20–25% of full-run cost**: orchestrator turn diet, 3 sonnet reviewers, 1 debate round, consolidated verification, single opus judge, markdown-only output, `[BUDGET-MODE]` banner |

## Cost & Performance

| Content type | Duration | Tokens | Approx $ at current Opus pricing |
|---|---|---|---|
| Docs / README review | ~6 min | ~150k | ~$3 |
| Plan document (small) | ~6–8 min | ~180k | ~$5 |
| Code (4-reviewer, auto Precise) | ~8–10 min | ~250k | ~$10 |
| Code + Exhaustive Data Flow Trace | ~12–15 min | ~350k | ~$20 |
| `--runs 3` multi-run union | 3× base | 3× base | 3× base |
| **Budget mode (v3.7)** | ~base | — | **~20–25% of the equivalent full run** |

Cost is driven by: reviewer count (4–6 auto-scales by signal density), content size, debate rounds, `deep` mode (adds web research), and `--runs N` (linear multiplier). Pricing assumes Anthropic's published Opus rate at time of run; check [Anthropic pricing](https://www.anthropic.com/pricing) for current numbers.

### 💸 Where the money actually goes (measured) — and Budget mode

A [2026-07-16 token audit of a real full-protocol run](docs/analysis/2026-07-16-panel-token-split-audit.md) ($162, all phases + debate) found the cost was **not** where intuition says:

| Cost driver | Share |
|---|---|
| **Orchestrator main loop** (157 turns × a 270k→630k-token context) | **69%** |
| Judge ran twice + post-judge verifier agent | 11% |
| All 4 reviewers, phases 3–7 — *the fan-out everyone assumes dominates* | **7%** |
| Separate verification agents | 7% |
| HTML report | 4% |

**Budget mode** (v3.7, explicit opt-in: "budget review") cuts in that measured order — orchestrator turn diet first (batched launches, persistent reviewers, ≤50-word agent returns, ≤25-turn target, fresh-session guidance), then single-judge, markdown-only output, one consolidated verifier, and only *then* model tiering (sonnet reviewers, opus judge — the judge is never downgraded). Debate still runs (1 round), so the `[NO-DEBATE]` guarantee stays honest, and every budget report opens with a `[BUDGET-MODE]` banner. Estimated: **~$25–40 for a review that costs ~$160 at full protocol**.

**How to trigger it** (always explicit — never auto-selected):

- **Slash command**: `/roundtable:agent-review-panel budget <target>`
- **Named phrases**: "budget review", "budget mode", "budget panel", "cheap review", "economy review", "low-cost panel", "affordable review", "token-efficient review", "frugal review", "lite panel"
- **Cost constraint on any panel request** (v3.7.1): "review panel on this, but keep the token cost down", "multi-agent review without burning tokens", "don't spend too much". Stating a cost constraint *is* the opt-in — the orchestrator confirms in one line and proceeds (say "full panel" to override).

**Why isn't budget the default?** Because the savings are not free: sonnet reviewers surface fewer subtle findings than opus, one debate round replaces adaptive multi-round convergence, and one consolidated verifier replaces three dedicated verification passes — the redundancy that has caught real defects in this project's own history (including a judge-fabricated P0). Degraded rigor must be chosen and loudly bannered, never silently applied — the same principle behind the `[NO-DEBATE]` banner. Reach for budget mode on routine-but-nontrivial changes; keep the full panel for high-stakes reviews.

**The quality-free part IS the default (v3.8).** The turn diet — batched launches, persistent reviewer agents driven via SendMessage, ≤50-word agent returns, no inter-phase narration, a ≤40-turn orchestrator target (the measured pre-discipline run took 157), and a fresh-session recommendation — applies to **every** mode since v3.8.0, because none of it removes a review, debate round, or verification pass. It attacks the measured 69% cost driver directly, so even full-protocol runs should now cost a fraction of the audited baseline.

## Known Limitations

- **Same base model.** All reviewers are Claude instances; unanimous agreement may reflect shared model biases. The correlated-bias warning flags this but cannot eliminate it. See [Why a panel](#why-a-panel-not-a-single-reviewer) for the honest framing.
- **No runtime analysis.** The panel reviews static code and documents. It cannot evaluate runtime behavior, production data patterns, or performance under load.
- **Token cost.** Multi-agent review costs more than single-agent. Use the full panel for high-stakes reviews; for routine-but-nontrivial changes, **budget mode** (v3.7) keeps the adversarial shape at ~20–25% of the cost — see [Where the money actually goes](#-where-the-money-actually-goes-measured--and-budget-mode).
- **Temporal reasoning.** Despite explicit checks, temporal scope verification (e.g., "excludes Christmas" with multi-year data) remains the hardest class of bug for panels to catch reliably.
- **Privacy & network.** Reviewed content is subject to Claude Code's data-handling policy. The deep-research mode and Phase 11 web-verification step make outbound HTTPS requests; both can be skipped if you stay in default mode and review proprietary code. The plugin itself sends no telemetry; all three output files are written locally and never transmitted by the plugin.
- **Output location.** All three files are written to your Claude Code session's current working directory and overwrite any prior `review_panel_*` files there. Filenames are not configurable. Run one panel at a time per directory.

## Reading the Report

The panel produces three files per run; here's how to read them.

**Vocabulary.** This README uses these words consistently:

| Term | Means |
|---|---|
| **plugin** | The marketplace package you install (`roundtable`) |
| **skill** | A shipped behavior loaded by Claude Code; this plugin bundles two (`agent-review-panel`, `plan-review-integrator`) |
| **reviewer** | One persona in the panel (e.g. Clarity Editor, Devil's Advocate). 4–6 reviewers per run |
| **agent / subagent** | The Claude Code launch mechanism used to spawn each reviewer in parallel — not a synonym for "reviewer" or "skill" |
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
| `[WEB-VERIFIED]` / `[WEB-CONTRADICTED]` / `[WEB-INCONCLUSIVE]` | External fact confirmed / contradicted / unconfirmed by an authoritative web source |
| `[CMD_CONFIRMED]` / `[CMD_CONTRADICTED]` | Reviewer's `verification_command` (read-only grep/cat/head) was run and the result confirmed/contradicted the claim |
| `[LIVE-VERIFIED]` | Live-infrastructure/runtime-state claim backed by `describe`-class command output (`gcloud describe`, `bq show`, `kubectl get`, etc.) |
| `[STATIC-INFERENCE]` | Live-state claim inferred from source/config/deploy scripts only — capped at P1 |
| `[STATIC-INFERENCE-CONSENSUS]` | Multiple reviewers agreed off the *same* artifact lines — counts as one source, not independent verification |
| `[JUDGE-HALLUCINATED]` | The post-judge gate caught a finding the judge introduced that the panel never raised and ground-truth contradicted — heavily discount |
| `[COMPRESSED]` | Suffix on every action item when the pre-judge gate detected unrecoverable phase loss; the run is lower confidence — re-run for a full report |

**Defect type.** Code/plan reviews additionally label findings as `[EXISTING_DEFECT]` (bug exists right now) or `[PLAN_RISK]` (risk only materializes if the plan is implemented as written). P0 severity requires `[EXISTING_DEFECT]` evidence.

**How to read in priority order.** Start with the Executive Summary, then the Action Items table (sorted P0 → P3). Use the HTML dashboard's filter bar to narrow by severity or epistemic label. Read the process history (`review_panel_process.md`) only when you need to see *why* a finding got a particular ruling. For findings that look wrong, scrutinise the epistemic label first — see [TROUBLESHOOTING.md → A finding looks wrong](TROUBLESHOOTING.md#a-finding-looks-wrong-or-overstated).

## Bundled skills

The `roundtable` plugin ships **two skills** in one install:

| Skill | Source | What it does | When to use |
|---|---|---|---|
| `agent-review-panel` | [`skills/agent-review-panel/`](skills/agent-review-panel/) | Multi-agent adversarial review panel | When you need a structured review of code, plans, docs, or configs |
| `plan-review-integrator` | [`skills/plan-review-integrator/`](skills/plan-review-integrator/) | Takes review panel output and integrates findings into a plan with traceability | After a panel review of a plan document |

Both are activated by natural language or by `/roundtable:agent-review-panel` and `/roundtable:plan-review-integrator`.

<details>
<summary>Why is the plugin named <code>roundtable</code> and not <code>agent-review-panel</code>?</summary>

`roundtable` is a collective noun for the bundle. It also reads more naturally in slash-command form. `plan-review-integrator` was previously published as a standalone repo at `wan-huiyan/plan-review-integrator` — that repo is archived in favor of this bundle.
</details>

## Tests

The test suite (529 tests) uses Node's built-in test runner — zero dependencies, requires Node ≥18:

```bash
npm test                    # run all 529 tests
npm run test:triggers       # trigger classification
npm run test:manifest       # manifest consistency + phase/opus enforcement
npm run test:eval-suite     # eval suite integrity
npm run test:report         # report structure validation
npm run test:behavioral     # behavioral assertion framework
npm run test:golden         # golden-file structural snapshots
```

Tests enforce key invariants: all 16 top-level phases (plus 13.5 / 14.5) present in `SKILL.md`; every `subagent_type:` launch co-occurs with `model: "opus"`; Phase 15.3 spec documents all 10 expandable-card sections; the canonical `SKILL.md` lives at `skills/agent-review-panel/SKILL.md`.

## Updating

New releases land on `main`; Claude Code does not auto-pull. From your terminal:

```bash
claude plugin marketplace update agent-review-panel
claude plugin update roundtable@agent-review-panel
```

(REPL form: `/plugin marketplace update agent-review-panel` then `/plugin update roundtable@agent-review-panel`.)

**Verify the update.** The installed version is the directory name under `~/.claude/plugins/cache/agent-review-panel/roundtable/`. Compare it against the canonical version in this repo's [`package.json`](package.json) or the top entry of [`CHANGELOG.md`](CHANGELOG.md). Note that GitHub releases may lag `main` — `package.json` is the authoritative version source.

If the update appears to work but old behavior persists, a stale local clone may be shadowing the marketplace install — see [TROUBLESHOOTING.md → Old version keeps loading](TROUBLESHOOTING.md#old-version-keeps-loading-after-claude-plugin-update).

## Migration

If you installed before v3.0 or under an older marketplace handle (`@wan-huiyan-agent-review-panel`, `@plugin`, or the bare `@agent-review-panel`), see [MIGRATION.md](MIGRATION.md) for the uninstall + clean-install recipe and a stale-state cleanup prompt you can paste into Claude Code.

## Troubleshooting

Common problems and their fixes live in [TROUBLESHOOTING.md](TROUBLESHOOTING.md). The most-hit entries:

- [After install, slash command not recognized](TROUBLESHOOTING.md#after-install-roundtableagent-review-panel-is-not-recognized) — restart Claude Code first
- [No output files appeared](TROUBLESHOOTING.md#the-panel-ran-but-no-output-files-appeared) — they go to the session's cwd
- [Old version keeps loading](TROUBLESHOOTING.md#old-version-keeps-loading-after-claude-plugin-update) — a loose clone is shadowing the marketplace install
- [A finding looks wrong](TROUBLESHOOTING.md#a-finding-looks-wrong-or-overstated) — read its epistemic label first

## Support

Bug reports, questions, and feedback: open a [GitHub issue](https://github.com/wan-huiyan/agent-review-panel/issues). When filing a bug for a failed or weird review, include the content type (code/plan/docs), approximate size, and (if you can) the `review_panel_report.md` and `review_panel_process.md` files — they make repro practical.

## Contributing

Contributions welcome. Especially useful:

- **Cursor adaptation** — adapting the Agent tool calls to Cursor's subagent mechanism
- **New domain checklists** — adding signal groups beyond the current 10
- **Benchmark cases** — real-world review scenarios for the eval suite

**Dev setup:**

```bash
git clone https://github.com/wan-huiyan/agent-review-panel.git ~/projects/agent-review-panel-dev
cd ~/projects/agent-review-panel-dev
npm test                            # requires Node ≥18
bash scripts/release-check.sh       # pre-release doc-drift detector
```

The authoritative skill is `skills/agent-review-panel/SKILL.md`. Manifest invariants (phase count, force-opus, HTML-card schema, marketplace-name callout marker) are enforced by `tests/manifest-consistency.test.mjs` and `scripts/release-check.sh` — both must stay green. See [HOW_WE_BUILT_THIS.md](HOW_WE_BUILT_THIS.md) for the design journey. Open an issue to discuss before submitting large PRs.

## Uninstalling

```bash
claude plugin uninstall roundtable@agent-review-panel
claude plugin marketplace remove agent-review-panel
```

(REPL form: `/plugin uninstall roundtable@agent-review-panel` and `/plugin marketplace remove agent-review-panel`.)

For a fully clean uninstall that removes cached state and any shadow clones, see [MIGRATION.md → Stale-state cleanup](MIGRATION.md#stale-state-cleanup-when-uninstall-isnt-enough). Manual-clone installs: `rm -rf ~/.claude/skills/agent-review-panel`.

## Research foundations

Agent Review Panel is grounded in [9 research papers and projects](docs/research-foundations.md) on multi-agent debate and evaluation quality.

**Mechanisms directly mapped to architecture:**

- **ChatEval (ICLR 2024)** → Phase 7 Blind Final — each reviewer commits a final verdict in writing before seeing peers' finals.
- **MachineSoM (ACL 2024)** → Phase 4 Private Reflection — `tf/ft/tt/ff` conformity tracking makes Phase 5 position flips detectable as signal.
- **Trust or Escalate (ICLR 2025 Oral)** → judge `Verdict Confidence: High|Medium|Low` field; low-confidence verdicts get `⚠️ HUMAN REVIEW RECOMMENDED`.
- **DMAD (ICLR 2025)** → distinct `reasoning_strategy` per persona injected into Phase 3 prompts.

**Papers and projects that informed the design** (without 1:1 architecture mapping): AutoGen (multi-agent orchestration patterns — note: AutoGen is a Microsoft research project, not a peer-reviewed paper), Du et al. (ICML 2024), DebateLLM, "Talk Isn't Always Cheap" (ICML 2025) for failure-mode analysis, CONSENSAGENT (ACL 2025) for sycophancy detection.

The cited papers validate multi-agent debate on reasoning benchmarks; this project has not independently benchmarked review quality. The full table with venues, links, and per-paper contributions lives in [`docs/research-foundations.md`](docs/research-foundations.md). Also inspired by [MiroFish](https://github.com/666ghj/MiroFish) for heterogeneous-persona patterns. See [ROADMAP.md](ROADMAP.md) for the research roadmap.

## Version history

See [CHANGELOG.md](CHANGELOG.md) for detailed version history and [ROADMAP.md](ROADMAP.md) for deferred items.

| Version | Highlights |
|---|---|
| **v3.9** | **Reviewer addressing contract** — persistent reviewers are addressed by the `agentId` from their spawn result (a nameless subagent has no other address), and a `SendMessage` returning `success: false` is a failed agent, not a delivered message. Plus: the fresh-spawn fallback now reads its own prior state files, and a reviewer that could not see the code writes a BLOCKED file instead of its phase file so the Phase 13.5 gate catches it rather than counting it as a clean vote. **v3.9.1:** the debate-in-Workflow recipe no longer teaches a silently degraded run — it declares itself a compressed run, stamps a `COMPRESSED RUN` banner, and requires five stages including budget mode's consolidated verifier and a terminal Report stage that IS Phase 15.1 |
| **v3.8** | **Orchestrator Efficiency Discipline** — the quality-free part of the turn diet becomes the default for *every* mode: persistent reviewers via SendMessage, batched launches, ≤50-word agent returns, no inter-phase narration, ≤40-turn target (measured pre-discipline run: 157 turns = 69% of cost). No review, debate, or verification work removed |
| **v3.7** | **Budget mode** — explicit opt-in reduced-cost profile (~20–25% of full-run cost), targeting *measured* cost drivers: orchestrator turn diet (the measured 69%), 3 sonnet reviewers + opus judge, single debate round, consolidated verification, markdown-only output, `[BUDGET-MODE]` banner |
| **v3.6** | **Assessment mode** — quality *discrimination* for subjective deliverables (vs defect-finding): subtract-points + veto, swap test, out-of-band currency check, and the **control-validation gate** (drop personas that can't beat a no-input control) |
| **v3.5** | Loud `[NO-DEBATE]` banner — a debate-less run announces itself (Phase 15.1 chokepoint + Phase 13.5 assertion) instead of passing silently |
| **v3.4** | VoltAgent catalog expansion — 30 new signal→specialist mappings (130+ agents / 10 families) + drift-detection automation (vendored catalog snapshot, CI gate) |
| **v3.3** | Live-State Claim Discipline — cross-cutting rule set for findings asserting facts about *live* infrastructure or runtime state |
| **v3.2** | Post-judge verification gate + Chart.js wrapper-div mandate — Phase 14.5 re-verifies judge-introduced P0/P1 against ground truth |
| **v3.1** | Silent-phase-compression fix — file-based subagent state under `state/`, Phase 13.5 Pre-Judge Verification Gate |
| v3.0 | Single-plugin layout (BREAKING) — one plugin (`roundtable`) bundling both skills |
| v2.16 | Plugin layout + marketplace bundle |
| v2.15 | Expandable 10-section issue cards in HTML dashboard; Prism.js syntax highlighting; deep-linking |
| v2.14 | Data Flow Trace (3 tiers); Multi-Run Union Protocol + Phase 16 Merge; force-opus on all launches |
| v2.13 | Persona profiles in process history + Panel Gallery in HTML dashboard |
| v2.12 | Triple output: primary + process history + interactive HTML dashboard |
| v2.11 | Verification round: tiered persona-matched agents per dispute |
| v2.10 | Codebase state check — prevents false "missing code" findings in worktrees |
| v2.9 | VoltAgent specialist agent integration |
| v2.8 | Auto Precise/Exhaustive mode, verification commands, tiered knowledge mining |
| v2.7 | Severity verification, defect classification, temporal scope checks |
| v2.5 | Trust layer: claim verification, epistemic labels, scope disclosure |
| v2.0 | Completeness auditor, new discovery requirement |
| v1.0 | Initial release: multi-agent review with debate and judge |

## License

[MIT](LICENSE) — Huiyan Wan. Reports you generate are yours; the HTML dashboard loads Tailwind, Chart.js, and Prism.js from CDN — all MIT-licensed.

## Acknowledgements

- Inspired by [MiroFish](https://github.com/666ghj/MiroFish) — influenced auto-persona detection and persona-matched verification agents
- Eval suite improved using [schliff](https://github.com/Zandereins/schliff)
- See [HOW_WE_BUILT_THIS.md](HOW_WE_BUILT_THIS.md) for the design journey

**External contributors** — thank you!

- [@okuuva](https://github.com/okuuva) — [#30](https://github.com/wan-huiyan/agent-review-panel/pull/30) restructured the plugin to the canonical nested skills layout for Claude Code ≥2.1.112 manifest validation
