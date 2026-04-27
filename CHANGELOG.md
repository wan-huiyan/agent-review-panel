# Changelog

All notable changes to Agent Review Panel.

## [3.1.0] — 2026-04-27 — silent-phase-compression fix (#35)

### Fixed — silent compression of mandatory Phases 4 / 5 / 7

Under context-budget pressure, the v3.0.0 orchestrator silently inlined Phases 4 (private reflection), 5 (debate rounds), 6 (round summaries), and 7 (blind final assessments) into the Supreme Judge step, producing deliverables indistinguishable from full runs. Empirical cost measured at 6 net-new findings (including 1 P0 FERPA / Anthropic-DPA gap) missed by a compressed run versus the corrective full-run review on the same input. Fixes [#35](https://github.com/wan-huiyan/agent-review-panel/issues/35).

### Architectural changes

- **File-based subagent state.** All Phase 3 / 4 / 5 / 7 / 8 / 10 / 11 / 14 outputs now write to `state/<file>.md` under the review output directory; subagents return only `{path, 100-word summary}` rather than verbatim review content. Eliminates the orchestrator-context bloat (~75k tokens per phase × 6 phases) that drove silent compression. Multi-run mode namespaces under `state/run_<N>/`.
- **Phase 13.5 — Pre-Judge Verification Gate (NEW).** Before launching the Supreme Judge, the orchestrator verifies all mandatory phase outputs exist on disk + meet a minimum-bytes threshold (≥500 B) + contain required schema headers. Single retry on failure; persistent miss triggers the COMPRESSED RUN warning rather than a silently incomplete report.
- **Phase 14 reads state on demand.** Launch prompt is ~200 tokens of paths; the judge uses the Read tool to load specific state files. Mirrors the v2.16.4 Phase 15.3 HTML-agent pattern. The judge's ruling materializes to `state/phase_14_judge_ruling.md` so Phase 15.1 can later consume it from disk.
- **`⚠️ COMPRESSED RUN` header in Phase 15.1.** When the gate detects unrecoverable phase loss, the markdown report begins with a fail-loud blockquote listing the skipped phases; every action item gains a `[COMPRESSED]` epistemic-label suffix. Phase 15.3 renders the same warning as a red HTML banner above the summary card.

### Tests

- New fixture: `tests/fixtures/sample-report-compressed-run.md` and golden snapshot `tests/golden/sample-report-compressed-run.golden.json`.
- `tests/report-structure.test.mjs` parser extended to extract `report.compressedRun.{detected, phasesSkipped}`.
- `tests/behavioral-assertions.test.mjs` gains a `v3.1.0 file-based state convention` describe block validating SKILL.md documents the new architecture.
- 379 / 379 tests pass.

### Breaking changes

None. The `state/` directory is net-new and may be `.gitignore`d if not desired in commits. Existing report consumers see unchanged report files for full runs and a leading warning blockquote for compressed runs.

### Design references

- Design doc: `docs/plans/2026-04-27-silent-phase-compression-fix-design.md`
- Implementation plan: `docs/plans/2026-04-27-silent-phase-compression-fix-plan.md`

## [3.0.0] — 2026-04-27

### Changed — Single-plugin layout (BREAKING) (PR #33)

Collapsed the multi-plugin marketplace into a single plugin that bundles both skills, mirroring the structure used by [obra/superpowers](https://github.com/obra/superpowers). Layout reasoning: when a marketplace ships exactly one plugin and that plugin bundles its skills, the extra `plugins/<name>/` nesting layer is pure ceremony. Removing it makes the install UX one command instead of two and keeps the auto-discovery convention from PR #30 intact (`<plugin-root>/skills/<skill-name>/SKILL.md`).

- `.claude-plugin/plugin.json` now lives at the repo root (was `plugins/agent-review-panel/.claude-plugin/plugin.json`).
- Skills moved to `skills/agent-review-panel/` and `skills/plan-review-integrator/` at the repo root (were nested under `plugins/<plugin-name>/skills/<skill-name>/`).
- `marketplace.json` reduced to a single plugin entry with `source: "./"`.
- `plugins/` directory deleted.

### Considered but rejected — Plugin rename revert (PR #32)

PR #32 proposed reverting the v2.16.2 rename `roundtable` → `agent-review-panel` so plugin / skill / marketplace all share one name (slash command would have become `/agent-review-panel:agent-review-panel`). Reasoning made sense under the multi-plugin layout (where `roundtable` was just one of two plugin names and the divergence created friction) but lost force under the single-plugin bundle: when one plugin holds N skills, a distinct bundle name *helps*. `roundtable` works as a collective noun for the bundle, and `/roundtable:agent-review-panel` reads as "the agent-review-panel skill of the roundtable" — meaningful — whereas `/agent-review-panel:agent-review-panel` would read as stutter. Decision: keep `roundtable`. PR #32's `release-check.sh` script is folded in (see below); the rename portion is shelved.

### Changed — Test discovery rewritten for single-plugin model

- `tests/manifest-consistency.test.mjs` — walks `skills/<name>/` under one root `plugin.json`. Marquee skill (where `name == plugin.name`) tracks `plugin.json` version exactly; other skills version independently.
- `tests/trigger-classification.test.mjs` — walks `skills/<name>/eval-suite.json`.
- `tests/eval-suite-integrity.test.mjs` and `tests/behavioral-assertions.test.mjs` — hardcoded paths updated from `plugins/agent-review-panel/...` to `skills/agent-review-panel/...`.
- 345/345 tests pass.

### Added — `scripts/release-check.sh` (folded in from PR #32)

Pre-release doc-drift detector. Asserts slash-command consistency, marketplace-name consistency, test-count accuracy, canonical-version match across 5 files, ROADMAP row presence, CHANGELOG section presence. Auto-detects plugin name from `plugin.json` so it stays correct across future renames. Run with `bash scripts/release-check.sh`.

### Migration

Pre-v3.0 install command that **no longer exists**:

```bash
claude plugin install plan-review-integrator@agent-review-panel  # GONE (skill is now bundled into roundtable)
```

New install (one command, both skills bundled):

```bash
claude plugin marketplace add wan-huiyan/agent-review-panel
claude plugin install roundtable@agent-review-panel
```

The install handle `roundtable@agent-review-panel` is unchanged from v2.16.2–v2.16.5.

### Bumped

- `package.json`: 2.16.5 → 3.0.0
- `.claude-plugin/plugin.json` (new at root): 3.0.0
- `.claude-plugin/marketplace.json` entry: 2.16.5 → 3.0.0
- `skills/agent-review-panel/eval-suite.json`: 2.16.5 → 3.0.0
- `skills/agent-review-panel/SKILL.md`: header `v2.16.5` → `v3.0.0`; HTML footer instruction updated to match
- `skills/plan-review-integrator/SKILL.md`: frontmatter `version: 2.0.0` → `2.0.1` (was drifted from its eval-suite.json which was already at 2.0.1)

### Notes

- This release supersedes the open PR #32. The `release-check.sh` script is folded in; the rename revert is rejected (see "Considered but rejected" above).
- PR #30's auto-discovery convention is preserved: skills still live at `<plugin-root>/skills/<skill-name>/SKILL.md` with no `skills` field declared in `plugin.json`.

## [2.16.5] — 2026-04-19

### Fixed — Plugin skills layout for Claude Code ≥2.1.112 manifest validation (PR #30)

Claude Code 2.1.112 rejected both `skills` field values the plugin had historically used: `["./"]` failed with *"Path escapes plugin directory"*, and `["SKILL.md"]` failed with *"Validation errors: skills: Invalid input"*. Neither value was portable across versions.

- **Restructured to canonical nested layout.** `SKILL.md` now lives at `plugins/<name>/skills/<name>/SKILL.md` and the `skills` field has been dropped from `plugin.json` entirely. Claude Code's default skill auto-discovery loads the skill without any manifest path declaration, sidestepping both validation bugs.
- Resolves #28.

### Thanks

- [@okuuva](https://github.com/okuuva) — first external contribution, via [#30](https://github.com/wan-huiyan/agent-review-panel/pull/30).

### Bumped

- `package.json`: 2.16.4 → 2.16.5
- `plugins/agent-review-panel/.claude-plugin/plugin.json`: 2.16.4 → 2.16.5
- `plugins/agent-review-panel/eval-suite.json`: 2.16.4 → 2.16.5
- `.claude-plugin/marketplace.json` (roundtable entry): 2.16.4 → 2.16.5
- `plugins/agent-review-panel/skills/agent-review-panel/SKILL.md`: header `v2.16.4` → `v2.16.5`; HTML footer instruction updated to match

---

## [2.16.4] — 2026-04-15

### Fixed — Phase 15.3 Reliability (HTML Report Generation)

Phase 15.3 (Interactive HTML Report) silently failed in most runs because the orchestrator's context window was near capacity after 14 phases, causing the subagent launch to fail.

- **Sequential Phase 15:** 15.1 → 15.2 → 15.3 (no longer parallel). Latency impact: ~2s.
- **Disk-reading data strategy:** Phase 15.3 agent reads `review_panel_report.md`, `review_panel_process.md`, and the rendering spec from `references/prompt-templates.md` directly. Orchestrator prompt drops from 700+ lines to ~10 lines.
- **Verification gate:** Mandatory file-existence check for all 3 output files before reporting completion. Auto-retry once if HTML is missing.
- **Manual recovery path:** "generate the HTML review report" launches the Phase 15.3 agent with the same disk-reading prompt, following the authoritative spec.
- **Path resolution:** Orchestrator resolves `{output_dir}` and `{skill_dir}` to absolute paths. Custom filenames handled.
- **Legacy language fix:** Updated `prompt-templates.md` Reference Inputs section to align with disk-reading strategy.
- **Version unification:** SKILL.md heading and HTML footer instruction now show the full semver (`v2.16.4`) instead of the bare major version (`v2.16`). Single source of truth: `plugin.json` version is the canonical version; SKILL.md heading and footer instruction must match it on every bump.

---

## [2.16.3] — 2026-04-09

### Added — External Domain Claim Web Verification in Phase 11

Motivated by a real gap in the PUMA GA4 audit: all 4 reviewers unanimously flagged "Data Retention set to 50 months confirms GA4 360" as P0, but none verified whether 50 months is even a valid GA4 setting. The existing Phase 13 Deep-tier web search only triggers for **unresolved disputes** — consensus P0 findings bypass it because there's no dispute to route.

- **Phase 11 step 5:** For each P0/P1, the severity verification agent now classifies whether the finding depends on external domain knowledge (product limits, API behavior, regulatory jurisdiction, pricing tiers, etc.). External claims get a web search (cap: 2 searches per claim, 5 claims max).
- **New labels:** `[WEB-VERIFIED]` (confirmed by authoritative source), `[WEB-CONTRADICTED]` (external source disagrees — auto-demotes severity by 1 level), `[WEB-INCONCLUSIVE]` (flagged for judge).
- **Regulatory/jurisdiction claims** (e.g., "GDPR applies to Mexico") are ALWAYS classified as external domain claims.
- **Extended severity verification table** now includes Domain Type, Web Result, Source URL, and Adjusted Severity columns.

In the PUMA audit, this would have auto-verified "50 months = GA4 360" via Google's Admin API docs and auto-demoted "GDPR applies to Mexico" via `[WEB-CONTRADICTED]`.

---

## [2.16.2] — 2026-04-08

### Fixed — Plugin layout bug that silently broke all marketplace installs
- **`plugins/<name>/.claude-plugin/plugin.json` now declares `"skills": ["./"]`.** Without this field, Claude Code's plugin loader does NOT auto-discover `SKILL.md` at the plugin root — it only looks in the default `skills/<name>/SKILL.md` sub-directory. Every install since PR #18 (v2.16) has been silently loading the plugin with ZERO registered skills. Users hit `Unknown skill: agent-review-panel` the first time they tried the slash command on a clean install, because the skill was never loaded in the first place. Empirically confirmed by `claude --debug --plugin-dir ./plugins/agent-review-panel` reporting no skills loaded on the pre-fix layout, and reporting both `agent-review-panel:agent-review-panel` and `plan-review-integrator:plan-review-integrator` loaded on the post-fix layout.
- **Why nobody noticed for two weeks:** users who previously had `~/.claude/skills/agent-review-panel/` from a pre-PR-#18 manual clone had that loose-skill install shadowing the broken marketplace install (exactly the stale-clone gotcha PR #19 documented). The plugin "worked" because the loose skill worked, not because the plugin did. Anyone who clean-installed for the first time hit the bug immediately.
- **Structural tests didn't catch it** because `tests/manifest-consistency.test.mjs` validates file structure and JSON schema, not actual plugin-loader behavior. We now know: `claude plugin validate` checks the manifest schema but doesn't tell you whether the skill will actually load — the only empirical check is `claude --debug --plugin-dir ./plugins/<name> --print "list skills"` and reading the loaded-skills list. Consider adding this as a test step in a future PR.

### Fixed — plan-review-integrator manifest schema error (inherited from upstream)
- `author: "wan-huiyan"` (string) → `author: {"name": "wan-huiyan", "url": "https://github.com/wan-huiyan"}` (object). The schema requires an object; the string form was an upstream bug that `claude plugin validate` now rejects.

### Fixed — README documented the wrong slash command
- All `/agent-review-panel` slash command references updated to `/agent-review-panel:agent-review-panel` (the namespaced form that plugin skills actually get). A new ⚠️ callout explains the `/<plugin>:<skill>` convention and reminds users that natural-language invocation works either way.

### Bumped
- `plugins/agent-review-panel/.claude-plugin/plugin.json`: 2.16.1 → 2.16.2
- `plugins/agent-review-panel/eval-suite.json`: 2.16.1 → 2.16.2
- `package.json`: 2.16.1 → 2.16.2
- `plugins/plan-review-integrator/.claude-plugin/plugin.json`: 2.0.0 → 2.0.1
- `plugins/plan-review-integrator/eval-suite.json`: 2.0.0 → 2.0.1
- `.claude-plugin/marketplace.json`: both entries bumped to match

## [2.16.1] — 2026-04-08

### Changed — Marketplace bundle (PR #22)
- **Renamed marketplace** `wan-huiyan-agent-review-panel` → `plugin`. Install command is now `/plugin install agent-review-panel@plugin` (was `@wan-huiyan-agent-review-panel`).
- **Bundled `plan-review-integrator` v2.0.0** as a second plugin in the same marketplace. The full review→integrate pipeline now ships from one repo. The old standalone `wan-huiyan/plan-review-integrator` repo is archived in favor of `/plugin install plan-review-integrator@plugin`.
- **Per-plugin `eval-suite.json`** — moved from repo root to `plugins/agent-review-panel/eval-suite.json` and added `plugins/plan-review-integrator/eval-suite.json`. Tests discover eval-suites under each plugin's directory; the multi-plugin manifest test iterates all plugins independently.
- **Refactored `tests/manifest-consistency.test.mjs` and `tests/trigger-classification.test.mjs`** to multi-plugin discovery. Each plugin's plugin.json, eval-suite.json, SKILL.md, and marketplace entry are validated independently. Red-test validation: drifting either plugin's `plugin.json` version produces ≥3 independent failures (eval-suite cross-version, marketplace cross-version, SKILL.md H1 header).
- **Cross-version assertions from PR #21** generalized for multi-plugin: the H1 header check (`# <title> v<major>.<minor>`) and HTML footer check are now run per-plugin and skip cleanly when a plugin's SKILL.md doesn't carry that pattern (e.g. plan-review-integrator has no HTML footer instruction).
- **Breaking change for existing installs.** Anyone who installed via `wan-huiyan-agent-review-panel` or `wan-huiyan-plan-review-integrator` must uninstall + reinstall under the new `@plugin` marketplace name. See README "Migration from previous marketplaces" for the exact commands.

### Bumped
- `plugins/agent-review-panel/.claude-plugin/plugin.json`: 2.16.0 → 2.16.1
- `plugins/agent-review-panel/eval-suite.json`: 2.16.0 → 2.16.1
- `package.json`: 2.16.0 → 2.16.1
- `plugins/plan-review-integrator/.claude-plugin/plugin.json`: 1.4.0 → 2.0.0 (major bump marks marketplace move; plugin behavior unchanged)
- `plugins/plan-review-integrator/eval-suite.json`: 1.0.0 → 2.0.0 (was upstream-drifted from plugin.json's 1.4.0 since the file's first commit; brought into lockstep here)
- `plugins/plan-review-integrator/SKILL.md`: header `v1.3` → `v2.0` (matched plugin.json)
- `.claude-plugin/marketplace.json`: top-level `name` renamed; plugin entries updated; new `plan-review-integrator` entry added

## [2.16.0] — 2026-04-07

### Changed — Plugin layout (PR #18)
- **Restructured to canonical `plugins/<name>/` layout** for Claude Code plugin marketplace compliance. The skill now lives at `plugins/agent-review-panel/SKILL.md` with the plugin manifest at `plugins/agent-review-panel/.claude-plugin/plugin.json`. The marketplace manifest moved from repo root to `.claude-plugin/marketplace.json`. The `source` field in `marketplace.json` now points to `./plugins/agent-review-panel` (previously `.`).
- **Fixed 3-layer plugin install bug:** root-level `marketplace.json` was silently ignored by `claude plugin marketplace add`; and `"source": "."` returned `Invalid schema: plugins.0.source`.
- **Marketplace name:** `agent-review-panel` → `wan-huiyan-agent-review-panel` (owner-prefixed for uniqueness across `wan-huiyan-*` marketplaces).
- Added `$schema` and top-level `description` to `marketplace.json`.
- Updated `manifest-consistency.test.mjs` and `trigger-classification.test.mjs` with canonical discovery helpers matching `wan-huiyan/causal-impact-campaign#11`.

### Fixed — README install command (PR #19)
- **Corrected marketplace name** in all install commands. The command `@agent-review-panel` failed silently after PR #18 renamed the marketplace — users who followed the README literally could not install the plugin. Fixed 3 broken instances (Quick Start, Installation §, Uninstalling §) to use `@wan-huiyan-agent-review-panel`.
- **Added `### Updating to the latest version` subsection** with the standard update flow, verification command, clean-reinstall fallback, and stale-local-clone troubleshooting. The stale-clone gotcha was the root cause of two users this week getting degraded output labeled "v2.15" but structurally generated by older skill versions — Claude Code loads `~/.claude/skills/` before the marketplace cache, so a pre-marketplace git clone silently shadows plugin updates.
- Corrected cache path in the verify command: `cache/<marketplace>/<plugin>/<version>/.claude-plugin/plugin.json` (not `cache/<marketplace>/plugins/<plugin>/...`) — the install process flattens the repo's `plugins/` intermediate directory and adds a version segment. Uses a `*` glob so users don't need to look up the version first. Caught by dogfooding a live install against the PR #19 branch.

### Fixed — README polish + version drift cleanup (PR #20)
- **Deduplicated install commands** — the same 2-line `/plugin marketplace add` + `/plugin install` block appeared verbatim in both Quick Start AND the "Claude Code marketplace (recommended)" subsection, creating reader confusion ("is one version different?"). Removed the duplicate from Installation § and replaced with a cross-link to Quick Start. Kept the CLI equivalent, the `@<marketplace-name>` callout, and the "Why the marketplace path?" explanation.
- **New `### Requires Claude Code` subsection at top of Installation §** — explicitly states this plugin does NOT work with the Claude desktop app, claude.ai web interface, or Claude API direct, with the reasons (no Agent tool, no subagent spawning, no `/plugin` surface) and a list of supported Claude Code environments (CLI, VS Code extension, JetBrains extension). Previously this requirement was buried in Prerequisites at line 299 where users didn't read before copy-pasting Quick Start.
- **Rebranded `skill` → `plugin` at the product level** (minimal sweep — 3 locations): the "Claude Code" badge now says "plugin" (not "skill"), the tagline reads "A Claude Code **plugin** that orchestrates..." (not "skill"), and a new blockquote immediately after the tagline clarifies: _"Packaged as a Claude Code plugin (containing the `agent-review-panel` skill)."_ Leaves the ~15 body mentions of "skill" alone because they correctly refer to the inner capability (e.g., "the skill auto-detects content type"), filesystem paths (`~/.claude/skills/`, `SKILL.md`), or unrelated contexts (Cursor section, Companion Skills section).
- **Version drift cleanup across non-canonical files:**
  - `package.json`: `2.15.0` → `2.16.0` (was silently drifted; no test guards this against `plugin.json`)
  - `eval-suite.json`: `2.15.0` → `2.16.0` (same silent drift)
  - `plugins/agent-review-panel/SKILL.md` line 34 header: `# Agent Review Panel v2.15` → `# Agent Review Panel v2.16` (product version header)
  - `plugins/agent-review-panel/SKILL.md` line 1076 HTML footer instruction: `"Agent Review Panel v2.15"` → `"Agent Review Panel v2.16"` with a parenthetical note that the footer should match the current product version from `plugin.json`, not the version that introduced the HTML features
- **Fixed stale "Both SKILL.md files" claim** in README Tests section (line 336) — pre-v2.16 leftover from when there was a root `SKILL.md` + `skills/agent-review-panel/` mirror. After PR #18, there's only one canonical `SKILL.md` at `plugins/agent-review-panel/SKILL.md`.
- Updated version references across test comments and table rows to mention v2.16 where appropriate. Feature-marker mentions of "v2.15" (e.g., _"new in v2.15 — expandable 10-section issue cards"_) correctly stay as-is because they describe when features were introduced.

### Full test coverage validated (PR #20)
All 7 test-plan items executed end-to-end using Chrome to render the PR branch README and click each anchor link:
- ✅ Badge renders "plugin" (orange)
- ✅ Blockquote on line 11 renders with vertical bar (not code)
- ✅ Anchor: `[details below](#requires-claude-code)` scrolls correctly
- ✅ Anchor: `[Quick Start](#quick-start)` scrolls correctly (from both link instances)
- ✅ Anchor: `[Updating](#updating-to-the-latest-version)` scrolls correctly
- ✅ Anchor: `[Manual clone](#manual-clone-development--custom-setup)` scrolls correctly (GitHub's double-hyphen slug for `/` works as predicted)
- ✅ `grep -c "agent-review-panel@wan-huiyan-agent-review-panel" README.md` returns 7 (was 8 before dedupe)
- ✅ All 16 remaining "skill" mentions in README body are contextually correct

## [2.15.0] — 2026-04-07

### Added
- **Expandable 10-section issue cards in Phase 15.3 HTML report.** Each issue card is a native `<details>` element that expands to reveal a nested accordion with 10 sections: 📖 Narrative (full reviewer reasoning, verbatim), 📄 Code Evidence (Prism.js-highlighted snippets with file:line headers), 👥 Raised by (per-reviewer rating + reasoning), 🔍 Verification Trail (full VR agent output), 💬 Debate (round-by-round transcript), ⚖️ Judge Ruling, 🛠️ Fix Recommendation (proposed change + before/after code + regression test + blast radius + effort), 🔗 Cross-references (related findings with relationship labels), 🏷️ Epistemic Tags (hover tooltips), 📊 Prior Runs (meta-review comparison).
- **8 new REQUIRED fields** in the Phase 15.3 schema per action item: `narrative`, `codeEvidence`, `reviewerRatings`, `debateTranscript`, `judgeRuling`, `fixRecommendation`, `crossRefs`, `priorRuns`. Empty arrays/null acceptable but the field must be present. Empty sections render "No {section} data" placeholders so every card has consistent structure.
- **Phase 15.2 process history passed as Reference Input to Phase 15.3** — the HTML agent now receives the verbatim process history alongside the summarized report, enabling it to extract real narratives, debate exchanges, and judge rulings per finding. Token cost: ~10–20KB per review.
- **Deep-link support** — `report.html#issue-A1` auto-opens the matching card, scrolls to it, and pulses a highlight ring.
- **Keyboard navigation** — ↑/↓ between cards, Enter/Space expands, Home/End jump to first/last, `/` focuses search.
- **Expand all / Collapse all** buttons at the top of the Issues tab (operates on visible cards only).
- **Print-friendly `@media print` CSS** — forces all details open, inverts dark theme, hides charts and filters, sets `page-break-inside: avoid` per card.
- **Prism.js CDN dependency** (new) — `https://cdn.jsdelivr.net/npm/prismjs@1.29.0` for syntax highlighting. Uses prism-tomorrow theme + autoloader plugin. Graceful fallback to unstyled `<pre>` if CDN unreachable.
- **Soft 500KB size cap** with optional slim mode that drops verbatim `fullEvidence` and `debateTranscript` when exceeded.
- 4 new manifest-consistency tests: 10-section spec coverage, 8 new schema fields present, Prism.js documented, SKILL.md mentions v2.15 features.
- v2.15 eval-suite category + coverage describe block + 3 new triggers.

### Motivation
A compliance gap in the v2.13 nice-shtern sample: the Phase 15.3 HTML rendered 22 flat issue cards with no expand mechanism, even though the prompt template already specified a "▶ View evidence" button. Root cause: the schema only populated rich evidence fields for findings that went through Phase 13 verification. For non-verified findings, the HTML agent had nothing to expand, so it silently omitted the expand button entirely — degrading the whole UX to one-liner cards. v2.15 fixes this by making all 8 deep-detail fields required (with empty-placeholder rendering) and routing Phase 15.2 content into Phase 15.3.

## [2.14.0] — 2026-04-07

### Added
- **Phase 2: Data Flow Trace** — a dedicated agent traces data through the critical path(s) of the work BEFORE reviewers begin, targeting composition defects (two individually-correct functions producing incorrect results together — the `apply_date_mask` + `prep_df` class of bug). Uses Meta's semi-formal certificate prompting (2026, 78%→93% accuracy): at each function boundary, produce INPUT_SCHEMA → TRANSFORM → OUTPUT_SCHEMA → COMPOSITION_CHECK → INVARIANT_STATUS. Five mandatory invariant checks: schema preservation, transform/back-transform completeness, row count stability, null semantics, temporal consistency. Three user-selectable tiers: **Standard** (default, single path, ~5 min), **Thorough** (top 3 paths + completeness checks, ~15 min), **Exhaustive** (all paths, no token limit, aims to catch all bugs). Skipped for pure docs/plans or code with no data transforms.
- **Multi-Run Union Protocol + Phase 16: Merge** — invoke `--runs N` or "run 3 times and merge" to execute the panel N times with rotated persona compositions, then merge via Phase 16. Rotation: Run 1 = standard base, Run 2 = complementary (Code Quality Auditor + Performance Specialist + Methodology Analyst + DA), Run 3 = adversarial-heavy (3 DAs with different reasoning strategies + Correctness Hawk), Run 4+ cycles. **Key rule:** content classification runs ONCE (Run 1) and is reused — eliminates the primary source of cross-run variance documented in the v2.10 consistency analysis. Phase 16 deduplicates by location + bug class, scores stability as `[K/N RUNS]`, uses highest severity when runs disagree, resolves judge divergence.
- **Force `model: "opus"` on all launches** — fixes a silent bug introduced in v2.9: the skill said "all agents use opus" but the VoltAgent Step 4 launch instructions omitted the model parameter, causing agents to fall through to their frontmatter-declared default model (potentially sonnet or haiku). Now ALWAYS pass `model: "opus"` explicitly alongside `subagent_type`. New `manifest-consistency` test greps all `subagent_type:` launches and asserts `model: "opus"` on the same line.
- **Two new checklists** in `references/signals-and-checklists.md`: Transform/Back-Transform Completeness (8 items) + Data Flow Invariants (8 items). Used by the Phase 2 Data Flow Tracer.
- **Two new prompt templates** in `references/prompt-templates.md`: Phase 2 Data Flow Tracer (~90 lines), Phase 16 Merge Agent (~60 lines).

### Changed
- **Integer phase renumbering** — all phases renumbered from decimal hierarchy (1, 2, 2.5, 3, 3.5, 4, 4.5, 4.55, 4.6, 4.7, 4.8, 4.8a, 4.8b, 4.9, 5, 6, 6.1, 6.2, 6.3) to sequential integers (1–16). Phase 15 retains sub-phases 15.1/15.2/15.3 as parent "Output Generation" because those represent parallel output generation. Phase 12 retains sub-parts 12a and 12b (two-step tier assignment pipeline).

### Motivation
Two identical panel runs on the same Schuh webapp (v2.10) produced only ~30% finding overlap, each missing a different P0 bug. Root causes: (1) LLM-driven content classification produces different persona compositions, (2) single-run coverage catches only ~60-70% of discoverable issues, (3) composition/seam bugs require dedicated tracing — no prior phase targeted this bug class, (4) silent model mixing via VoltAgent `subagent_type` without explicit `model: "opus"` override.

## [2.13.0] — 2026-04-03

### Added
- **Persona profiles surfaced in both process history and HTML dashboard.** Every agent now has a structured profile: role, agreement intensity (panelists), reasoning strategy, domain focus, agent type (VoltAgent or generic), matched-claim-type (Phase 13 agents), phases active.
- **Phase 15.2 (Process History):** Persona Profiles Registry at the top listing all agents, plus inline profile blocks immediately before each agent's first output.
- **Phase 15.3 (HTML):** Panel Gallery section with three sub-groups — Panel Reviewers (avatar cards, click to filter issues), Verification Specialists (linked to dispute points), Support Agents (compact cards with phase badges). Issue cards show "Raised by" avatar chips and verification agent persona in the expanded evidence panel. Cross-linking: clicking a persona chip scrolls to and highlights that agent's card in the Panel Gallery.

## [2.12.0] — 2026-04-03

### Added
- **Triple output format.** Phase 6 restructured from 1 → 3 output files:
  1. **`review_panel_report.md`** — existing primary report (unchanged)
  2. **`review_panel_process.md`** — verbatim "director's cut" of every agent's output in chronological order. Orchestrator-assembled, no new agent needed.
  3. **`review_panel_report.html`** — interactive dashboard generated by a dedicated Opus agent. Tailwind CSS + Chart.js via CDN. Stats row, three charts (confidence distribution, tier breakdown, verdict breakdown), filterable/sortable issue cards with expandable evidence panels, collapsible consensus/disagreement sections.
- Phase 6.1 runs first; 6.2 (orchestrator write) and 6.3 (Opus agent) run in parallel.

## [2.11.0] — 2026-04-03

### Added
- **Phase 4.8: Verification Tier Assignment** — a two-step pipeline. 4.8a (no agent): orchestrator derives initial tiers from Phase 2.5 confidence ratings + debate round signals. Low-confidence or multi-round unresolved → Deep; mixed → Standard; all-high + simple fact → Light. 4.8b (Opus agent): reviews the draft and overrides where signals are misleading.
- **Phase 4.9: Targeted Verification Agents** — one agent per dispute, launched in parallel. Persona-matched to claim type (statistical → Data Scientist, code correctness → Code Reviewer, security → Security Auditor). VoltAgent specialists preferred when available. Tiered budgets: Light ~2k tokens (read-only), Standard ~8k (multi-file), Deep ~32k (web search). Verdicts: `[VR_CONFIRMED]`, `[VR_REFUTED]`, `[VR_PARTIAL]`, `[VR_INCONCLUSIVE]`, `[VR_NEW_FINDING]`.
- **Phase 5 judge updated** to receive the Verification Round Summary as 8th input. Step 2 ("Rule on Each Disagreement") now gives significant weight to VR verdicts.
- Inspired by [MiroFish](https://github.com/666ghj/MiroFish)'s heterogeneous agent architecture — distinct agent personalities matched to tasks based on the task's domain characteristics.

## [2.10.0] — 2026-03-30

### Added
- **Codebase State Check (Phase 1, Step 3c)** — Detects worktree/branch divergence before review begins. Prevents the panel from flagging code as "missing" when it exists on main but not in the reviewed branch. Motivated by a real engagement where 4 reviewers + completeness auditor unanimously flagged a class as "non-existent" — but it existed on `main` (merged via a PR after the worktree branched).

## [2.9.0] — 2026-03-28

### Added
- **VoltAgent Integration** — Maps panel personas to 127+ VoltAgent specialist agents across 10 families (qa-sec, data-ai, infra, lang, domains, etc.) for deeper domain-specific reviews. Falls back to generic persona-prompted agents when VoltAgent isn't installed.
- Full mapping table for core personas, signal-detected specialists, and orchestration phases.
- Installation suggestion (once per session) when beneficial VoltAgent agents are missing.

## [2.8.0] — 2026-03-25

### Added
- **Review Mode Detection** — Auto-detects review mode from content type: Precise (code — requires line citations), Exhaustive (plans/docs), or Mixed. In Precise mode, findings without code citations cannot exceed P2.
- **Phase 4.55: Verification Command Execution** — Runs up to 5 read-only verification commands (grep/cat/head/tail/wc only) from P0/P1 findings. Annotates findings with [CMD_CONFIRMED], [CMD_CONTRADICTED] (demotes 1 level), [CMD_INCONCLUSIVE], or [CMD_FAILED]. Advisory, not gating.

## [2.7.0] — 2026-03-22

### Added
- **Phase 4.7: Severity Verification** — Dedicated agent reads the actual codebase to verify every P0 and P1 finding before the judge sees them. Classifies each as [EXISTING_DEFECT] or [PLAN_RISK]. P0 severity requires [EXISTING_DEFECT]; a [PLAN_RISK] is at most P1. Motivated by v2.6 benchmark where 2/3 P0 findings were overstated after code investigation.

## [2.6.0] — 2026-03-18

### Changed
- **References directory** — Domain checklists, prompt templates, and changelog extracted to `references/` files. SKILL.md reduced from 1,331 to 340 lines (75% token reduction) while preserving all review methodology.
- **Explicit negative scope** — "When NOT to Use" section prevents false triggers on single code reviews, bug fixes, deployment tasks, and skill improvement requests.
- **Structured domain checklists** — Specialist reviewers use explicit checklist format producing systematic assessments.

### Validated
- A/B tested against v2.5 on a 1,132-line ML pipeline plan. Both reached identical verdict (4/10, "Needs Significant Revision") with the same core findings. v2.6 showed marginal improvements in checklist discipline and judge output structure.

## [2.5.0] — 2026-03-15

### Added
- **Phase 4.6: Claim Verification** — Dedicated agent verifies every reviewer line-number citation against actual source. Classifies as [VERIFIED], [INACCURATE], [MISATTRIBUTED], [HALLUCINATED], or [UNVERIFIABLE].
- **Epistemic labels** — Judge classifies every finding with confidence tags.
- **Scope & Limitations section** — Every report states what the panel cannot evaluate.
- **Correlated-bias disclaimer** — Flags when all reviewers converge (score spread < 2 points).

## [2.4.0] — 2026-03-12

### Added
- **Skill/Docs Portability signal group** — Auto-detects when reviewing skills or documentation claiming cross-platform applicability. Adds Portability Auditor with 7-item checklist. 9 signal groups total.

## [2.3.0] — 2026-03-08

### Added
- **Knowledge mining** — Mines feedback memories, project/global lessons, and skill insights before launching reviewers.
- **Built-in domain checklists** — 8 signal groups with pre-built review checklists.
- **Deep research mode** — Opt-in web research for domain best practices.
- 2 new signal groups: Cost/Billing and Data Pipeline/ETL (total: 8).

## [2.2.0] — 2026-03-05

### Added
- **Context gathering (Phase 1)** — Auto-scans sibling directories, traces imports/references, discovers existing safety mechanisms.
- **Reviewer suggestion qualifier** — Reviewers must state what safeguard would need to be absent.
- **Absent-safeguard check** — Judge verifies [CRITICAL] recommendations against existing safeguards.
- **Diverse reasoning strategies (DMAD)** — Each persona uses a different reasoning approach.
- **Anti-rhetoric guard** — Judge checks whether position changes were driven by evidence or eloquence.

## [2.1.0] — 2026-03-01

### Added
- **Auto-persona from content signals** — Keyword detection adds domain-specific reviewers up to 6 total.
- **Source-grounded debate** — Phase 3.5 summaries include inline code snippets for disputed points.

## [2.0.0] — 2026-02-25

### Added
- **Completeness Auditor** — Post-debate agent re-reads source line-by-line.
- **"New Discovery" requirement** — Each debate round requires agents to find at least one new issue.
- **Hybrid persona selection** — Mixed content always includes Code Quality Auditor.

### Fixed
- Discovery vs. argumentation problem from v1 — debate rounds no longer cause agents to stop finding new issues.

## [1.0.0] — 2026-02-15

### Added
- Initial release: multi-agent adversarial review with independent review, debate, and judge phases.
