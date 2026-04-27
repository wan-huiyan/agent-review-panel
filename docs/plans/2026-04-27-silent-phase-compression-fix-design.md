# Design: Fix silent Phase 4/5/7 compression in agent-review-panel v3.1.0

**Date:** 2026-04-27
**Issue:** [#35](https://github.com/wan-huiyan/agent-review-panel/issues/35)
**Target release:** v3.1.0
**Status:** Approved — ready for implementation planning

---

## 1. Problem

Under context-budget pressure, the v3.0.0 orchestrator silently inlines Phases 4
(private reflection), 5 (debate), 6 (round summaries), and 7 (blind final
assessments) into the Supreme Judge step. The resulting deliverable is
indistinguishable from a full run.

Empirical cost, measured in
[barryu#116 vs #117](https://github.com/wan-huiyan/barryu_application_propensity/pull/116):
**6 net-new findings** surfaced when Phases 4/5/7 ran properly afterward,
including **1 P0** (FERPA / Anthropic-DPA gap, Devil's-Advocate-only) the
compressed run never saw.

Phase 4/5/7 are load-bearing, not ceremonial.

## 2. Root cause

1. **Subagent IO floods orchestrator context.** Subagents have their own
   windows, but their *outputs* return verbatim to the orchestrator.
   5 reviewers × ~15k tokens × Phases 3+4+5+7+8+14 = ~300-500k tokens of
   returned material the orchestrator must hold to compose the final report.
2. **Phase 12/13 skip-conditions leak into Phase 4/5/7.** No MANDATORY marker
   on Phase 4/5/7 lets the model extend the skip pattern under pressure.
3. **No verification gate before Phase 14.** Phase 15.3 has a retry gate;
   Phase 14 has nothing checking which phases actually ran.
4. **Headers don't self-incriminate.** A reader can't tell at a glance whether
   a report represents a full run or a compressed one.

## 3. Scope: v3.1.0 = Tier 1 only

Four coupled changes ship together as one PR. They are tightly interdependent:
the gate depends on file-based state existing; the COMPRESSED RUN header
depends on the gate firing; judge-reads-on-demand depends on file-based state.
Splitting them creates awkward intermediate states.

| Change | Where in SKILL.md | Why |
|---|---|---|
| **File-based subagent state** | Implementation Notes + Phase 3/4/5/7 reviewer prompts | Eliminates the 75k-tokens-per-phase orchestrator bloat that drives compression |
| **Judge reads files on demand** | Phase 14 prompt template | Caps judge window load; mirrors v2.16.4 pattern already used by Phase 15.3 |
| **Pre-judge verification gate** | New phase between 13 and 14 | Hard guardrail — single most load-bearing fix for preventing silent compression |
| **`⚠️ COMPRESSED RUN` report header** | Phase 15.1 spec | Makes residual deviation visible instead of invisible |

Out of scope for v3.1.0, captured in §10 as future directions:

- MANDATORY/SKIPPABLE phase matrix (Tier 2)
- Phase Execution Manifest in report header (Tier 2)
- Chunked judge — Phase 14a synthesis + 14b ruling (Tier 2, only needed at 6+ reviewers)
- Phase 15.1 reads ruling-not-raw-reviews (Tier 2)
- Anti-rationalization red-flags table (Tier 3)
- Named-input judge schema with `MissingPhaseError` (Tier 3)
- Upfront context-pressure tradeoff menu (Tier 3)
- Phase 8 audit re-purposed as index-completeness backstop (post-chunked-judge)
- Per-issue judges with ensemble index (post-chunked-judge)

## 4. Architecture

### 4.1 File-based subagent state

**Directory layout** (added under the existing review output directory):

```
docs/reviews/<date>-<topic>/
├── state/
│   ├── reviewer_<name>_phase_3.md       # independent review
│   ├── reviewer_<name>_phase_4.md       # private reflection
│   ├── reviewer_<name>_phase_5_round1.md # debate response
│   ├── reviewer_<name>_phase_7.md       # blind final
│   ├── phase_8_audit.md
│   ├── phase_10_claim_verification.md
│   ├── phase_11_severity_verification.md
│   └── phase_14_judge_ruling.md
├── review_panel_report.md               # Phase 15.1 output
├── review_panel_process.md              # Phase 15.2 output
└── review_panel_report.html             # Phase 15.3 output
```

**Multi-run mode** (Phase 16) namespaces by run number:

```
docs/reviews/<date>-<topic>/
├── state/
│   ├── run_1/reviewer_<name>_phase_3.md
│   ├── run_2/reviewer_<name>_phase_3.md
│   └── ...
```

**Reviewer subagent prompt change.** Each reviewer prompt for Phases 3, 4, 5,
and 7 ends with a directive of the form:

> Write your full output to `{state_dir}/reviewer_{name}_phase_{N}.md`. Then
> return ONLY: (a) the absolute path you wrote to, and (b) a 100-word summary
> of your conclusions. Do not return your full review in chat.

Same pattern for Phase 8 auditor and Phase 10/11 verification agents.

**Orchestrator behavior.** Holds only paths and 100-word summaries in its
window. Reads files from disk only when needed for a specific decision (e.g.,
the pre-judge gate's existence check). Target window load: **~10k tokens
throughout**.

### 4.2 Judge reads files on demand

The Phase 14 launch prompt becomes ~200 tokens of:

> The panel produced these state files:
> - reviewer_arch_phase_3.md, reviewer_arch_phase_4.md, ...
> - reviewer_security_phase_3.md, ...
> - phase_8_audit.md, phase_10_claim_verification.md, ...
>
> Read what you need to adjudicate. Steps in your prompt template apply as
> before; produce phase_14_judge_ruling.md to disk.

The judge agent uses the Read tool on individual state files rather than
receiving them pre-stuffed as launch-prompt content. Mirrors the Phase 15.3
HTML-agent pattern shipped in v2.16.4.

### 4.3 Pre-judge verification gate

A new phase (numbering TBD by implementer — likely Phase 13.5 to preserve
existing numbering, or Phase 14a if renumbering is acceptable) between
verification (Phase 13) and the Supreme Judge (Phase 14).

**Gate logic** (executed by orchestrator, no subagent dispatch):

```
For each reviewer name in <panel>:
  Required files:
    - state/reviewer_<name>_phase_3.md
    - state/reviewer_<name>_phase_4.md
    - state/reviewer_<name>_phase_5_round1.md  (round 1 minimum mandatory)
    - state/reviewer_<name>_phase_7.md
  For each required file:
    - Existence check
    - Minimum-bytes check (≥500 bytes — empirically below this is a stub)
    - Required-headers check (parse for the schema sections the phase template requires)
  If any check fails:
    - LOG: "GATE FAIL: <file> missing/stub/malformed"
    - DO NOT proceed to Phase 14
    - Re-dispatch the missing phase for that reviewer
    - Re-run the gate after re-dispatch
  Also check:
    - state/phase_8_audit.md, state/phase_10_claim_verification.md,
      state/phase_11_severity_verification.md (same checks)
```

**Why this design choice — bytes + headers, not just existence.** A subagent
can write a stub and crash, leaving an empty/partial file. Existence alone
passes the gate on a stub. Bytes + required-headers makes the check
load-bearing. Mirrors how Phase 15.3 retry validates HTML output structurally,
not just by file presence.

**Re-dispatch policy.** Single retry per missing phase. If retry also fails,
write the COMPRESSED RUN header (§4.4) listing the unrecoverable phase, log
loudly, but allow the run to complete with the compressed warning rather than
hard-failing — partial deliverable with explicit warning beats no deliverable.

### 4.4 `⚠️ COMPRESSED RUN` header

If the gate detected any unrecoverable missing phase, the Phase 15.1 report
header MUST begin with:

```markdown
> ⚠️ **COMPRESSED RUN — Phases skipped: 4 (security), 5 (security, devils-advocate)**
>
> This run did not complete the full panel protocol. The Supreme Judge ruled
> on partial input. Findings below should be treated as **lower confidence**
> than a full-run report. Re-run the panel for a complete review.
```

Every action item in a compressed run gets `[COMPRESSED]` appended to its
epistemic label.

The HTML report (Phase 15.3) renders the same warning in a red banner at the
top of the document.

For a full run, the warning is absent — its absence is the green light.

## 5. Schema changes

- New required directory: `state/` under each review output
- New required file: `phase_14_judge_ruling.md` (today the judge's ruling
  exists only in chat; now materialized to disk so Phase 15.1 can later read
  it — also enables the Tier 2 "15.1 reads ruling-not-raw-reviews" change)
- Phase 15.1 header: optional COMPRESSED RUN block at top of file

No breaking changes to consumers of the existing report files (process.md,
report.html, report.md) — added content, removed nothing.

## 6. Tradeoffs accepted

- **Token cost neutral.** File-based state passing reads files on demand;
  total tokens across the run are roughly equivalent. Orchestrator pays less,
  individual subagents pay roughly the same. Net: ~0% to slight reduction.
- **Latency neutral.** Disk IO is sub-second; gate checks are O(reviewer
  count) file-stat operations. Adds <5s per run.
- **Disk usage:** ~1-2 MB per review under `state/`. Negligible.
- **Existing reports:** unchanged for consumers; the `state/` directory is
  net-new and can be `.gitignore`'d if not desired in commits.

## 7. Test plan

The repo's existing `tests/` directory hosts integration scaffolding. Add:

1. **Unit-level (gate logic):** synthetic state directories with each failure
   mode (missing file, stub file, missing-required-header file) — confirm
   the gate detects each and logs correctly.
2. **End-to-end happy path:** run the panel against a moderately complex
   codebase (5+ source files, 1000+ LOC). Verify all reviewer outputs land
   under `state/`, NOT in orchestrator chat. Verify the gate passes silently.
   Verify the report has no COMPRESSED RUN header.
3. **End-to-end fail-loud:** intentionally delete `state/reviewer_X_phase_4.md`
   after Phase 4 runs. Verify the gate detects, re-dispatches, and the run
   completes successfully. Verify a second test where re-dispatch is
   intercepted (force fail) — confirm COMPRESSED RUN header appears in the
   final report listing the missing phase.
4. **Diff baseline:** run the panel on barryu#116's input. Verify the run
   produces 6+ findings consistent with the manual Run-2 corrective report,
   not the original compressed Run-1.

## 8. Backward compatibility

- v3.0.0 reviews live in `docs/reviews/...`. No migration needed; old reviews
  remain readable, new reviews add the `state/` subdirectory.
- Plugin install path unchanged (post-PR #24 fix is preserved).
- `roundtable:plan-review-integrator` (sibling skill) consumes the Phase 14
  ruling — its consumption pattern is unchanged because the ruling content
  is identical, just sourced from `phase_14_judge_ruling.md` instead of chat.

## 9. Acceptance criteria

- [ ] All four Tier 1 changes land in `skills/agent-review-panel/SKILL.md`
- [ ] CHANGELOG.md entry under v3.1.0 with bug-fix and architecture sections
- [ ] One end-to-end test that intentionally compresses a phase and verifies
      the gate catches it
- [ ] At least one real review run on a moderately complex repo, with the
      `state/` directory inspected to confirm file-based passing is working
- [ ] Tag v3.1.0 release; users can `/plugin update`

## 10. Future directions (not in v3.1.0 scope)

Captured here so they aren't lost. Each is independently shippable as a
follow-up release once Tier 1 is validated empirically.

### v3.2.0 candidates (Tier 2)

- **MANDATORY/SKIPPABLE matrix** at top of Process Overview — closes the
  ambiguity that lets Phase 12/13 skip-conditions leak into Phase 4/5/7
- **Phase Execution Manifest** in report header — explicit `Phases run: 1, 3,
  4, 5×1, 6, 7, 8, 10, 11, 14, 15` line, always present, missing numbers
  immediately visible
- **Phase 15.1 reads ruling-not-raw-reviews** — enabled by §5's
  `phase_14_judge_ruling.md` materialization; primary report writer reads
  judge's ~20k ruling instead of the 5 raw reviews
- **Chunked judge (Phase 14a synthesis + 14b ruling)** — required if reviewer
  count ≥ 6. At 5 reviewers, Tier 1 alone gives 50-80k context margin which
  is sufficient. Chunked judge buys ~120k margin at the cost of ~30-50% more
  tokens, doubled test surface, and a synthesis-summarization risk.

### v3.3.0+ candidates (Tier 3)

- **Anti-rationalization red-flags table** mirroring `using-superpowers` —
  names the specific thoughts ("debate won't add much," "judge can integrate
  inline," "convergence reached after Round 0") that trigger compression
- **Named-input judge schema with `MissingPhaseError`** — judge errors out
  on empty/missing inputs instead of silently integrating placeholders
- **Upfront context-pressure tradeoff menu** at Phase 1 — based on reviewer
  count + project size, offer (a) reduce reviewers 5→4→3, (b) drop debate
  rounds 3→2→1, (c) skip Phase 2 trace. Sanctioned safety valve so the model
  doesn't reach for compression mid-run.

### v3.4.0+ explorations (only if Tier 2 reveals problems)

- **Phase 8 audit re-purposed as index-completeness backstop.** If chunked
  judge ships and lossy-synthesis-misses-an-issue is observed empirically,
  the cheapest fix is re-framing Phase 8 (which already exists for
  completeness auditing) to also audit 14a's index for missing claims.
  Single agent, prompt change only, no new architecture.
- **Per-issue judges with parallel ruling.** If chunked judge's lossy
  synthesis still bites after Phase 8 backstop, dispatch one judge per issue
  using 14a's index as a dispatch list. Three-stage architecture (index →
  N parallel per-issue judges → final aggregator). Substantial complexity
  jump; only worth it if measured rulings degrade due to summarization loss.
- **Ensemble index agents.** If per-issue judges ship and index-completeness
  is still the bottleneck, run 2-3 parallel index agents and consolidate.
  Note: 3× index cost, ~1.3-1.7× effective coverage (correlated misses), and
  the consolidator is itself a new lossy step. Diversified prompting (one
  by-reviewer pass, one by-issue-type pass) likely cheaper for similar gain.

## 11. Decision log

- **Why one PR, not four sequential PRs?** The four changes are tightly
  coupled: the gate's existence-check is meaningless without file-based
  state; the COMPRESSED RUN header depends on the gate firing;
  judge-reads-on-demand requires the same `state/` files the gate reads. A
  sequenced rollout creates intermediate states where files exist but
  nothing checks them, which is more confusing than the status quo.
- **Why bytes + headers, not just file existence, for the gate?** A subagent
  that writes a stub and crashes leaves a near-empty file; pure existence
  passes that. Mirrors how Phase 15.3's retry gate validates structurally.
- **Why allow run completion with COMPRESSED RUN header instead of hard-fail
  on unrecoverable gate failure?** Partial deliverable with explicit warning
  beats no deliverable. The header makes the deviation prominent and
  consumer-visible. A hard fail loses all the work the panel already did.
- **Why defer chunked judge?** At 5 reviewers (the user's current scale),
  Tier 1 alone delivers ~50-80k context margin. Chunked judge buys more
  margin but adds substantial complexity, doubled test surface, and a
  synthesis-summarization risk that hasn't been measured empirically.
  Better to ship Tier 1, run real reviews, and add chunked judge in v3.2.0
  with empirical evidence.
- **Why defer per-issue judges and ensemble indexers?** Both are designs for
  problems we haven't yet seen in measured runs. The design space exploration
  is captured above so it's not lost; building it now would be designing
  for theoretical edge cases.
