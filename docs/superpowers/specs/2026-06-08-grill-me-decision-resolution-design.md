# Design Spec — Human-in-the-Loop Decision Resolution (v3.6.0)

- **Status:** Approved design, pending implementation plan
- **Target version:** 3.6.0 (minor, additive, default-off)
- **Branch:** `feat/grill-me-decision-resolution` (worktree off `main` @ v3.5.0)
- **Author/date:** 2026-06-08
- **Deferred to v3.7.0:** last30days `[COMMUNITY-SIGNAL]` research input (see §10)

## 1. Problem

The Supreme Judge (Phase 14) is forced to *rule* on every disagreement. Some
disagreements have **no fact of the matter** — they are business/priority calls
(latency vs. correctness, scope-cut vs. ship) that only the user's context can
settle. Today the judge either guesses or the point dies in "Disagreement
Points" with a low-confidence ruling. Separately, the panel offers no structured
way for a human to **sign off, question, or request changes** on individual
findings — the HTML report (the most-shared artifact) is read-only.

This feature adds a human-in-the-loop layer **without** compromising the skill's
epistemic discipline (Live-State Claim Discipline v3.3.0, the Phase 14.5
verification gate).

## 2. Core concept — one grill engine, three entry points

We build a single **grill engine** (the grill-me interview pattern — interview
one question at a time, explore code/context to self-answer where possible,
each question carries a recommended answer — *inlined*, NOT a hard dependency on
the external `grill-me` skill, which other installers will not have). It is
triggered from three places:

| # | Entry point | Trigger | Effect |
|---|---|---|---|
| ① | **Upstream** (Phase 0, pre-Setup) | review target is a **plan/design** + interactive session | Grill the user on open decisions *before* reviewers launch; lock answers into the Context Brief |
| ② | **Downstream terminal** (Phase 17) | after report, judge left ≥1 `[USER-DECISION]` item | Auto-offer a terminal interview to resolve them |
| ③ | **Downstream HTML ingest** (Phase 17) | user annotated the HTML report and pasted the bundle back | Parse bundle; route by status; questions → grill |

**Build the grill prompt once** (defined in `references/prompt-templates.md`
under the Phase 17 section); Phase 0 and the ingest path *reference* it.

### 2.1 Recommended-answer reconciliation (important)

The grill-me pattern normally gives a recommended answer. But `[USER-DECISION]`
items are exactly the calls Claude should *not* be confident on — they hinge on
the user's business context. Reconciliation: the engine explores code/context
first, then frames each as **"if forced, X because Y — but this is your call,
and here is what would change the answer."** No confident guessing on
business-priority calls.

## 3. Producer: judge `[USER-DECISION]` label + guard

### 3.1 The label (`prompt-templates.md`, Phase 14 Supreme Judge prompt, "Rule on Each Disagreement", ~L657–691)

Add a sixth disagreement outcome alongside `[VERIFIED]`/`[DISPUTED]`/etc.:

> `[USER-DECISION]` — a preference/priority/business call with **no fact of the
> matter** resolvable by code, docs, or a command. Use ONLY when the
> disagreement cannot be settled by inspection — a genuine tradeoff the user's
> context decides. If the disagreement *is* answerable by evidence, you MUST
> rule; you may not defer.

### 3.2 The guard (`prompt-templates.md`, Phase 14.5 gate prompt, ~L714–766)

A new judge escape-hatch needs a guard, or a judge that *couldn't verify* a
correctness question could launder it as a "tradeoff" to dodge ruling. Extend
the existing Phase 14.5 Judge-Output Verification Agent:

- For each `[USER-DECISION]` item, check it is **not a disguised verifiable
  question**. Apply a cheap ground-truth probe (grep/Read/command) appropriate
  to the claim.
- If it *is* answerable → verdict `[USER-DECISION-REJECTED]`; re-classify as
  `[DISPUTED]` and route back into normal ruling (note the override in the
  verification table).
- Confirmed value/priority calls pass through as `[USER-DECISION]`.

This reuses Phase 14.5's existing pattern and file
(`state/phase_14_5_judge_verification.md`); no new gate phase.

## 4. Producer: HTML per-card feedback + export (Phase 15.3)

The HTML report is already a self-contained single-file dashboard where each
finding is an expandable `<details class="issue-card" id="issue-{id}">`
(deep-linkable as `#issue-A1`). Changes to the Phase 15.3 rendering spec
(`prompt-templates.md`, "Phase 15.3: HTML Report Generation Prompt"):

### 4.1 Per-card feedback widget
Each issue card gains a feedback control in its expanded body:
- **Status selector:** ✅ Sign-off · ❓ Question · ✏️ Change-requested · (none)
- **Free-text box** for the comment.
- `[USER-DECISION]` cards are **pre-badged** "⚖️ Needs your call" and default the
  selector to ❓.

### 4.2 Client-side persistence
Annotations persist to `localStorage`, keyed by `{run-id}:{issue-id}`, so
feedback survives reload. No backend; the file stays self-contained.

### 4.3 Export
A toolbar gains **"📋 Copy feedback for Claude"** and **"⬇ Download feedback"**.
Both serialize all non-empty annotations into the **self-contained bundle**
(§6). Self-contained means each item carries its finding title — so ingest does
NOT depend on any original file surviving (the round-trip is async; `state/` and
the report path may be long gone by paste-back time).

## 5. Canonical annotatable unit & ID

- **Annotatable cards = findings/issue cards**, keyed by their existing finding
  ID (`A1`, `B1`, `A5` — the same IDs used by HTML `id="issue-{id}"` and
  cross-ref `targetId`). **Not** the `AI-n` action-item namespace.
- Each card maps to exactly one canonical ID in the bundle. Items that have both
  a finding ID and an action-item ID are annotated by **finding ID**.

## 6. The bundle grammar (first-class contract artifact)

The export format is the contract between the HTML serializer (producer) and the
skill parser (consumer). It MUST be defined exactly and covered by a
round-trip test (§8). Grammar:

```
=== AGENT-REVIEW-PANEL FEEDBACK · run {run-id} ===
report: {report-title}
generated: {iso-date}

[{ID}] {SIGNOFF|QUESTION|CHANGE} "{finding-title}"
> {optional free-text, one or more lines, each prefixed "> "}
=== END FEEDBACK ===
```

- Sentinel header `=== AGENT-REVIEW-PANEL FEEDBACK` is how the skill recognizes a
  pasted bundle (also added to the skill's trigger description).
- One block per annotated item. `{ID}` = canonical finding ID. Status token is
  uppercase. `{finding-title}` makes the block self-describing.
- Free-text lines are optional and quoted with `> `.
- Items with no annotation are omitted from the bundle.

### 6.1 Example
```
=== AGENT-REVIEW-PANEL FEEDBACK · run 2026-06-08-a3f ===
report: Review of campaign-uplift pipeline
generated: 2026-06-08

[A1] CHANGE "Temporal exclusion only covers the first Christmas"
> Jan-6 start excludes one Christmas; a second is still in the training window.
> Please re-derive across the full date range.
[B3] SIGNOFF "DELETE-then-INSERT is idempotent"
[C2] QUESTION "Missing retry on the scorecards API call (P1)"
> Why P1 not P0? What's the blast radius if it fails in prod?
=== END FEEDBACK ===
```

## 7. Consumer: ingest mode + grill routing (Phase 17)

- **Trigger:** the skill recognizes a pasted bundle by its sentinel header
  (added to SKILL.md trigger description and `## When ... to Use`).
- **Parse from the paste alone** — never re-read `state/`/report files (§4.3).
- **Route by status:**
  - `SIGNOFF` → record as accepted/closed.
  - `CHANGE` → emit as an action item (carry the user's text).
  - `QUESTION` → feed into the **grill engine** (§2) — answer from code where
    possible, otherwise interview.
- **Terminal entry (②):** when no HTML round-trip is used, after the report is
  written and ≥1 surviving `[USER-DECISION]` exists, auto-offer the terminal
  interview over those items. In non-interactive/headless/batch runs the offer
  is skipped — the `[USER-DECISION]` items simply remain visible in the report.
- **Output:** write `state/phase_17_decision_resolution.md` (per item: the
  options, the "if-forced" lean + rationale, the user's choice, the user's
  reasoning) + a concise chat summary. The verified report is **not** mutated.
- **Scope note:** ingest treats the bundle as **user-authored intent** (relevant
  only if a report is ever annotated by a third party).

## 8. Upstream: Phase 0 — Pre-Panel Decision Lock (plan-mode)

- **New `SKILL.md` section "Phase 0: Pre-Panel Decision Lock (optional)"**, runs
  before Phase 1 Setup.
- **Gate:** review target is a plan/design/proposal (per Review-Mode Detection
  v2.8) AND the session is interactive. Default = **offer**, not auto-run.
- **Effect:** runs the same grill engine over open decisions in the plan. Decided
  answers are written into the **Context Brief** (Phase 1 step 6) as a new
  **"Locked Decisions"** subsection.
- **Reviewer injection:** reviewer prompts gain a "Locked Decisions" context
  block — "these choices are settled by the user; review the plan as if decided;
  do not re-litigate them or flag them as underspecified."

## 9. Report rendering & golden stability (Phase 15.1)

- Add a **conditional** "⚖️ Deferred to You (`[USER-DECISION]`)" subsection under
  "Disagreement Points," rendered **only when ≥1 item exists** — so existing
  golden fixtures stay byte-identical.
- Add one new golden fixture that *does* contain a `[USER-DECISION]` item.

## 10. Out of scope (deferred to v3.7.0)

**last30days `[COMMUNITY-SIGNAL]`** — a Phase 1 Context-Gathering step 5b that,
in deep-research mode and only for *direction/strategy* content-types, pulls
recent practitioner signal via the `/last30days` engine, tagged
`[COMMUNITY-SIGNAL]`, judge-discounted, never grounding a CRITICAL, never run for
correctness reviews. It is a *research-input* concern (different axis from this
human-loop feature) and carries epistemic risk that warrants its own focused
version + tests. Add a placeholder entry to `ROADMAP.md`.

## 11. Edit surface (tracked paths verified on `main`)

| File | Change |
|---|---|
| `skills/agent-review-panel/references/prompt-templates.md` | `[USER-DECISION]` label (Phase 14); Phase 14.5 kick-back check; **Phase 17 grill prompt** (defined once); reviewer "Locked Decisions" block; Phase 15.3 HTML feedback widgets + serializer + export button |
| `skills/agent-review-panel/SKILL.md` | **Phase 0** section; Phase 14/14.5 docs; conditional Phase 15.1 subsection; Phase 15.3 feedback/export features; **Phase 17** section + **ingest-mode** entry; trigger description recognizes pasted bundle; header → v3.6.0 |
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`, `README.md` | version 3.5.0 → **3.6.0** |
| `CHANGELOG.md`, `references/changelog.md` | v3.6.0 entry (+ note v3.7.0 planned) |
| `ROADMAP.md` | add v3.7.0 last30days `[COMMUNITY-SIGNAL]` item |
| `tests/` | new golden fixture w/ `[USER-DECISION]`; **bundle round-trip test** (annotations → bundle string → parsed structure); HTML assertions (widgets + export button present, no JS collision with existing interactive JS); plan-mode-offers-upstream-grill trigger test; confirm existing goldens byte-stable |

## 12. Build stages (one version, reviewable increments)

1. Judge `[USER-DECISION]` label + Phase 14.5 guard (+ fixture).
2. Grill engine core (Phase 17 prompt) + terminal downstream (②) + state output.
3. Upstream Phase 0 (plan-mode) + Locked-Decisions reviewer injection.
4. HTML per-card feedback widgets + localStorage.
5. Export serializer + bundle grammar + round-trip test.
6. Ingest parser + status routing + grill handoff.
7. `plan-review-integrator` handoff (plan-mode only, user-gated).

Each stage is independently testable.

## 13. Risks / open items

- **Guard efficacy:** §3.2 is the single most important safety check — without it,
  `[USER-DECISION]` becomes a correctness-dodge. Test with an adversarial fixture
  (a verifiable claim the judge *tries* to defer).
- **HTML JS collision:** the new feedback JS must not break existing keyboard
  nav / filter / deep-link / Chart.js logic. Assert in tests.
- **Bundle robustness:** parser must tolerate user edits to the pasted text
  (extra whitespace, reordered blocks, missing optional free-text). Define
  lenient-but-unambiguous parsing; the round-trip test covers the canonical case,
  add a "hand-edited bundle" fixture.

## 14. Version-bump checklist (all version-bearing files — per prior lesson)

`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`,
`README.md` badge/line, `SKILL.md` header, `CHANGELOG.md`, `references/changelog.md`.
