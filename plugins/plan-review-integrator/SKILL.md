---
name: plan-review-integrator
version: 2.0.0
author: wan-huiyan
description: >
  Integrate structured review panel findings into an implementation plan document.
  Takes output from agent-review-panel (or any structured review with severity-rated
  findings) and cross-references each finding against the plan, classifies it into
  an action category, applies concrete edits, and produces a traceability summary.
  Trigger when the user says "update the plan with review findings", "incorporate
  review feedback into the plan", "integrate review results", "apply review
  recommendations to the plan", "cross-reference review output against the plan",
  "merge review findings into the implementation plan", "what needs to change in the
  plan based on the review", "take the review panel output and update my plan",
  "reconcile the review feedback with the current plan", or invokes
  /plan-review-integrator. Does NOT trigger for running a review panel (use
  agent-review-panel), writing a plan from scratch, general code review, summarizing
  review findings without applying them, or brainstorming implementation approaches.
consumes_from: agent-review-panel
hands_off_to: implementation-executor
output_contract: >
  Returns: (1) updated plan document with edits applied, (2) traceability summary
  table mapping each finding to its disposition, (3) optional peripheral updates
  (ADRs, runbooks, memory files), (4) integration_log.jsonl append. Idempotent:
  re-running on the same review+plan produces the same result if no user overrides
  are applied.
---

# Plan-Review Integrator v2.0

Consumes structured review panel output and integrates findings into an
implementation plan document -- turning review feedback into concrete plan updates
with full traceability.

> **Key insight:** Review panels often identify correct *symptoms* but prescribe
> wrong *fixes* when they lack domain context. Always validate recommendations
> against domain-specific constraints before applying them.

---

## Quick Reference

| Stage | Phase | Action | Output |
|-------|-------|--------|--------|
| **Gather** | 1. Gather Inputs | Collect review reports + plan + domain context | Input set |
| | 2. VoltAgent Detection | Detect specialists, suggest install if beneficial | Available specialist map |
| **Analyze** | 3. Extract Findings | Parse findings with severity, source, citations | Structured finding list |
| | 4. Cross-Reference | Match each finding against plan content | Category per finding |
| | 5. Actionability Filter | Score actionability, drop low-signal findings | Filtered finding list |
| | 6. Classify | Assign action category (epistemic-weighted) | must-fix / bundle / defer / info |
| **Apply** | 7. Apply Edits | Edit plan document with rollback on coherence break | Updated plan |
| | 8. Verify | Re-read modified plan, check coherence | Verified plan or rollback |
| **Finalize** | 9. Update Peripherals | Update ADRs, runbooks, memory | Supporting docs |
| | 10. Produce Summary | Traceability table | Audit trail |
| | 11. Persistent Log | Append decisions to integration log | integration_log.jsonl |

---

## Phase 1: Gather Inputs

Collect three things:

1. **Review report(s)** -- file path, inline paste, or reference to prior conversation
2. **Plan document** -- markdown plan, design doc, RFC, or architecture proposal
3. **Domain context** -- memory files, config files, related docs, session history

Domain context is essential for validating reviewer recommendations. Do NOT skip it.

**Empty review guard:** If the review contains no actionable findings (clean pass),
produce no classifications and output: "No action items identified. Plan unchanged."
Skip Phases 3-8 and go directly to Phase 10 with a summary confirming the clean review.

---

## VoltAgent Specialist Verification (v1.3)

VoltAgent specialist agents (127+ across 10 families) have built-in domain
expertise via their system prompts. Unlike agent-review-panel (which replaces
reviewer personas with VoltAgent agents), this skill uses VoltAgent as an
**optional second-opinion verifier** for high-severity edits. The skill remains
single-agent; specialists are consulted, not orchestrated.
Full catalog: github.com/VoltAgent/awesome-claude-code-subagents

**Step 1: Detection.** During Phase 1 (Gather Inputs), scan the system-reminder
agent list for any `voltagent-*` prefixed agents. Note which families are
installed (e.g., `voltagent-data-ai`, `voltagent-infra`, `voltagent-lang`).
If none found, skip all VoltAgent steps silently -- everything works without them.

**Step 2: Content-signal routing.** Match plan content signals to specialists:

| Content Signal | VoltAgent Specialist | Verification Use |
|---|---|---|
| SQL / database queries | `voltagent-data-ai:database-optimizer` | Verify query correctness in must-fix edits |
| Data pipelines / ETL | `voltagent-data-ai:data-engineer` | Verify pipeline logic changes |
| ML / model training | `voltagent-data-ai:ml-engineer` | Verify model config / hyperparameter fixes |
| Python code | `voltagent-lang:python-pro` | Verify code snippet corrections |
| TypeScript code | `voltagent-lang:typescript-pro` | Verify TS code corrections |
| Go code | `voltagent-lang:golang-pro` | Verify Go code corrections |
| Rust code | `voltagent-lang:rust-engineer` | Verify Rust code corrections |
| Java / Spring | `voltagent-lang:java-architect` | Verify Java code corrections |
| Terraform / IaC | `voltagent-infra:terraform-engineer` | Verify infra changes in plan edits |
| Kubernetes / k8s | `voltagent-infra:kubernetes-specialist` | Verify k8s manifest changes |
| Docker / containers | `voltagent-infra:docker-expert` | Verify container config changes |
| CI/CD / pipelines | `voltagent-infra:deployment-engineer` | Verify deployment procedure edits |
| Security / auth | `voltagent-qa-sec:security-auditor` | Verify security fix correctness |
| Performance / scaling | `voltagent-qa-sec:performance-engineer` | Verify performance-related changes |
| API design / REST | `voltagent-core-dev:api-designer` | Verify API contract changes |
| GraphQL | `voltagent-core-dev:graphql-architect` | Verify schema changes |
| React / frontend | `voltagent-lang:react-specialist` | Verify frontend code corrections |
| Compliance / GDPR | `voltagent-qa-sec:compliance-auditor` | Verify regulatory compliance of edits |

**Step 3: Suggest installation when beneficial.** If content signals match
VoltAgent specialists but the relevant agent families are not available,
suggest installation to the user:

> "This integration would benefit from VoltAgent specialist agents for
> domain-specific edit verification. You can install the relevant families with:
>
> **Quick install (CLI):**
> `claude plugin install voltagent-qa-sec`  -- security, code review, testing
> `claude plugin install voltagent-data-ai` -- data science, ML, databases
> `claude plugin install voltagent-infra`   -- DevOps, cloud, Terraform
> `claude plugin install voltagent-lang`    -- language specialists (TS, Python, Go, Rust)
>
> **Or browse via marketplace:**
> `/plugin marketplace add VoltAgent/awesome-claude-code-subagents`
> then `/plugin install <name>@voltagent-subagents`
>
> Continue without them? They're optional -- all verification works without
> VoltAgent specialists."

Only suggest installation **once per session**. List only the families relevant
to the detected content signals, not all 10. If the user declines or the agents
are not available, proceed silently with the standard single-agent workflow.

**Step 4: When to spawn specialists.** VoltAgent spawns are gated by priority,
phase, and a hard cap:

1. **Priority gate:** ONLY for P0 or P1 effective priority findings (from
   Phase 6 epistemic-weighted classification). P2 and informational findings
   never trigger specialist verification.
2. **Phase gate:** ONLY during Phase 4 (cross-reference validation) and
   Phase 7 (edit verification). Optionally Phase 8 (post-integration
   coherence check) if spawns remain.
3. **Spawn cap:** Maximum **3** specialist spawns per integration run. If more
   than 3 P0/P1 findings qualify, prioritize: P0 before P1, Corrections before
   Gaps, security/data-integrity domains before others.
4. **Specialist prompt:** Each specialist receives:
   - The specific finding (ID, severity, detail, prescribed fix)
   - The plan section being modified (2 paragraphs of surrounding context)
   - Domain context gathered in Phase 1
   - Focused question: "Is the prescribed fix correct for this domain? If not,
     what should change?"
5. **Response handling:** Specialist responses are **advisory**. If a specialist
   flags the prescribed fix as incorrect:
   - Document the specialist's concern in the traceability table
   - Apply the specialist's suggested alternative if it passes coherence check
   - Or flag for human review if disagreement cannot be resolved
6. **Fallback:** If the specialist spawn fails or times out, proceed without it.
   Log `"voltagent_verification": "unavailable"` in `integration_log.jsonl`.

Note: findings downgraded by the actionability filter (Phase 5, where
groundedness < 0.3 caps severity at MEDIUM) will not reach P0/P1 threshold
for specialist verification. This is correct behavior.

---

## Phase 3: Extract Findings

For each finding, capture:

| Field | Description |
|-------|-------------|
| ID | Sequential: R1-F01, R1-F02, ... R2-F01, ... |
| Severity | CRITICAL / HIGH / MEDIUM / LOW |
| Source | Reviewer name, "Completeness Audit", or "Judge" |
| Summary | One-line description |
| Detail | Full context with code snippets/citations |
| Prescribed | Reviewer's recommended fix |
| Consensus | Consensus / disputed / unilateral |
| Location | Plan section, line, or code block |

**Multiple reports:** Deduplicate and merge overlapping findings (note all sources). Flag conflicting recommendations. Keep unique findings separate.

**High-signal items:** Completeness audit findings (systematic gaps), judge rulings (authoritative), items "resolved during debate" (may still need documentation).

---

## Phase 4: Cross-Reference

Categorize each finding's relationship to the plan:

| Category | Meaning |
|----------|---------|
| Already addressed | Plan handles it; reviewer may have missed it |
| Gap | Plan should address this but doesn't |
| Correction | Plan addresses it but contains an error |
| New concern | Affects scope/timeline/approach; may need structural changes |
| Pre-existing | Valid concern, but not introduced or worsened by this plan |

**Domain validation checklist** -- for each finding ask:
- Does the prescribed fix make sense given domain constraints?
- Is the reviewer assuming something untrue about the system?
- Would the fix break something the reviewer doesn't know about?
- Is the concern already mitigated by a mechanism the reviewer didn't see?

Document cases where the finding is valid but the prescribed fix is wrong.
Override the reviewer's prescribed fix when domain validation shows it is incorrect,
and supply the correct fix. Record the override in the key decisions section of the summary.

**VoltAgent verification (v1.3):** When a P0/P1 finding's cross-reference
judgment is ambiguous (especially "Already addressed" vs "Gap"), and a relevant
VoltAgent specialist is available, spawn the specialist to validate the judgment.
The specialist sees the finding, the plan section claimed to address it, and
asks: "Does this plan section genuinely address this concern, or is there a gap?"
This catches false "Already addressed" classifications that domain context alone
might miss. Counts toward the 3-spawn-per-run cap.

---

## Phase 5: Actionability Filter

> Inspired by Atlassian's RovoDev comment ranker (ICSE 2026, arXiv:2601.01129),
> which found that filtering LLM-generated review comments with a quality predictor
> improved resolution rates from ~33% to 40-45%, approaching human reviewer performance.

Score each finding on two dimensions before classification:

| Dimension | Question | Score |
|-----------|----------|-------|
| **Actionability** | Does this finding identify a specific, objectively verifiable issue with a concrete action? | 0.0 - 1.0 |
| **Groundedness** | Is the finding supported by code citations, line references, or verifiable claims? | 0.0 - 1.0 |

**Filter rules:**
- **Drop** findings with actionability < 0.3 (conversational, acknowledgements, vague concerns)
- **Flag for human review** findings with actionability 0.3-0.5 (valid concern, unclear action)
- **Pass through** findings with actionability >= 0.5 (specific issue, concrete fix path)
- Groundedness < 0.3 caps maximum severity at MEDIUM regardless of original rating

**Epistemic label weighting** (from upstream agent-review-panel):
- `[VERIFIED]` or `[CMD_CONFIRMED]`: +0.2 actionability bonus
- `[CONSENSUS]`: no adjustment
- `[SINGLE-SOURCE]`: -0.1 actionability penalty
- `[UNVERIFIED]` or `[DISPUTED]`: -0.2 actionability penalty

Record the filter decision (pass/flag/drop) and scores for each finding in the traceability table.

---

## Phase 6: Classify

Assign each finding to one action category. Classification uses **epistemic-weighted
severity** -- the effective priority of a finding depends on both its raw severity and
the confidence of the evidence behind it.

> Informed by research on multi-agent debate quality (arXiv:2511.07784, "Can LLM Agents
> Really Debate?") showing that eloquent-but-wrong agents can sway consensus, and that
> debate gains may reduce to ensembling effects. Epistemic labels from upstream reviews
> are the best available signal for evidence quality.

### Epistemic-Weighted Severity

| Raw Severity | Epistemic Label | Effective Priority |
|---|---|---|
| CRITICAL | `[VERIFIED]` / `[CMD_CONFIRMED]` | P0 -- immediate must-fix |
| CRITICAL | `[CONSENSUS]` | P0 -- must-fix with verification step |
| CRITICAL | `[SINGLE-SOURCE]` / `[DISPUTED]` | P1 -- flag for human review before acting |
| HIGH | `[VERIFIED]` | P1 -- must-fix |
| HIGH | `[CONSENSUS]` | P1 -- must-fix or bundle |
| HIGH | `[SINGLE-SOURCE]` / `[DISPUTED]` | P2 -- bundle or defer |
| MEDIUM/LOW | any | P2 -- bundle, defer, or informational |

A `[VERIFIED]` HIGH finding outranks a `[SINGLE-SOURCE]` CRITICAL finding. When in doubt,
present the conflict to the user rather than auto-resolving.

### Must-fix
P0 or P1 effective priority + Correction or Gap + affects correctness/data integrity/security. For example, a wrong SQL WHERE clause or missing temporal guard. Applied immediately.

### Bundle into implementation
Valid items that are implementation details, not plan defects, e.g., pipeline quality gates or additional test cases. Added to checklists.

### Defer
LOW severity, pre-existing debt not worsened by plan, or different workstream. For instance, refactoring code not touched by this plan. Documented with rationale. Add a TODO or backlog item for tracking.

### Informational
Raised, debated, and resolved during review. No plan changes needed.

### Conflict resolution
- CRITICAL + pre-existing: defer, but add caveat with risk note and future work item
- Panels disagree on severity: use higher severity, note disagreement
- Valid finding + wrong fix: classify on finding severity, supply correct fix

---

## Phase 7: Apply Edits

| Category | Edit type |
|----------|-----------|
| Must-fix | Direct plan edits: fix code, add guards, correct values |
| Bundle | Add to implementation checklists and verification sections |
| Gap (new section) | Add pre-impl checks, go/no-go criteria, rollback, monitoring |
| Caveat | Inline `> **Review note:** [concern + mitigation]` near relevant content |

**Edit discipline:**
- Minimum necessary change per finding
- Preserve plan voice and structure
- Do not rewrite correct sections
- Link edits to finding IDs for traceability

**VoltAgent verification (v1.3):** For must-fix edits where a domain specialist
is available, spawn the specialist to verify the edit BEFORE applying it. The
specialist receives the original finding, the proposed edit, and the surrounding
plan context, and confirms the edit is technically correct for the domain. This
catches wrong fixes that general domain context might miss (e.g., a SQL fix that
is syntactically valid but semantically wrong for the specific database engine).
Counts toward the 3-spawn-per-run cap.

**Rollback on coherence break:**

> Inspired by AutoDW's dual rollback strategy (arXiv:2512.04445), which achieved 90%
> completion on document workflow tasks by validating each state change and reverting
> when edits break document coherence.

After each must-fix edit, re-read the surrounding section (2 paragraphs before and after).
If the edit introduces inconsistency, contradiction, or breaks the logical flow:

1. **Argument-level rollback** (first attempt): Rephrase the edit to fit the surrounding
   context while preserving the finding's intent. Keep the same finding ID linkage.
2. **API-level rollback** (if rephrasing fails): Revert the edit entirely. Add the finding
   to the traceability table with disposition "ROLLBACK -- requires manual integration"
   and include the coherence issue encountered.

Do not force edits that break the plan. A clean plan with a flagged finding is better than
a corrupted plan with a forced fix.

---

## Phase 8: Post-Integration Verification

> Inspired by Self-Refine (NeurIPS 2023, arXiv:2303.17651), which demonstrated 20%
> average improvement from generate-critique-refine cycles, and ARIS's auto-review-loop
> (github.com/wanshuiyin/Auto-claude-code-research-in-sleep) which chains cross-model
> review for overnight autonomous quality improvement.

After all Phase 7 edits are applied, perform a single verification pass:

1. **Coherence check** -- Re-read the full updated plan. Flag any section where edits
   from different findings contradict each other or create logical gaps.
2. **Completeness check** -- Verify every must-fix finding has a corresponding edit.
   Every bundle finding appears in a checklist. Every defer finding has a rationale.
3. **Voice check** -- Confirm edits match the plan's existing tone and style. Rewrite
   any edit that reads like injected review commentary rather than plan content.
4. **Cross-reference check** -- If edits reference other plan sections (e.g., "see Phase 4"),
   verify those references are still valid after modifications.
5. **Domain coherence check (optional, v1.3)** -- If any VoltAgent specialist spawns remain
   unused (under the 3-spawn cap), use one to re-read the full set of must-fix edits and
   confirm they are mutually consistent from a domain perspective. This catches cases where
   individually correct edits interact poorly.

If verification surfaces issues, apply targeted fixes (not a full re-integration).
Record verification findings in the traceability summary as "V-01", "V-02", etc.

---

## Phase 9: Update Peripherals

- **Memory files:** Document findings affecting future sessions, new conventions, updated action items
- **ADRs:** Create/update for architectural decisions validated or modified by review
- **Runbooks:** Update deployment/rollback/operational procedures if changed
- **Config:** Note specific files and values to change; add to pre-implementation checklist

---

## Phase 10: Produce Summary

Example output:

| ID | Severity | Summary | Category | Action Taken |
|----|----------|---------|----------|--------------|
| R1-F01 | CRITICAL | Missing temporal guard | Must-fix | Added guard to step 3 query |
| R1-F02 | HIGH | Stale default in config | Bundle | Added to checklist item 3 |
| R1-F03 | MEDIUM | Refactor identity resolution | Defer | Pre-existing, tracked as future work |

Include statistics in this format: `Total findings: {N} | Must-fix: {n} | Bundle: {n} | Defer: {n} | Info: {n}`. Include key decisions (e.g., why a reviewer fix was overridden). Present summary to user and ask if they want to adjust classifications before finalizing.

---

## Phase 11: Persistent Integration Log

> Inspired by pi-autoresearch's append-only `autoresearch.jsonl` experiment log
> (github.com/davebcn87/pi-autoresearch), which enables fresh agent sessions to resume
> exactly where previous sessions stopped and learn from prior optimization decisions.

Append one JSON line per finding to `integration_log.jsonl` in the project root:

```json
{
  "timestamp": "2026-03-26T14:30:00Z",
  "plan": "tasks/implementation_plan.md",
  "review_source": "review_panel_report.md",
  "finding_id": "R1-F01",
  "severity": "CRITICAL",
  "epistemic_label": "[VERIFIED]",
  "effective_priority": "P0",
  "actionability_score": 0.85,
  "category": "must-fix",
  "disposition": "applied",
  "rollback": false,
  "verification_passed": true,
  "voltagent_verification": "confirmed",
  "notes": "Added temporal guard to step 3 query"
}
```

**Why:** Over multiple integration runs, this log reveals patterns -- which finding types
are consistently deferred, which sources produce the most actionable findings, and which
severity levels correlate with actual plan changes. Future runs can use this history to
calibrate actionability scoring.

If `integration_log.jsonl` already exists, read it before Phase 5 to inform actionability
scoring: findings matching historically-deferred patterns get a -0.1 penalty; findings
matching historically-applied patterns get a +0.1 bonus.

---

## Upstream Schema Contract

> This section defines the expected input format from `agent-review-panel` to prevent
> silent misparse when the upstream skill evolves. Version-pinned for compatibility.

**Compatible with:** `agent-review-panel` v2.0+ (v2.9+ for VoltAgent-enriched findings, v2.16.1+ ships in the same `plugin` marketplace bundle as this plugin — install both with `/plugin install agent-review-panel@plugin` + `/plugin install plan-review-integrator@plugin`)

**Required fields per finding:**
- Severity tier: `P0` / `P1` / `P2` (maps to CRITICAL / HIGH / MEDIUM-LOW)
- Epistemic label: one of `[VERIFIED]`, `[CMD_CONFIRMED]`, `[CONSENSUS]`, `[SINGLE-SOURCE]`, `[UNVERIFIED]`, `[DISPUTED]`
- Defect type: `[EXISTING_DEFECT]` or `[PLAN_RISK]`
- Source attribution: reviewer persona name or "Completeness Audit" or "Judge"

**Required report sections:**
- `## Action Items` -- tagged findings with severity + epistemic labels
- `## Consensus Points` -- agreed findings (can be processed as `[CONSENSUS]`)
- `## Disagreement Points` -- with Side A, Side B, Judge's ruling

**Optional but utilized:**
- `## Completeness Audit Findings` -- elevated weight in classification
- `## Severity Verification Table` -- used to validate P0 claims
- Verification annotations: `[CMD_CONFIRMED]`, `[CMD_CONTRADICTED]`, `[CMD_INCONCLUSIVE]`

**Graceful degradation:** If input lacks epistemic labels, treat all findings as
`[SINGLE-SOURCE]`. If input lacks defect types, infer from context (code citations
suggest `[EXISTING_DEFECT]`, speculative concerns suggest `[PLAN_RISK]`).

---

## Composability

This skill expects structured review output as input (requires a file path or inline findings).
Do not use for running review panels or writing plans from scratch.
If integration fails, gracefully degrade by presenting unmodified findings for manual triage.
After integration, then use the implementation executor to begin building.
This plugin is designed to consume output from `agent-review-panel` and ships alongside it in the same `plugin` marketplace bundle (see [`wan-huiyan/agent-review-panel`](https://github.com/wan-huiyan/agent-review-panel)). It works with any structured review output matching the schema above; `agent-review-panel` is the canonical producer. Compatible with review v1.0 output format and above.

| Field | Value |
|-------|-------|
| Consumes from | `agent-review-panel` (or any structured review with severity-rated findings) |
| Hands off to | Implementation executor; updated plan feeds into build phases |
| Output contract | Updated plan + traceability summary + optional ADRs/runbooks |
| Namespace | All edits scoped to provided plan document; no global state modification |
| Idempotency | Re-running on same inputs produces same result (absent user overrides) |

---

## Anti-Patterns

1. **Applying fixes blindly** -- always validate against domain context
2. **CRITICAL != plan defect** -- some are verification steps (add to checklist, not correction)
3. **Ignoring completeness audit** -- highest-signal items; systematic gaps all reviewers missed
4. **Pre-existing debt as must-fix** -- if plan doesn't worsen it, defer with backlog link
5. **Plan as findings dump** -- each finding lands in exactly the right place, not a giant appendix
6. **Skipping user confirmation** -- present classification summary; let user adjust before applying
7. **Severity-only triage** -- a `[SINGLE-SOURCE]` CRITICAL is weaker than a `[VERIFIED]` HIGH; always use epistemic-weighted severity
8. **Forcing incoherent edits** -- if an edit breaks plan coherence, rollback; a flagged finding beats a corrupted plan
9. **Ignoring integration history** -- check `integration_log.jsonl` for patterns before classifying; don't repeat deferred decisions without re-evaluation
10. **Over-spawning specialists** -- VoltAgent is a verification tool here, not an orchestrator; cap at 3 spawns per run and only for P0/P1 findings

---

## Research Credits

Design decisions are informed by the following research:

| Feature | Source | Reference |
|---------|--------|-----------|
| Actionability filter | Atlassian RovoDev Code Reviewer | ICSE 2026 SEIP, arXiv:2601.01129 |
| Epistemic-weighted severity | "Can LLM Agents Really Debate?" | arXiv:2511.07784 |
| Dual rollback strategy | AutoDW document workflow orchestration | arXiv:2512.04445 |
| Post-integration verification | Self-Refine (Madaan et al.) | NeurIPS 2023, arXiv:2303.17651 |
| Cross-model review pattern | ARIS (Auto-Research-In-Sleep) | github.com/wanshuiyin/Auto-claude-code-research-in-sleep |
| Persistent experiment log | pi-autoresearch (davebcn87) | github.com/davebcn87/pi-autoresearch |
| Fine-grained comment classification | Review comment taxonomy | arXiv:2508.09832 |
| Multi-agent debate protocols | Voting vs Consensus (Kaesberg et al.) | ACL 2025 Findings, arXiv:2502.19130 |
| Anti-sycophancy mechanisms | CONSENSAGENT | ACL 2025 Findings |
| Feedback-to-section mapping | Friction (Zhang et al.) | CHI 2025 |
| VoltAgent specialist routing | awesome-claude-code-subagents (VoltAgent) | github.com/VoltAgent/awesome-claude-code-subagents |
