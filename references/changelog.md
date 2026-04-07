# Changelog

## v2.14 (2026-04-07) — Data Flow Trace, Multi-Run Union, Force Opus, Integer Phase Renumbering

Motivated by a real consistency gap: two identical panel runs on the same Schuh webapp (v2.10) produced only ~30% finding overlap, each missing a different P0 bug. Root causes identified:

1. **LLM-driven content classification** produces different persona compositions across runs
2. **Single-run coverage** catches only ~60-70% of discoverable issues
3. **Composition/seam bugs** (two individually-correct functions producing incorrect results together) require dedicated tracing — no prior phase targeted this bug class
4. **Silent model mixing via VoltAgent** — the skill said "all agents use opus" but the VoltAgent launch instructions (added in v2.9) omitted `model: "opus"`, causing reviewers to fall through to the VoltAgent agent's default model (potentially sonnet or haiku)

### New Features

- **Phase 2: Data Flow Trace** — A dedicated agent traces data through critical path(s) before reviewers begin, targeting composition defects. Uses Meta's semi-formal certificate prompting (2026, 78%→93% accuracy): at each function boundary, produce INPUT_SCHEMA → TRANSFORM → OUTPUT_SCHEMA → COMPOSITION_CHECK → INVARIANT_STATUS. Five mandatory invariant checks: schema preservation, transform/back-transform completeness, row count stability, null semantics, temporal consistency. Three user-selectable tiers: **Standard** (default, single path, ~5 min), **Thorough** (top 3 paths + completeness checks, ~15 min), **Exhaustive** (all paths, no token limit, aims to catch all bugs). Data Flow Map is injected into Phase 3 reviewer prompts; violations flagged as P0 candidates. Skipped for pure docs/plans or code with no detectable transforms. Research foundations: Meta semi-formal reasoning (2026), LLMDFA (NeurIPS 2024), RepoAudit (ICML 2025), BugLens (ASE 2025), ZeroFalse (2025).

- **Multi-Run Union Protocol + Phase 16: Merge** — User can invoke `--runs N` or "run 3 times and merge" to execute the panel N times with rotated persona compositions, then merge results via Phase 16. Persona rotation: Run 1 = standard base, Run 2 = complementary (Code Quality Auditor + Performance Specialist + Methodology Analyst + DA), Run 3 = adversarial-heavy (3 DAs + Correctness Hawk), Run 4+ cycles. Content classification runs ONCE (Run 1) and is reused — this eliminates the primary source of cross-run variance. Phase 2 also runs once and is cached. Phase 16 deduplicates findings by location + bug class, scores stability as `[K/N RUNS]`, uses highest severity when runs disagree, resolves judge divergence. Single-run findings are NOT demoted. Per-run reports retained for audit trail.

- **Force `model: "opus"` on all launches** — Fixes a silent bug introduced in v2.9: the skill promised "all agents use opus" but the VoltAgent Step 4 launch instructions omitted the model parameter, causing launched agents to fall through to their frontmatter defaults. Now ALWAYS pass `model: "opus"` explicitly alongside `subagent_type`. New test in `manifest-consistency.test.mjs` catches future regressions. Applies to all VoltAgent launches including v2.11–v2.13 additions (Phase 12b Tier Refinement Advisor, Phase 13 Verification Agents, Phase 15.3 HTML Report Agent).

### Housekeeping

- **Integer phase renumbering** — All phases renumbered from decimal hierarchy (1, 2, 2.5, 3, 3.5, 4, 4.5, 4.55, 4.6, 4.7, 4.8, 4.8a, 4.8b, 4.9, 5, 6, 6.1, 6.2, 6.3) to sequential integers (Phases 1-16). Phase 15 retains sub-phases 15.1, 15.2, 15.3 as parent "Output Generation" because those represent parallel output generation. Phase 12 retains sub-parts 12a and 12b since they form a two-step tier assignment pipeline. All cross-references, prompt templates, and tests updated.

- **Two new checklists** in `references/signals-and-checklists.md`: Transform/Back-Transform Completeness (8 items) and Data Flow Invariants (8 items). Used by the Phase 2 Data Flow Tracer.

- **Two new prompt templates** in `references/prompt-templates.md`: Phase 2 Data Flow Tracer (~90 lines), Phase 16 Merge Agent (~60 lines).

- **Version harmonization** — `package.json`, `plugin.json`, `marketplace.json`, `eval-suite.json`, and both SKILL.md headers all bumped to 2.14.0.

### Phase Number Migration Reference

| Old (v2.13) | New (v2.14) | Name |
|-------------|-------------|------|
| 1 | 1 | Setup |
| — | **2** | **Data Flow Trace (NEW)** |
| 2 | 3 | Independent Review |
| 2.5 | 4 | Private Reflection |
| 3 | 5 | Debate |
| 3.5 | 6 | Round Summarization |
| 4 | 7 | Blind Final |
| 4.5 | 8 | Completeness Audit |
| 4.55 | 9 | Verify Commands |
| 4.6 | 10 | Claim Verification |
| 4.7 | 11 | Severity Verification |
| 4.8 | 12 | Verification Tier Assignment (with 12a, 12b) |
| 4.9 | 13 | Targeted Verification Agents |
| 5 | 14 | Supreme Judge |
| 6 (parent) | 15 | Output Generation (parent) |
| 6.1 | 15.1 | Primary Markdown Report |
| 6.2 | 15.2 | Process History |
| 6.3 | 15.3 | Interactive HTML Report |
| — | **16** | **Merge (multi-run, NEW)** |

### Expected Impact

Running a single panel now catches ~30-40% more findings via Phase 2 composition analysis. Running multi-run union (N=2) effectively eliminates the ~30% single-run blind spot. Force-opus eliminates the invisible model-mixing variance. All three changes compose with v2.11–v2.13's verification round and triple-output system to produce a maximally thorough review.

---

## v2.13 (2026-04-03) — Persona Profiles in Process History and HTML Dashboard

Every agent in the review now has a full persona profile, surfaced in both output files.

### Phase 6.2 (Process History) changes

A **Persona Profiles Registry** section appears at the top of `review_panel_process.md`
listing all agents before any outputs. Each profile block is also repeated inline
immediately before that agent's first output, making the log self-explanatory to a
reader who joins mid-document.

Profile fields per agent type:
- **Panelists**: role, agreement intensity, reasoning strategy (name + injection text),
  domain focus, VoltAgent subagent_type (or "generic"), domain-specific instructions
  injected (checklists, temporal scope checks, stale-branch warnings), phases active,
  action items raised
- **Phase 4.9 verification agents**: assigned role, matched-claim-type, matched_because
  (one sentence), VoltAgent or generic, tier + budget + capabilities, scope constraint,
  phases active (scoped to one dispute point)
- **Support agents** (auditor, claim verifier, severity verifier, tier advisor, supreme
  judge): role description, persona rationale, agent type, phases active

### Phase 6.3 (Interactive HTML) changes

**Panel Gallery section** (new, between Stats Dashboard and Charts — default collapsed):
Three sub-groups of avatar cards:

1. **Panel Reviewers** — one card per panelist with: colored avatar circle (unique color
   per persona), agreement intensity "🎯 X%", reasoning strategy name, items-raised count,
   phase badges. Clicking a card **filters the action items section** to items raised by
   that reviewer; active filter shows a dismissible banner above the list.

2. **Verification Specialists** (Phase 4.9 only) — one card per agent with: avatar,
   verified point reference, tier chip, claim-type label, verdict badge, and the
   `matched_because` rationale. Clicking scrolls to the linked action item.

3. **Support Agents** — compact cards for auditor, claim/severity verifiers, tier advisor,
   supreme judge — with phase badge and hover tooltip showing full role description.

**Issue card enhancements:**
- "Raised by" row below confidence bar: tiny avatar chips (matching Panel Gallery colors)
  for each reviewer who raised the item; clicking a chip activates the reviewer filter
- Expanded evidence panel now includes a verification agent persona mini-card (avatar,
  name, role, tier) with a "View agent profile ↑" link that scrolls to and highlights
  that agent's card in the Panel Gallery

**JavaScript additions:**
- `reviewData.personas`, `reviewData.verificationAgents`, `reviewData.supportAgents`
  arrays for all persona data
- `filters.reviewer` field in filter state; reviewer filter is AND-combined with others
- `renderPersonaCards()` function for Panel Gallery
- "View agent profile ↑" scrolls + highlights target card with a 2s ring animation

**Miscellaneous:**
- Footer updated from v2.12 → v2.13
- Panel Gallery default state: collapsed
- No-results message now includes "Clear filters ✕"

---

## v2.12 (2026-04-03) — Three Output Formats: Summary Report + Process History + Interactive HTML

Every review run now produces three output files instead of one:

### Phase 6.1: Primary Markdown Report (`review_panel_report.md`) — unchanged
The existing structured summary report. No behavior change.

### Phase 6.2: Full Agent Process History (`review_panel_process.md`) — NEW
A complete, verbatim "director's cut" of every agent's output in chronological
order. Nothing is summarized or elided. Covers:
- Phase 1 context brief and persona selection rationale
- All N independent reviews (verbatim)
- All N private reflections with per-finding confidence ratings (verbatim)
- All debate rounds + Phase 3.5 summaries (verbatim)
- All N blind final assessments
- Completeness audit, verification command results, claim verification,
  severity verification (all verbatim)
- Phase 4.8a confidence draft table with signals
- Phase 4.8b tier refinement advisor full output including overrides
- Each Phase 4.9 verification agent's full investigation trail: what was
  searched, what was found, full reasoning chain, verdict
- Supreme judge full deliberation (all steps 0–9, unabridged)

Orchestrator-assembled from accumulated outputs; no new agent needed.

### Phase 6.3: Interactive HTML Report (`review_panel_report.html`) — NEW
A polished, self-contained single-file interactive dashboard generated by a
dedicated Opus agent. Features:
- **Dashboard stats row**: issue counts by severity (P0–P3), by verification
  tier (Light/Standard/Deep), by verdict (VR_CONFIRMED/VR_REFUTED/etc.), panel
  score gauge
- **Three charts**: confidence distribution (grouped bar per reviewer),
  tier breakdown (donut), verdict breakdown (horizontal bar)
- **Issue cards**: each action item with severity stripe (color-coded), confidence
  bar indicator, epistemic label badge, verification verdict badge, click-to-expand
  full evidence panel (including VR_CONFIRMED/VR_REFUTED banners)
- **Filter bar**: simultaneous filter by severity, tier, verdict, epistemic label;
  live count; sort by severity/confidence/tier
- **Collapsible sections**: consensus points, disagreements with judge rulings
- Uses Tailwind CSS + Chart.js via CDN; vanilla JS only; no framework dependencies
- Graceful fallback if CDN unreachable (charts show placeholder, layout intact)

Prompt spec added to `references/prompt-templates.md` (Phase 6.3 section).

### Parallelism
Phase 6.1 runs first. Phases 6.2 (orchestrator, no agent) and 6.3 (Opus agent)
run in parallel after 6.1 completes.

### User notification
After all three files are written: paths to all three, verdict + score, issue
counts by verdict, top P0 action item, CDN dependency note for HTML file.

---

## v2.11 (2026-04-03) — Verification Round: Targeted Agents per Dispute Point

A dedicated verification round now runs between the panel debate and the Supreme
Judge. Instead of the judge resolving disputes solely from debate transcripts,
specialist agents investigate each unresolved point with calibrated depth before
the verdict.

### New: Phase 4.8 — Verification Tier Assignment (two-step pipeline)

Each unresolved dispute point and high-uncertainty action item (`[SINGLE-SOURCE]`,
`[DISPUTED]`, `[UNVERIFIED]`) is assigned a depth tier controlling the verification
agent's budget and capabilities. Generous budgets ensure thorough checks:

- **Light** — ~2k tokens, grep/read only, no web search. Factual claim checkable
  in a single file. Example: "Does the constant really equal 0.05 or 0.5?"
- **Standard** — ~8k tokens, multi-file analysis, no web search. Claim requires
  cross-file tracing. Example: "Does the rate-limiter handle concurrent requests?"
- **Deep** — ~32k tokens, web search + multi-round reasoning. External knowledge
  needed. Example: "Is this PRNG algorithm cryptographically appropriate here?"

**Assignment runs as a two-step pipeline (default: both steps):**

1. **Phase 4.8a — Confidence-Based Draft (no agent):** Orchestrator derives
   initial tiers from Phase 2.5 confidence ratings + debate round signals.
   Low-confidence or 2+ unresolved rounds → Deep; Medium/1 round → Standard;
   all High + checkable → Light. Produces a draft tier table.

2. **Phase 4.8b — Judge-Advised Refinement (Opus agent):** The advisor receives
   the confidence-based draft and reviews/overrides each tier. It works FROM the
   draft rather than cold — the confidence data gives it "ground-level" signal
   from reviewers who lived through the debate. The advisor's role is correction
   and oversight: upgrade where complexity is underestimated, downgrade where
   confidence scores were inflated by reviewer conservatism rather than genuine
   uncertainty. Also assigns verification persona per point.

   Quick mode (user-requested): skip Phase 4.8b and use the confidence-based
   draft directly.

### New: Phase 4.9 — Targeted Verification Agents

One agent per dispute point, launched in parallel. Each agent is:

1. **Persona-matched to claim type** — statistical claims go to a Data Scientist,
   code-correctness claims to a Code Reviewer, architecture to an Architect
   Reviewer, security to a Security Auditor, etc. VoltAgent specialists preferred
   when available.

2. **Tier-budgeted** — capabilities and token budget match the assigned tier.
   Deep agents can run web search; Light agents are strictly read-only.

Verification agents produce verdicts: `[VR_CONFIRMED]`, `[VR_REFUTED]`,
`[VR_PARTIAL]`, `[VR_INCONCLUSIVE]`, or `[VR_NEW_FINDING]`. Results compile into
a Verification Round Summary table passed to Phase 5.

### Updated: Phase 5 Supreme Judge

Judge now receives a 8th input: the Verification Round Summary. Step 2
("Rule on Each Disagreement") now explicitly incorporates Phase 4.9 verdicts.
A `[VR_CONFIRMED]` or `[VR_REFUTED]` verdict carries significant weight — it
represents targeted specialist investigation beyond what the panel performed.

### Updated: VoltAgent Orchestration Mapping

Added Tier Refinement Advisor (4.8b) and Verification Agents (4.9) to the
multi-agent orchestration mapping table.

**Skip condition:** If zero unresolved disputes and zero unverified action items
exist after Phase 4.7, Phases 4.8 and 4.9 are skipped entirely.

---

## v2.10 (2026-04-02) — Codebase State Check Prevents Worktree Staleness False Positives

See SKILL.md Phase 1 Step 3c for full details.

---

## v2.9 (2026-03-29) — VoltAgent Specialist Agent Integration

- **VoltAgent integration** — when [VoltAgent specialist agents](https://github.com/VoltAgent/awesome-claude-code-subagents) are installed (127+ across 10 families), the panel upgrades generic persona-prompted reviewers to domain-specific agents via `subagent_type`.
- **3-tier mapping** — core persona mapping (16 personas), signal-detected specialist mapping (35 content signals → language/domain agents), orchestration phase mapping (completeness audit, claim/severity verification).
- **Smart installation prompts** — suggests relevant `claude plugin install voltagent-*` commands when specialist agents would help but aren't installed. Non-blocking, once per session.
- **Graceful fallback** — all functionality works without VoltAgent; it's a transparent upgrade.
- **Credits:** [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) for the 127+ agent catalog across `voltagent-qa-sec`, `voltagent-data-ai`, `voltagent-infra`, `voltagent-lang`, `voltagent-core-dev`, `voltagent-biz`, `voltagent-domains`, `voltagent-meta`, `voltagent-dev-exp`, `voltagent-research`.

Born from real production use: 4 VoltAgent specialists reviewing a test plan produced 38 findings with <10% overlap vs generic persona agents.

---

## v2.8 (2026-03-26) — Severity Calibration, Coverage Check, Verify-Before-Claim, Precise/Exhaustive Mode

Motivated by panel review of 6 proposed changes (see `docs/archive/review_panel_report.md`).
Critical panel finding: all original proposals pushed findings downward with zero upward pressure.

- **Severity-dampening judge prompt** — Judge Step 0.5c: "What is the MINIMUM severity justified by concrete evidence?" Prompt edit, zero latency. (Datadog FP filtering)
- **Coverage check** (NEW — surfaced by panel) — Judge Step 0.5d: "Are there unexamined risk categories?" Flags [COVERAGE_GAP] areas. Counterbalances downward pressure.
- **Verify-before-claim (advisory mode)** — Phase 2 reviewers include `verification_command` for P0/P1. New Phase 4.55 runs up to 5 commands, annotates [CMD_CONFIRMED]/[CMD_CONTRADICTED]/[CMD_INCONCLUSIVE]/[CMD_FAILED]. Advisory, not gating. (Tool-MAD, CodeRabbit, Nexus)
- **Auto-detected Precise/Exhaustive mode** — Code → Precise (require line citations). Plans → Exhaustive (allow broader risk). Auto-detected, no toggle. Report header shows mode. (Qodo 2.0)

New research foundations: Tool-MAD (Jan 2026), Nexus (Oct 2025), CORE (Microsoft FSE 2024), SGCR (ASE 2025), Qodo 2.0.

---

## v2.7 (2026-03-26) — Severity Verification & Defect Classification

Motivated by S57 benchmark: 2/3 P0 findings were overstated after code investigation.

- **Phase 4.7: Severity Verification** — new Opus agent reads actual code for every P0/P1 finding before the judge. Produces severity verification table with Verified/Not-a-bug/Downgraded verdicts.
- **`[EXISTING_DEFECT]` vs `[PLAN_RISK]` labels** — P0 requires `[EXISTING_DEFECT]` (with code evidence). `[PLAN_RISK]` caps at P1.
- **Expanded safety mechanism discovery** — added `DELETE FROM`, `MERGE`, `upsert`, `idempoten`, `--dry-run`, `duplicate`, `assertion` to grep patterns. Explicit instruction: when a finding claims "X is missing", verify by grepping.
- **`[UNCITED]` flag** — findings without specific line numbers are tagged for review.
- **Judge references verification table** — Step 0 updated to review both claim verification AND severity verification.

### v2.8 Plan (panel-reviewed 2026-03-26)

Reviewed by a 4-reviewer panel (Feasibility Analyst, Stakeholder Advocate, Risk Assessor, Devil's Advocate). Original proposal had 6 changes; panel recommended shipping 3 + 1 new mechanism, deferring 3. See `docs/archive/review_panel_report.md`.

**Shipping in v2.8:**
1. **Severity-dampening judge prompt** — "What is the minimum severity justified by concrete evidence?" Prompt edit, zero latency. (Datadog FP filtering)
2. **Coverage check** (NEW — surfaced by panel) — Judge sub-step: "Are there unexamined risk categories given these changes?" Counterbalances the downward pressure of all other severity-reduction mechanisms.
3. **Verify-before-claim (advisory mode)** — agents include `verification_command` for P0/P1; orchestrator runs grep/read and annotates results. Failed verification demotes, does not delete. Max 5 verifications. (Tool-MAD 2026, CodeRabbit, Nexus)
4. **Auto-detected Precise/Exhaustive mode** — code reviews require concrete evidence; plan reviews allow broader risk. Auto-detected from input type, no user toggle. (Qodo 2.0)

**Deferred to v2.9:**
- **Three-tier finding classification** — Double-suppression risk with severity-dampening judge. Reassess after measuring #1's impact. (Blincoe et al. IST 2022)
- **Confidence scores (0-100)** — All 4 reviewers opposed user-facing numeric scores. LLMs poorly calibrated on self-assessed confidence. Keep diversity-aware retention as internal mechanism only. (ConfMAD EMNLP 2025, DAR March 2026)
- **Meta-Review "defend or retract"** — High token cost (16-42k), creates commitment bias. Fold useful part into judge step instead. (adversarial-review repo)

**Critical panel finding:** All 6 original proposals pushed findings downward (suppress, dampen, cap, gate) with zero upward pressure. The coverage check mechanism was added to counterbalance this systematic false-negative risk.

New research foundations: ConfMAD (EMNLP 2025), DAR (March 2026), Tool-MAD (Jan 2026), Nexus (Oct 2025), CORE (Microsoft FSE 2024), SGCR (ASE 2025).

---

## v2.6 (2026-03-25) — Not separately released; folded into v2.7

## v2.5 (2026-03-20) — Trust & Verification Layer
- **Phase 4.6: Claim Verification** — new agent verifies all reviewer line-number citations against source. Classifies as [VERIFIED], [INACCURATE], [MISATTRIBUTED], [HALLUCINATED], or [UNVERIFIABLE]. Inspired by SAFE pipeline.
- **Epistemic labels on all findings** — judge classifies every finding. Labels appear on action items so users know what to act on vs investigate.
- **"Scope & Limitations" section** — mandatory section stating what the panel cannot evaluate.
- **Correlated-bias disclaimer** — when score spread < 2 points, report notes unanimity may reflect shared model biases.
- **Updated judge prompt** — new Step 0 (Review Claim Verification) and Step 7 (Classify All Findings).
- Motivated by: applying AI Trust Evaluation Framework to the panel itself.

## v2.4 (2026-03-19)
- **New signal group: Skill/Docs Portability** — Portability Auditor persona (35% agreement). 9 signal groups total.

## v2.3 (2026-03-18)
- **Knowledge mining (Phase 1, Step 3.5)** — mines feedback memories, lessons, skill insights, CLAUDE.md.
- **Domain checklists** — built-in checklists for 8 signal groups. Auto-injected into persona prompts.
- **Deep research mode** — opt-in web research for domain best practices.
- **2 new signal groups** — Cost/Billing, Data Pipeline/ETL. 8 total.

## v2.2 (2026-03-18)
- **Diverse reasoning strategies** per persona (DMAD, ICLR 2025)
- **Anti-rhetoric guard** in judge prompt (ICML 2025)
- **Dynamic sycophancy intervention** (CONSENSAGENT, ACL 2025)
- **Judge confidence gating** (Trust or Escalate, ICLR 2025 Oral)
- **Context gathering (Phase 1)** — auto-scans for docs, imports, safety mechanisms
- **Absent-safeguard check** in judge prompt

## v2.1 (2026-03-17)
- Inline disputed snippets in summaries, auto-persona from content signals, prompt injection boundary, completeness auditor scope guidance

## v2 (2026-03-15)
- Completeness Auditor, hybrid personas, private reflection, agreement intensity, round summarization, conformity tracking

## Attribution

Based on: ChatEval (ICLR 2024), AutoGen, Du et al. (ICML 2024), MachineSoM (ACL 2024), DebateLLM, DMAD (ICLR 2025), "Talk Isn't Always Cheap" (ICML 2025), CONSENSAGENT (ACL 2025), Trust or Escalate (ICLR 2025 Oral).

v2.7+ also informed by: ConfMAD (EMNLP 2025), DAR (March 2026), Tool-MAD (Jan 2026), Nexus (Oct 2025), CORE (Microsoft FSE 2024), SGCR (ASE 2025), Qodo 2.0 benchmark, CodeRabbit AST-grep agent, adversarial-review repo, Hegelion, Block g3, InfCode.
