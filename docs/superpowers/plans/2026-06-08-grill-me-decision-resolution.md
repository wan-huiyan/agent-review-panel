# Human-in-the-Loop Decision Resolution (v3.6.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a human-in-the-loop decision-resolution layer to agent-review-panel — one grill engine with three entry points, a judge `[USER-DECISION]` label with a Phase 14.5 kick-back guard, and an HTML feedback round-trip — without weakening the skill's epistemic discipline or breaking existing golden fixtures.

**Architecture:** This is a **skill-spec repo**, not an app. The "code" is markdown instruction (`SKILL.md` orchestration + `references/prompt-templates.md` agent prompts) that an LLM orchestrator follows. "Tests" are Node `node:test` `.mjs` files that assert on the *content* of those markdown files plus golden/structure assertions on sample report fixtures. **TDD here = write a failing `.mjs` assertion that the spec text must satisfy, run it red, edit the markdown to make it green.** This mirrors the v3.5.0 `[NO-DEBATE]` feature exactly (`tests/behavioral-assertions.test.mjs` → `describe("v3.5.0 loud debate-skip ([NO-DEBATE])")` + a new fixture + a `report-structure.test.mjs` parser extension).

The one piece of genuinely executable logic is the **feedback bundle grammar** (§6 of the spec): the contract between the HTML serializer (producer) and the skill parser (consumer). We pin it with a reference `serializeBundle()`/`parseBundle()` in a new `tests/bundle-roundtrip.test.mjs` (idiomatic here — mirrors the existing reference `parseReport()` in `report-structure.test.mjs`), and we make the round-trip test read the *documented example out of `prompt-templates.md`* so prose and test cannot drift.

**Tech Stack:** Node.js `node --test` (built-in test runner, no framework), `node:assert/strict`. No TypeScript, no jest. Markdown spec files. `scripts/release-check.sh` is the release gate.

**Source of truth:** `docs/superpowers/specs/2026-06-08-grill-me-decision-resolution-design.md` (approved). Section refs below (§N) point to it.

---

## Critical repo facts (verified during planning — do not re-derive)

1. **Baseline:** `npm test` = **443 tests, 0 fail** (green). `bash scripts/release-check.sh` = all pass (canonical version `3.5.0`).
2. **Version gate ≠ npm test.** plugin name is `roundtable`; skill dir is `agent-review-panel`. The marquee version checks in `manifest-consistency.test.mjs` (eval-suite version, SKILL.md H1) are **skipped** because `dirName !== pluginJson.name`. `npm test` *does* enforce `package.json` version == plugin.json and marketplace-entry version == plugin.json (both named `roundtable`). The **real** version gate is `scripts/release-check.sh` — it enforces eval-suite version, SKILL.md H1, SKILL.md HTML-footer instruction, ROADMAP vX.Y.0 row, CHANGELOG [X.Y.0] section, and **README test-count == actual `node --test` count**.
3. **Golden stability:** `golden-file.test.mjs` fingerprints `## ` (level-2) sections only (`/^## /gm`) + a hardcoded epistemic-label list `["VERIFIED","CONSENSUS","SINGLE-SOURCE","UNVERIFIED","DISPUTED"]`. A new `###` subsection and a new `[USER-DECISION]` label are invisible to it → existing goldens stay byte-identical. A **missing** golden is auto-created and passes — so a green golden ≠ a valid fixture.
4. **The real fixture gate is `report-structure.test.mjs`.** It iterates **all** `tests/fixtures/*.md` and enforces the full contract: every required header field, all 7 required `## ` sections, a Score table with ≥2 reviewers + Reviewer/Persona columns, Scope documents `[VERIFIED][CONSENSUS][EXISTING_DEFECT][PLAN_RISK]`, and **every numbered action item carries `[P0-3]` AND one of `(VERIFIED|CONSENSUS|SINGLE-SOURCE|UNVERIFIED|DISPUTED)`**. ⇒ The new fixture must be a complete valid report, and `[USER-DECISION]` content must live in the `### ⚖️ Deferred to You` subsection, **never** as a numbered action item.
5. **HTML rendering instructions must live in `prompt-templates.md` Phase 15.3** (the HTML agent reads that file, not SKILL.md). SKILL.md gets a surfacing mention; `prompt-templates.md` gets the load-bearing instruction. (Lesson: `reference_html_rendering_lives_in_prompt_templates`.)
6. **The §3.2 guard is testable as spec-presence only**, not behavior — no LLM runs in CI. The strongest shippable artifact for the safety property is a **worked example inside the Phase 14.5 prompt** showing a disguised-verifiable claim kicked back to `[DISPUTED]` (an LLM keys off the few-shot example, mirroring the existing "12 conflict markers" case). Tests verify the guard is *specified*, not that it *fires* — state this in the PR.
7. **New test files must be registered** in `package.json` `scripts.test` or `node --test` skips them (and the README count won't include them).
8. **Git hygiene:** explicit `git add <file>` per the handoff — never `-A`. Do not touch the `docs/agency-agents-evaluation` branch's WIP.

---

## File structure (what each touched file is responsible for)

| File | Responsibility | Stages |
|---|---|---|
| `skills/agent-review-panel/references/prompt-templates.md` | Agent prompts (read by subagents). Judge `[USER-DECISION]` label; Phase 14.5 kick-back + worked example; Phase 17 grill prompt (defined ONCE); Phase 3 reviewer "Locked Decisions" block; Phase 15.3 feedback widgets + export toolbar + bundle grammar + example | 1,2,3,4,5,6 |
| `skills/agent-review-panel/SKILL.md` | Orchestration (read by orchestrator). Phase 0; Phase 14/14.5 docs; conditional Phase 15.1 subsection + `[USER-DECISION]` label; Phase 15.3 surfacing; Phase 17 + ingest; trigger description bundle sentinel; Process Overview; version header + HTML-footer instruction | 1,2,3,4,6,7,8 |
| `tests/behavioral-assertions.test.mjs` | Spec-presence assertions (the bulk of TDD) — one `describe("v3.6.0 …")` block, nested per stage | 1,2,3,4,6,7 |
| `tests/report-structure.test.mjs` | `parseReport()` extension: detect `[USER-DECISION]` deferral subsection + a describe block for the new fixture | 1 |
| `tests/bundle-roundtrip.test.mjs` (NEW) | Reference `serializeBundle()`/`parseBundle()` + round-trip + hand-edited tolerance + parse-the-documented-example | 5 |
| `tests/fixtures/sample-report-user-decision.md` (NEW) | Complete valid report carrying a `### ⚖️ Deferred to You ([USER-DECISION])` subsection | 1 |
| `tests/golden/sample-report-user-decision.golden.json` (NEW, auto-generated) | Snapshot of the new fixture's fingerprint | 1 |
| `package.json` | version 3.6.0; register `bundle-roundtrip.test.mjs` in `scripts.test` | 5,8 |
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `eval-suite.json` | version 3.6.0 | 8 |
| `CHANGELOG.md`, `references/changelog.md`, `ROADMAP.md`, `README.md` | v3.6.0 changelog + ROADMAP v3.6.0 row + v3.7.0 deferral row + README test-count | 8 |

**Spec-section coverage map** (sections build-order §12 doesn't number): §9 conditional subsection → Stage 1. §2.1 recommended-answer reconciliation → Stage 2. §5 canonical finding-ID → Stages 4 & 5. §13 hand-edited tolerance → Stage 5. Headless gating (§7/§8) → Stages 2 & 3.

---

## Task 1: Judge `[USER-DECISION]` label + Phase 14.5 guard + conditional 15.1 subsection + fixture

Implements spec §3.1, §3.2, §9, and the §13 adversarial-guard risk. This is the **producer + safety** stage.

**Files:**
- Modify: `skills/agent-review-panel/references/prompt-templates.md` (Phase 14 judge prompt; Phase 14.5 prompt)
- Modify: `skills/agent-review-panel/SKILL.md` (Phase 14.5 doc; Phase 15.1 epistemic-labels + Disagreement Points subsection)
- Modify: `tests/behavioral-assertions.test.mjs` (new describe block)
- Modify: `tests/report-structure.test.mjs` (`parseReport` extension + describe block)
- Create: `tests/fixtures/sample-report-user-decision.md`
- Create (auto): `tests/golden/sample-report-user-decision.golden.json`

- [ ] **Step 1: Write the failing spec-presence test.** Append to `tests/behavioral-assertions.test.mjs` (before the final `export { … }` line):

```js
describe("v3.6.0 producer: [USER-DECISION] label + Phase 14.5 guard", () => {
  const promptTemplates = readFileSync(
    resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
    "utf-8"
  );

  it("Phase 14 judge prompt defines [USER-DECISION] as a sixth disagreement outcome", () => {
    const phase14 = promptTemplates
      .split(/^## Phase 14: Supreme Judge Prompt/m)[1]
      .split(/^## Sycophancy Alert Injection/m)[0];
    assert.match(
      phase14,
      /\[USER-DECISION\][\s\S]{0,400}?no fact of the matter/i,
      "Phase 14 prompt must define [USER-DECISION] as a no-fact-of-the-matter outcome"
    );
    assert.match(
      phase14,
      /\[USER-DECISION\][\s\S]{0,600}?you (MUST rule|may not defer)/i,
      "Phase 14 prompt must forbid deferring an evidence-answerable disagreement"
    );
  });

  it("Phase 14.5 prompt adds the [USER-DECISION] kick-back check + [USER-DECISION-REJECTED] verdict", () => {
    const phase14_5 = promptTemplates
      .split(/^## Phase 14\.5/m)[1]
      .split(/^## Phase 15\.2/m)[0];
    assert.match(
      phase14_5,
      /\[USER-DECISION\][\s\S]{0,400}?disguised[\s\S]{0,200}?verifiable/i,
      "Phase 14.5 must check each [USER-DECISION] is not a disguised verifiable question"
    );
    assert.match(
      phase14_5,
      /\[USER-DECISION-REJECTED\][\s\S]{0,200}?\[DISPUTED\]/i,
      "Phase 14.5 must re-classify a rejected deferral as [DISPUTED]"
    );
  });

  it("Phase 14.5 prompt ships a worked example of the guard FIRING (few-shot safety)", () => {
    const phase14_5 = promptTemplates
      .split(/^## Phase 14\.5/m)[1]
      .split(/^## Phase 15\.2/m)[0];
    assert.match(
      phase14_5,
      /Worked example[\s\S]{0,600}?\[USER-DECISION-REJECTED\]/i,
      "Phase 14.5 must include a worked example ending in [USER-DECISION-REJECTED]"
    );
    assert.match(
      phase14_5,
      /Worked example[\s\S]{0,800}?(grep|Read|describe|wc -l)/i,
      "the worked example must show a concrete ground-truth probe command"
    );
  });

  it("SKILL.md Phase 14.5 documents the [USER-DECISION] kick-back behavior", () => {
    assert.match(
      skillMd,
      /## Phase 14\.5[\s\S]+?\[USER-DECISION\][\s\S]{0,400}?\[USER-DECISION-REJECTED\]/,
      "SKILL.md Phase 14.5 section must document the kick-back to [USER-DECISION-REJECTED]"
    );
  });

  it("SKILL.md Phase 15.1 adds [USER-DECISION] to the epistemic-labels list", () => {
    assert.match(
      skillMd,
      /Epistemic labels:[\s\S]*?\[USER-DECISION\]/,
      "Phase 15.1 epistemic-labels list must include [USER-DECISION]"
    );
  });

  it("SKILL.md Phase 15.1 defines a CONDITIONAL '⚖️ Deferred to You' subsection (golden-safe)", () => {
    const disagreement = skillMd
      .split(/^## Disagreement Points/m)[1]
      .split(/^## Completeness Audit Findings/m)[0];
    assert.match(
      disagreement,
      /### ⚖️ Deferred to You \(\[USER-DECISION\]\)/,
      "Disagreement Points must define the ⚖️ Deferred to You subsection"
    );
    assert.match(
      disagreement,
      /(only when|≥\s*1|rendered only|omitted entirely)/i,
      "the subsection MUST be documented as conditional (rendered only when ≥1 item) so existing goldens stay byte-identical"
    );
  });
});
```

- [ ] **Step 2: Run it red.** `npm run test:behavioral` → expect the 6 new `it`s to FAIL ("must define [USER-DECISION] …").

- [ ] **Step 3: Edit `prompt-templates.md` — Phase 14 judge prompt.** In the "## Steps (in order):" block, immediately after step `2. **Rule on Each Disagreement** …` (ends `…it represents targeted investigation by a specialist beyond what the panel performed.`), insert:

```
   **Sixth outcome — `[USER-DECISION]`:** a preference / priority / business
   call with **no fact of the matter** resolvable by code, docs, or a command —
   a genuine tradeoff only the user's context settles (latency vs. correctness,
   scope-cut vs. ship). Use ONLY when the disagreement cannot be settled by
   inspection. If the disagreement *is* answerable by evidence, you **MUST
   rule — you may not defer.** `[USER-DECISION]` is NOT an escape hatch for a
   question you could not verify; Phase 14.5 kicks back any disguised-verifiable
   claim to `[DISPUTED]`.
```

  Then in step `7. **Classify All Findings** with epistemic labels:`, add one bullet after the `[STATIC-INFERENCE-CONSENSUS]` bullet:

```
   - **[USER-DECISION]**: a value/priority/business tradeoff with no fact of the matter — deferred to the user, resolved in Phase 17, never grounding a severity ruling (v3.6.0)
```

- [ ] **Step 4: Edit `prompt-templates.md` — Phase 14.5 prompt.** In the `## Procedure` block, after the `4. **External-domain claims** …` item and before `## Verdicts`, insert:

```
## [USER-DECISION] kick-back check (v3.6.0)

For every disagreement the Supreme Judge ruled `[USER-DECISION]`, confirm it is
a genuine value/priority call and NOT a disguised verifiable question the judge
could not answer. Apply a cheap ground-truth probe (grep / Read / command)
appropriate to the claim:

- If code, docs, or a command CAN settle it → verdict
  `[USER-DECISION-REJECTED]`: re-classify the point as `[DISPUTED]`, route it
  back into normal ruling, and record the override in the verification table.
  The judge may not launder an unanswered correctness question as a "tradeoff".
- If no fact of the matter exists (a confirmed value/priority call) → it passes
  through unchanged as `[USER-DECISION]`.

**Worked example (the guard firing).** Judge ruled `[USER-DECISION]`: "Whether
to add a retry to the scorecards API call is a reliability-vs-simplicity
tradeoff for the user." Probe:

```
$ grep -rn "scorecards" src/ | grep -i retry
src/clients/scorecards.py:14:@retry(max_attempts=3, backoff=2)
```

The premise is false — a retry decorator already wraps the call, so this is not
an open tradeoff. Verdict `[USER-DECISION-REJECTED]` → re-classified
`[DISPUTED]` and ruled by evidence (the finding is moot). Contrast a genuine
pass-through: "P0 vs P1 for the missing dashboard legend" — no command settles a
severity-priority preference, so it stays `[USER-DECISION]`.
```

  Then in the `## Verdicts` list, add (after `[JUDGE-PARTIAL]`):

```
- **[USER-DECISION-REJECTED]**: a judge `[USER-DECISION]` deferral that a cheap
  probe could in fact settle. Re-classified `[DISPUTED]` and ruled on evidence;
  the deferral does not survive to the report (v3.6.0).
```

- [ ] **Step 5: Edit `SKILL.md` — Phase 14.5 doc.** After the "**Empty case.**" paragraph in the `## Phase 14.5` section (ends `…so Phase 15.1's disk-read still succeeds.`), insert:

```
**[USER-DECISION] kick-back (v3.6.0).** The gate ALSO guards the new judge
`[USER-DECISION]` deferral (a no-fact-of-the-matter tradeoff — see Phase 15.1).
For each `[USER-DECISION]` the judge left, Phase 14.5 applies a cheap
ground-truth probe; a deferral a command could in fact settle is verdicted
`[USER-DECISION-REJECTED]`, re-classified `[DISPUTED]`, and routed back into
normal ruling. Only confirmed value/priority calls survive to the report. This
is the load-bearing guard that stops `[USER-DECISION]` becoming a
correctness-dodge.
```

- [ ] **Step 6: Edit `SKILL.md` — Phase 15.1 epistemic labels + Disagreement subsection.** On the `Epistemic labels:` line (currently ends `…[STATIC-INFERENCE-CONSENSUS]`), append ` [USER-DECISION]`. Then under `## Disagreement Points (with judge rulings)`, after its existing `{Each disagreement: …}` line, insert:

```
{If ≥1 surviving [USER-DECISION] item exists (post Phase 14.5 kick-back):}
### ⚖️ Deferred to You ([USER-DECISION])
{Conditional subsection — rendered ONLY when ≥1 [USER-DECISION] survives. For
each: the tradeoff, each side, the "if forced" lean + why, and "this is your
call." Phase 17 resolves these. When zero items exist the subsection is omitted
entirely, so reports without deferrals stay byte-identical to prior versions.}
```

- [ ] **Step 7: Run it green.** `npm run test:behavioral` → all 6 new `it`s PASS. Run `npm test` → still 443 (no fixture yet) + 6 = 449, 0 fail. (Exact total will be re-counted in Task 8.)

- [ ] **Step 8: Write the `parseReport` extension test (red).** In `tests/report-structure.test.mjs`, inside `parseReport`, after the `--- No-debate warning ---` block (sets `report.noDebate`), add:

```js
  // --- User-decision deferral (v3.6.0) ---
  report.userDecision = {
    detected: /^###\s*⚖️\s*Deferred to You\s*\(\[USER-DECISION\]\)/m.test(markdown),
    count: (markdown.match(/\[USER-DECISION\]/g) || []).length,
  };
```

  Then append a new describe block at the end of the file (before `export { parseReport }`):

```js
describe("user-decision fixture (v3.6.0)", () => {
  it("detects the ⚖️ Deferred to You subsection when a [USER-DECISION] survives", () => {
    const md = readFileSync(
      resolve(FIXTURES, "sample-report-user-decision.md"),
      "utf-8"
    );
    const report = parseReport(md);
    assert.equal(report.userDecision.detected, true);
    assert.ok(report.userDecision.count >= 1, "fixture must carry ≥1 [USER-DECISION]");
  });

  it("the user-decision fixture parses with zero structural errors (full contract)", () => {
    const md = readFileSync(
      resolve(FIXTURES, "sample-report-user-decision.md"),
      "utf-8"
    );
    const report = parseReport(md);
    assert.equal(report.errors.length, 0, `parse errors: ${report.errors.join("; ")}`);
  });

  it("[USER-DECISION] never appears as a numbered action item (lives in the subsection only)", () => {
    const md = readFileSync(
      resolve(FIXTURES, "sample-report-user-decision.md"),
      "utf-8"
    );
    const actionLines = md.split("\n").filter((l) => /^\d+\.\s+\*\*/.test(l));
    for (const line of actionLines) {
      assert.ok(
        !line.includes("[USER-DECISION]"),
        `action item must not carry [USER-DECISION]: ${line}`
      );
    }
  });

  it("fixtures without a deferral report userDecision.detected = false", () => {
    for (const name of ["sample-report-valid.md", "sample-report-no-debate.md"]) {
      const report = parseReport(readFileSync(resolve(FIXTURES, name), "utf-8"));
      assert.equal(report.userDecision?.detected ?? false, false);
    }
  });
});
```

- [ ] **Step 9: Run it red.** `npm run test:report` → the 4 new `it`s FAIL (fixture file does not exist → readFileSync throws / detected false).

- [ ] **Step 10: Create the fixture.** Copy the existing valid fixture verbatim, then insert the deferral subsection:

```bash
cp tests/fixtures/sample-report-valid.md tests/fixtures/sample-report-user-decision.md
```

  Open `tests/fixtures/sample-report-user-decision.md`. (a) Change the H1/title line and `**Work reviewed:**` value to something distinct (e.g. `Review of the notifications-service rollout plan`) so it reads as its own report — do NOT alter header *field names* or the verdict/confidence/review-mode values (the contract tests depend on them). (b) Find the `## Disagreement Points` section and, immediately after its existing body and before the next `## ` heading, insert:

```markdown
### ⚖️ Deferred to You ([USER-DECISION])

1. **Synchronous vs. async notification delivery** — `[USER-DECISION]`
   - **Side A (Architecture Critic):** async via a queue decouples the request
     path and survives downstream outages.
   - **Side B (Feasibility Analyst):** synchronous is simpler to operate and the
     current volume never approaches the queue's break-even point.
   - **If forced:** async, because the outage-decoupling is worth the operational
     cost — *but this is your call*, and it flips if you expect volume to stay
     flat for 12+ months or the on-call team is small.
   - This is a business/priority tradeoff with no fact of the matter; resolve in
     Phase 17.
```

  (This block carries `[USER-DECISION]` only inside the `###` subsection — never as a numbered action item — and the `1.` list item is `**Synchronous…` which does NOT match the action-item regex `^\d+\.\s+\*\*\[P[0-3]\]`, so it is not parsed as an action item.)

- [ ] **Step 11: Generate the golden + run green.** `UPDATE_GOLDEN=1 npm run test:golden` creates `tests/golden/sample-report-user-decision.golden.json`. Then:
  - `npm run test:report` → 4 new `it`s PASS, all existing fixture-contract tests PASS for the new fixture.
  - `npm run test:golden` → all goldens PASS; **verify the 4 pre-existing goldens are unchanged** with `git status --short tests/golden/` (only the new `sample-report-user-decision.golden.json` should be untracked; no existing golden modified — confirms byte-stability).

- [ ] **Step 12: Commit.**

```bash
git add skills/agent-review-panel/references/prompt-templates.md \
        skills/agent-review-panel/SKILL.md \
        tests/behavioral-assertions.test.mjs \
        tests/report-structure.test.mjs \
        tests/fixtures/sample-report-user-decision.md \
        tests/golden/sample-report-user-decision.golden.json
git commit -m "feat(v3.6.0): judge [USER-DECISION] label + Phase 14.5 kick-back guard + conditional deferral subsection"
```

---

## Task 2: Grill engine core (Phase 17 prompt) + terminal downstream ② + state output

Implements spec §2, §2.1, §7 (terminal entry + headless gating). The grill prompt is **defined ONCE** here; Stages 3 and 6 reference it.

**Files:**
- Modify: `skills/agent-review-panel/references/prompt-templates.md` (new `## Phase 17` prompt block, after Phase 16)
- Modify: `skills/agent-review-panel/SKILL.md` (new `## Phase 17` section; Process Overview line; state-file inventory)
- Modify: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 1: Write the failing test.** Add inside the v3.6.0 area of `tests/behavioral-assertions.test.mjs`:

```js
describe("v3.6.0 grill engine (Phase 17) + terminal entry", () => {
  const promptTemplates = readFileSync(
    resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
    "utf-8"
  );

  it("prompt-templates.md defines the Phase 17 grill prompt exactly once", () => {
    const occurrences = (promptTemplates.match(/^## Phase 17: Decision Resolution/gm) || []).length;
    assert.equal(occurrences, 1, "the grill prompt must be defined exactly once");
  });

  it("the grill prompt interviews one question at a time and self-answers first", () => {
    const phase17 = promptTemplates.split(/^## Phase 17: Decision Resolution/m)[1] || "";
    assert.match(phase17, /one (question|item) at a time/i, "must interview one at a time");
    assert.match(phase17, /explore[\s\S]{0,200}?self-answer/i, "must explore code/context to self-answer first");
  });

  it("the grill prompt reconciles the recommended answer (§2.1 — no confident guessing)", () => {
    const phase17 = promptTemplates.split(/^## Phase 17: Decision Resolution/m)[1] || "";
    assert.match(
      phase17,
      /If forced[\s\S]{0,160}?because[\s\S]{0,160}?your call/i,
      "must frame the lean as 'if forced X because Y — your call'"
    );
    assert.match(
      phase17,
      /what would change the answer|changes? the answer/i,
      "must state what would change the answer"
    );
  });

  it("the grill prompt writes state/phase_17_decision_resolution.md and does NOT mutate the report", () => {
    const phase17 = promptTemplates.split(/^## Phase 17: Decision Resolution/m)[1] || "";
    assert.match(phase17, /phase_17_decision_resolution\.md/, "must write the state file");
    assert.match(phase17, /not mutate|do not mutate|is not mutated/i, "must not mutate the verified report");
  });

  it("SKILL.md declares Phase 17 with the terminal-entry offer + headless skip", () => {
    assert.match(skillMd, /## Phase 17: Decision Resolution/, "SKILL.md must declare Phase 17");
    const phase17 = skillMd.split(/^## Phase 17: Decision Resolution/m)[1].split(/^## /m)[0];
    assert.match(phase17, /surviving `?\[USER-DECISION\]`?[\s\S]{0,200}?(offer|auto-offer)/i, "must auto-offer when ≥1 [USER-DECISION] survives");
    assert.match(phase17, /(headless|non-interactive|batch)[\s\S]{0,120}?skip/i, "must skip the offer in headless/batch runs");
  });

  it("SKILL.md state-file inventory lists phase_17_decision_resolution.md", () => {
    assert.match(skillMd, /phase_17_decision_resolution\.md/, "state inventory must list the Phase 17 file");
  });
});
```

- [ ] **Step 2: Run it red.** `npm run test:behavioral` → 6 new FAIL.

- [ ] **Step 3: Add the Phase 17 prompt to `prompt-templates.md`** at the END of the file (after the Phase 16 closing ``` fence at the bottom):

```
---

## Phase 17: Decision Resolution — Grill Engine (v3.6.0)

The grill engine is the single interview primitive shared by all three
human-in-the-loop entry points (Phase 0 upstream, the terminal downstream
offer, and HTML feedback ingest). It is the grill-me interview pattern
**inlined** — there is NO hard dependency on the external `grill-me` skill
(other installers will not have it). It is defined ONCE here; Phase 0 and the
ingest path reference this block.

```
You are the Decision-Resolution interviewer. You hold a list of OPEN DECISIONS —
business / priority / tradeoff calls with no fact of the matter: judge
`[USER-DECISION]` items, plan-level open choices (Phase 0), or `QUESTION`-status
findings from a pasted feedback bundle (ingest). Resolve them with the user.

## Protocol
1. Interview ONE question at a time. Never batch.
2. Before asking, explore the code / context to self-answer where possible —
   read the finding, grep the cited files, check the Context Brief. Resolve
   anything actually answerable yourself and tell the user you did (do not make
   the user adjudicate a question you can settle).
3. For each genuine decision, present:
   - The decision, and WHY it has no fact of the matter (what makes it the
     user's call rather than something you can verify).
   - The options, each with its concrete tradeoff.
   - **Recommended-answer reconciliation (§2.1):** frame your lean as
     "**If forced, I'd choose X because Y — but this is YOUR call, and here is
     what would change the answer: Z.**" NEVER present a confident
     recommendation on a business-priority call; these are precisely the calls
     you should not be confident on.
4. Record the user's choice and their reasoning verbatim.
5. Move to the next item. Stop when the list is exhausted.

## Output protocol
Write `{state_dir}/phase_17_decision_resolution.md`. Per item, record: the
options, the "if-forced" lean + rationale, the user's choice, and the user's
reasoning. Then give a concise chat summary. **Do NOT mutate the verified
report** (`review_panel_report.md` / `.html`) — the resolution is a separate
artifact so the audited verdict stays intact.
```
```

- [ ] **Step 4: Add the Phase 17 section to `SKILL.md`.** Insert a new `## Phase 17: Decision Resolution` section immediately after the `## Phase 16: Merge (v2.14, multi-run only)` block ends and before `## Run Comparison` (keep phase order; the ingest subsection is filled in Task 6 — for now include the ② terminal entry and a placeholder header for ③):

```
## Phase 17: Decision Resolution (v3.6.0, optional, human-in-the-loop)

Phase 17 is the terminal human-in-the-loop layer. All three entry points are
driven by ONE grill engine (see `references/prompt-templates.md` → Phase 17).

### ② Terminal downstream
After the report is written, if **≥1 surviving `[USER-DECISION]` item exists**
(post Phase 14.5 kick-back) **AND the session is interactive**, auto-**offer** a
terminal interview to resolve them via the grill engine. In
non-interactive / headless / batch runs the offer is **skipped** — the
`[USER-DECISION]` items simply remain visible in the report's
"⚖️ Deferred to You" subsection. The offer is always an offer, never auto-run.
Output → `state/phase_17_decision_resolution.md`; the verified report is not
mutated.

### ③ HTML feedback ingest
Filled in below ("Ingest Mode") — a pasted HTML feedback bundle routes its
`QUESTION` items into this same grill engine.
```

  Then add `phase_17_decision_resolution.md` to the state-file inventory: in `## Implementation Notes` → "Single-run layout" code block, add a line after `└── review_panel_report.html`:

```
└── state/phase_17_decision_resolution.md   # v3.6.0 — Phase 17 (only if run)
```

  (Place it as a sibling under `state/`; adjust the tree connector so it reads cleanly — it is conditional, written only when Phase 17 runs.) Also add to the prose sentence listing orchestrator-level state files (the "…`state/phase_14_5_judge_verification.md` (v3.2.0)" sentence): append `, and `state/phase_17_decision_resolution.md` (v3.6.0, only when Phase 17 runs)`.

  Finally, update the **Process Overview** ASCII block (top of SKILL.md) — add a line after the Phase 16 line:

```
[Human-in-the-loop (optional, interactive only): Phase 0 (pre-panel) + Phase 17 (post-report)]
Phase 17:   Decision Resolution       → Grill engine resolves [USER-DECISION] items / HTML feedback (v3.6.0)
```

- [ ] **Step 5: Run it green.** `npm run test:behavioral` → 6 new PASS. `npm test` → 0 fail.

- [ ] **Step 6: Commit.**

```bash
git add skills/agent-review-panel/references/prompt-templates.md \
        skills/agent-review-panel/SKILL.md \
        tests/behavioral-assertions.test.mjs
git commit -m "feat(v3.6.0): Phase 17 grill engine (defined once) + terminal decision-resolution offer + state output"
```

---

## Task 3: Upstream Phase 0 (plan-mode gate) + Locked-Decisions reviewer injection

Implements spec §8.

**Files:**
- Modify: `skills/agent-review-panel/SKILL.md` (new `## Phase 0` before Phase 1; Context Brief step 6)
- Modify: `skills/agent-review-panel/references/prompt-templates.md` (Phase 3 reviewer prompt Locked-Decisions block)
- Modify: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 1: Write the failing test.** Add:

```js
describe("v3.6.0 upstream Phase 0 (plan-mode decision lock)", () => {
  const promptTemplates = readFileSync(
    resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
    "utf-8"
  );

  it("SKILL.md declares Phase 0 BEFORE Phase 1 Setup", () => {
    assert.match(skillMd, /## Phase 0: Pre-Panel Decision Lock/, "must declare Phase 0");
    assert.match(
      skillMd,
      /## Phase 0: Pre-Panel Decision Lock[\s\S]+?## Phase 1: Setup/,
      "Phase 0 must appear before Phase 1 in SKILL.md"
    );
  });

  it("Phase 0 is gated on plan/design content + interactive session, default OFFER", () => {
    const phase0 = skillMd.split(/^## Phase 0/m)[1].split(/^## Phase 1/m)[0];
    assert.match(phase0, /plan|design|proposal/i, "gate references plan/design content");
    assert.match(phase0, /interactive/i, "gate requires an interactive session");
    assert.match(phase0, /offer/i, "default is offer, not auto-run");
    assert.match(phase0, /grill engine|Phase 17/i, "Phase 0 reuses the Phase 17 grill engine");
    assert.match(phase0, /Locked Decisions/, "Phase 0 writes Locked Decisions into the Context Brief");
  });

  it("Context Brief lists a Locked Decisions section", () => {
    assert.match(skillMd, /Context Brief[\s\S]{0,400}?Locked Decisions/, "Context Brief must include Locked Decisions");
  });

  it("Phase 3 reviewer prompt carries the Locked Decisions context block", () => {
    const phase3 = promptTemplates.split(/^## Phase 4/m)[0];
    assert.match(phase3, /Locked Decisions/, "Phase 3 prompt must include a Locked Decisions block");
    assert.match(
      phase3,
      /Locked Decisions[\s\S]{0,400}?(do not re-litigate|review the plan as if|settled by the user)/i,
      "reviewers must be told not to re-litigate locked decisions"
    );
  });
});
```

- [ ] **Step 2: Run it red.** `npm run test:behavioral` → 4 new FAIL.

- [ ] **Step 3: Add Phase 0 to `SKILL.md`** immediately before `## Phase 1: Setup` (line ~129):

```
## Phase 0: Pre-Panel Decision Lock (v3.6.0, optional, plan-mode)

Runs BEFORE Phase 1 Setup. **Gate:** the review target is a plan / design /
proposal (per Review-Mode Detection v2.8 — content type *Pure plan/design* or
*Mixed*) **AND** the session is interactive. Default = **OFFER**, not auto-run;
in non-interactive / headless / batch runs Phase 0 is skipped entirely.

**Effect:** runs the same grill engine (see `references/prompt-templates.md` →
Phase 17) over the OPEN DECISIONS in the plan — the unresolved
business / priority / tradeoff choices the plan leaves open — *before* reviewers
launch. Each decided answer is written into the Context Brief (Phase 1 step 6)
as a new **"Locked Decisions"** subsection.

**Reviewer injection:** reviewer prompts gain a "Locked Decisions" context block:
"these choices are settled by the user; review the plan as if decided — do not
re-litigate them or flag them as underspecified." See
`references/prompt-templates.md` → Phase 3 reviewer prompt.

---
```

- [ ] **Step 4: Context Brief step 6.** In `## Phase 1: Setup` → Context Gathering step `6. **Context Brief**`, change the sections list to include Locked Decisions:

  Find: `Knowledge Mining Results, Web Research Findings, Domain Checklist, Context Gaps.`
  Replace with: `Knowledge Mining Results, Web Research Findings, Domain Checklist, Locked Decisions (Phase 0, if run), Context Gaps.`

- [ ] **Step 5: Add the Locked-Decisions block to the Phase 3 reviewer prompt** in `prompt-templates.md`. In the `## Phase 3: Independent Reviewer Prompt` block (between line 17 and the Phase 4 header), add — near where context is injected — a block:

```
{If Phase 0 ran — Locked Decisions:}
## Locked Decisions (v3.6.0)
The user has already settled the following open decisions in this plan. They are
**settled by the user** — review the plan **as if these are decided**. Do NOT
re-litigate them, do NOT flag them as underspecified, and do NOT propose
alternatives to them. Review everything else normally.
{list of locked decisions with the user's chosen answer}
```

- [ ] **Step 6: Run it green.** `npm run test:behavioral` → 4 new PASS. `npm test` → 0 fail.

- [ ] **Step 7: Commit.**

```bash
git add skills/agent-review-panel/SKILL.md \
        skills/agent-review-panel/references/prompt-templates.md \
        tests/behavioral-assertions.test.mjs
git commit -m "feat(v3.6.0): upstream Phase 0 pre-panel decision lock + Locked-Decisions reviewer injection"
```

---

## Task 4: HTML per-card feedback widgets + localStorage (Phase 15.3)

Implements spec §4.1, §4.2, §5. Instructions go in `prompt-templates.md` Phase 15.3 (the HTML agent reads it); SKILL.md gets a surfacing mention. **The new feedback JS must not collide** with existing keyboard-nav / filter / deep-link / Chart.js logic (assert it).

**Files:**
- Modify: `skills/agent-review-panel/references/prompt-templates.md` (Phase 15.3: run identity, per-card widget, JS isolation)
- Modify: `skills/agent-review-panel/SKILL.md` (Phase 15.3 surfacing)
- Modify: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 1: Write the failing test.** Add:

```js
describe("v3.6.0 HTML per-card feedback widgets (Phase 15.3)", () => {
  const promptTemplates = readFileSync(
    resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
    "utf-8"
  );
  const phase15_3 = promptTemplates.split(/^## Phase 15\.3/m)[1] || "";

  it("Phase 15.3 spec defines a per-card feedback widget with the four statuses", () => {
    assert.match(phase15_3, /feedback (widget|footer)/i, "must define a feedback widget");
    assert.match(phase15_3, /Sign-?off/i);
    assert.match(phase15_3, /Question/i);
    assert.match(phase15_3, /Change-?requested/i);
    assert.match(phase15_3, /free-?text|textarea/i, "must include a free-text box");
  });

  it("[USER-DECISION] cards are pre-badged and default to Question", () => {
    assert.match(
      phase15_3,
      /\[USER-DECISION\][\s\S]{0,200}?(Needs your call|pre-?badg)/i,
      "[USER-DECISION] cards pre-badged 'Needs your call'"
    );
    assert.match(
      phase15_3,
      /\[USER-DECISION\][\s\S]{0,260}?default[\s\S]{0,60}?Question/i,
      "[USER-DECISION] cards default the selector to Question"
    );
  });

  it("persistence is localStorage keyed {run-id}:{issue-id}", () => {
    assert.match(phase15_3, /RUN_ID/, "must define a RUN_ID constant");
    assert.match(
      phase15_3,
      /localStorage[\s\S]{0,200}?\$\{?RUN_ID\}?:?\$?\{?issue/i,
      "localStorage key must combine RUN_ID and the issue id"
    );
  });

  it("the feedback JS is isolated from existing interactive JS (no collision)", () => {
    assert.match(
      phase15_3,
      /(MUST NOT|must not)[\s\S]{0,200}?(filters|keydown|hashchange|Chart\.js)/i,
      "feedback JS must be documented as non-colliding with filter/keyboard/deep-link/Chart.js"
    );
    assert.match(
      phase15_3,
      /re-?bind[\s\S]{0,120}?renderItems/i,
      "feedback widgets must re-bind after renderItems() re-inserts cards"
    );
  });

  it("the widget is a separate footer, NOT an 11th accordion section (10-section invariant intact)", () => {
    assert.match(
      phase15_3,
      /(separate footer|NOT an? (11th|eleventh|accordion section))/i,
      "must preserve the fixed 10-section order"
    );
  });

  it("SKILL.md Phase 15.3 surfaces the feedback widget feature", () => {
    assert.match(
      skillMd,
      /## Phase 15[\s\S]+?### Phase 15\.3[\s\S]+?feedback (widget|footer)/i,
      "SKILL.md Phase 15.3 must mention the per-card feedback widget"
    );
  });
});
```

  *(Note: `SKILL.md` has the Phase 15.3 surfacing in the `### Phase 15.3` subsection — confirm/extend that subsection text; if the current SKILL.md Phase 15.3 surfacing is terse, the last assertion guides what to add.)*

- [ ] **Step 2: Run it red.** `npm run test:behavioral` → 6 new FAIL.

- [ ] **Step 3: Add to `prompt-templates.md` Phase 15.3.** After the issue-card "Expandable Card Structure (v2.15 — 10-section accordion)" block (after section "10" of the accordion, before the "### 7. Consensus & Disagreements Section"), add:

```
### Run identity (v3.6.0)

Emit a single `const RUN_ID = "{run-slug}";` near the top of the page script,
where `{run-slug}` is the review output directory name (e.g.
`2026-06-08-notifications-rollout`) — the stable per-run identifier. All
feedback persistence and the export bundle header (Phase 15.3 export toolbar)
use `RUN_ID`.

### Per-card feedback widget (v3.6.0)

After the 10-section accordion, every issue card's expanded body ends with a
**feedback footer** — `<div class="feedback-widget" data-issue-id="{id}">`:

- **Status selector** — four mutually-exclusive options: ✅ Sign-off · ❓ Question ·
  ✏️ Change-requested · (none). Render as a radio group or a `<select>`.
- **Free-text** `<textarea class="feedback-note">` for the comment.
- **`[USER-DECISION]` cards are PRE-BADGED** "⚖️ Needs your call" and **default**
  the selector to ❓ Question.
- **Persistence (localStorage):** on change, write
  `localStorage.setItem(\`arp-feedback:${RUN_ID}:${issueId}\`, JSON.stringify({status, note}))`;
  on load, rehydrate each widget from that key. No backend — the file stays a
  self-contained single page.
- The feedback footer is a **separate footer, NOT an 11th accordion section** —
  the fixed 10-section order (v2.15) is unchanged.

**JS isolation (v3.6.0) — no collision.** All feedback handlers live in one
`feedbackInit()` function scoped to `.feedback-widget[data-issue-id]` selectors.
It **MUST NOT** read or write the existing `filters` object, the `keydown`
issue-navigation listener, the deep-link `hashchange` handler, or any Chart.js
instance. Because `renderItems()` re-inserts cards on every filter change,
**call `feedbackInit()` at the end of `renderItems()`** so widgets re-bind (and
rehydrate from localStorage) after re-insertion.
```

- [ ] **Step 4: Surface in `SKILL.md` Phase 15.3.** In the `### Phase 15.3: HTML Report` subsection, add a sentence:

```
**Per-card feedback widget (v3.6.0).** Each issue card's expanded body ends with
a feedback footer (✅ Sign-off / ❓ Question / ✏️ Change-requested + free text),
persisted to `localStorage` keyed `arp-feedback:{run-id}:{issue-id}`;
`[USER-DECISION]` cards are pre-badged "⚖️ Needs your call". The full rendering
+ JS-isolation spec lives in `references/prompt-templates.md` → Phase 15.3.
```

- [ ] **Step 5: Run it green.** `npm run test:behavioral` → 6 new PASS. `npm test` → 0 fail.

- [ ] **Step 6: Commit.**

```bash
git add skills/agent-review-panel/references/prompt-templates.md \
        skills/agent-review-panel/SKILL.md \
        tests/behavioral-assertions.test.mjs
git commit -m "feat(v3.6.0): HTML per-card feedback widgets + localStorage persistence (Phase 15.3)"
```

---

## Task 5: Export serializer + bundle grammar + round-trip test

Implements spec §4.3, §6, §6.1, §13. The bundle grammar is the **single source of truth** — byte-identical across the producer spec, the documented example, the parser prose, and the test's reference parser. The round-trip test reads the documented example *out of* `prompt-templates.md` so prose and test cannot drift.

**Files:**
- Modify: `skills/agent-review-panel/references/prompt-templates.md` (export toolbar + bundle grammar + §6.1 example)
- Create: `tests/bundle-roundtrip.test.mjs`
- Modify: `package.json` (register the new test file in `scripts.test`)

- [ ] **Step 1: Add the export toolbar + grammar + example to `prompt-templates.md` Phase 15.3** (right after the Per-card feedback widget block from Task 4):

````
### Feedback export toolbar (v3.6.0)

The Action Items toolbar gains two buttons:

- **📋 Copy feedback for Claude** — serializes all non-empty annotations into the
  feedback bundle (grammar below) and writes it to the clipboard.
- **⬇ Download feedback** — the same payload, downloaded as
  `feedback-${RUN_ID}.txt`.

Serialize by reading every `arp-feedback:${RUN_ID}:*` localStorage entry, joining
each to its finding ID and title (read the title from the card's `<summary>`).
**Items with no annotation are omitted.** The bundle is **self-contained** —
every block carries its finding title — so ingest never needs the original
report or `state/` files (the round-trip is async; those paths may be gone by
paste-back time).

#### Feedback bundle grammar (the producer↔consumer contract — v3.6.0)

This grammar is the exact contract between this HTML serializer (producer) and
the skill's ingest parser (consumer, SKILL.md Ingest Mode). It MUST be emitted
byte-for-byte in this shape:

```
=== AGENT-REVIEW-PANEL FEEDBACK · run {run-id} ===
report: {report-title}
generated: {iso-date}

[{ID}] {SIGNOFF|QUESTION|CHANGE} "{finding-title}"
> {optional free-text, one or more lines, each prefixed "> "}
=== END FEEDBACK ===
```

- The sentinel header `=== AGENT-REVIEW-PANEL FEEDBACK` is how the skill
  recognizes a pasted bundle (it is in the skill's trigger description).
- One block per annotated item. `{ID}` = the canonical **finding ID** (`A1`,
  `B3` — the same id used by `id="issue-{id}"`), NOT the `AI-n` action-item id.
- The status token is uppercase: `SIGNOFF` (✅), `QUESTION` (❓), `CHANGE` (✏️).
- `{finding-title}` is double-quoted and makes the block self-describing.
- Free-text lines are optional, each prefixed `> `.
- Items with no annotation are omitted.

#### Example bundle (v3.6.0)

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
````

- [ ] **Step 2: Write the round-trip test (red).** Create `tests/bundle-roundtrip.test.mjs`:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Reference implementation of the feedback bundle contract (v3.6.0).
// Mirrors the parseReport() reference-parser precedent in report-structure.test.mjs:
// this IS the executable specification of the grammar in prompt-templates.md
// Phase 15.3. The skill's prose parser/serializer must match this behavior.
// ---------------------------------------------------------------------------

const STATUS_TOKENS = { SIGNOFF: "SIGNOFF", QUESTION: "QUESTION", CHANGE: "CHANGE" };

function serializeBundle({ runId, reportTitle, generated, items }) {
  const lines = [
    `=== AGENT-REVIEW-PANEL FEEDBACK · run ${runId} ===`,
    `report: ${reportTitle}`,
    `generated: ${generated}`,
    "",
  ];
  for (const it of items) {
    if (!it.status && !(it.note && it.note.length)) continue; // omit un-annotated
    lines.push(`[${it.id}] ${it.status} "${it.title}"`);
    if (it.note) {
      for (const noteLine of it.note.split("\n")) lines.push(`> ${noteLine}`);
    }
  }
  lines.push("=== END FEEDBACK ===");
  return lines.join("\n");
}

function parseBundle(text) {
  const result = { runId: null, reportTitle: null, generated: null, items: [], errors: [] };
  const header = text.match(/===\s*AGENT-REVIEW-PANEL FEEDBACK\s*·\s*run\s+(.+?)\s*===/);
  if (!header) {
    result.errors.push("missing sentinel header");
    return result;
  }
  result.runId = header[1].trim();
  const titleM = text.match(/^report:\s*(.+)$/m);
  if (titleM) result.reportTitle = titleM[1].trim();
  const genM = text.match(/^generated:\s*(.+)$/m);
  if (genM) result.generated = genM[1].trim();

  // Block lines: [ID] STATUS "title", followed by optional "> " note lines.
  const lines = text.split("\n");
  let current = null;
  const blockRe = /^\[([A-Za-z]+\d+)\]\s+(SIGNOFF|QUESTION|CHANGE)\s+"(.*)"\s*$/;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, ""); // tolerate trailing whitespace
    const bm = line.match(blockRe);
    if (bm) {
      if (current) result.items.push(current);
      current = { id: bm[1], status: STATUS_TOKENS[bm[2]], title: bm[3], note: "" };
      continue;
    }
    if (current && /^>\s?/.test(line)) {
      const noteLine = line.replace(/^>\s?/, "");
      current.note = current.note ? `${current.note}\n${noteLine}` : noteLine;
    }
  }
  if (current) result.items.push(current);
  for (const it of result.items) it.note = it.note || null;
  return result;
}

describe("Feedback bundle round-trip (v3.6.0)", () => {
  const canonical = {
    runId: "2026-06-08-a3f",
    reportTitle: "Review of campaign-uplift pipeline",
    generated: "2026-06-08",
    items: [
      { id: "A1", status: "CHANGE", title: "Temporal exclusion only covers the first Christmas", note: "Jan-6 start excludes one Christmas; a second is still in the training window.\nPlease re-derive across the full date range." },
      { id: "B3", status: "SIGNOFF", title: "DELETE-then-INSERT is idempotent", note: null },
      { id: "C2", status: "QUESTION", title: "Missing retry on the scorecards API call (P1)", note: "Why P1 not P0? What's the blast radius if it fails in prod?" },
    ],
  };

  it("serialize → parse returns the original structure", () => {
    const text = serializeBundle(canonical);
    const parsed = parseBundle(text);
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.runId, canonical.runId);
    assert.equal(parsed.reportTitle, canonical.reportTitle);
    assert.equal(parsed.items.length, 3);
    assert.deepEqual(
      parsed.items.map((i) => [i.id, i.status, i.title]),
      [["A1", "CHANGE", "Temporal exclusion only covers the first Christmas"],
       ["B3", "SIGNOFF", "DELETE-then-INSERT is idempotent"],
       ["C2", "QUESTION", "Missing retry on the scorecards API call (P1)"]]
    );
    assert.match(parsed.items[0].note, /re-derive across the full date range/);
    assert.equal(parsed.items[1].note, null); // SIGNOFF with no free-text
  });

  it("omits un-annotated items from the bundle", () => {
    const text = serializeBundle({
      ...canonical,
      items: [...canonical.items, { id: "D9", status: "", title: "untouched", note: "" }],
    });
    assert.ok(!text.includes("[D9]"), "items with no annotation must be omitted");
  });

  it("tolerates a hand-edited bundle (§13): extra whitespace, reordered blocks, missing free-text", () => {
    const handEdited = [
      "=== AGENT-REVIEW-PANEL FEEDBACK · run hand-edited-1 ===",
      "report: Reordered + whitespaced",
      "generated: 2026-06-08",
      "",
      '[C2] QUESTION "Missing retry on the scorecards API call (P1)"   ', // trailing ws
      ">  Why P1?", // extra space after >
      '[B3] SIGNOFF "DELETE-then-INSERT is idempotent"', // no free-text, reordered first->later
      "",
      '[A1] CHANGE "Temporal exclusion only covers the first Christmas"',
      "> single line note",
      "=== END FEEDBACK ===",
    ].join("\n");
    const parsed = parseBundle(handEdited);
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.items.length, 3);
    const byId = Object.fromEntries(parsed.items.map((i) => [i.id, i]));
    assert.equal(byId.C2.status, "QUESTION");
    assert.match(byId.C2.note, /Why P1\?/);
    assert.equal(byId.B3.note, null);
    assert.equal(byId.A1.status, "CHANGE");
  });

  it("the documented example in prompt-templates.md conforms to the grammar (prose↔test parity)", () => {
    const promptTemplates = readFileSync(
      resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
      "utf-8"
    );
    // Pull the example bundle block (sentinel header → END FEEDBACK) verbatim.
    const m = promptTemplates.match(
      /(===\s*AGENT-REVIEW-PANEL FEEDBACK[\s\S]*?===\s*END FEEDBACK ===)/
    );
    assert.ok(m, "prompt-templates.md must contain a documented example bundle");
    const parsed = parseBundle(m[1]);
    assert.equal(parsed.errors.length, 0, "the documented example must parse cleanly");
    assert.ok(parsed.items.length >= 3, "documented example must show ≥3 annotated items");
    // Status tokens in the documented example must all be valid.
    for (const it of parsed.items) {
      assert.ok(["SIGNOFF", "QUESTION", "CHANGE"].includes(it.status), `bad status ${it.status}`);
    }
  });
});

export { serializeBundle, parseBundle };
```

- [ ] **Step 3: Register the new test file.** In `package.json`, append ` tests/bundle-roundtrip.test.mjs` to the end of the `"test"` script's file list (before the closing quote):

```json
"test": "node --test tests/trigger-classification.test.mjs tests/manifest-consistency.test.mjs tests/eval-suite-integrity.test.mjs tests/report-structure.test.mjs tests/behavioral-assertions.test.mjs tests/golden-file.test.mjs tests/voltagent-catalog.test.mjs tests/bundle-roundtrip.test.mjs",
```

  Also add a convenience script alongside the others: `"test:bundle": "node --test tests/bundle-roundtrip.test.mjs",`.

- [ ] **Step 4: Run it.** First the catch: the prose example must already be present (added in Step 1). Run `npm run test:bundle`:
  - If you wrote Step 1 first, all 4 PASS.
  - To prove TDD honestly, temporarily comment out the example block in `prompt-templates.md`, run `npm run test:bundle` → the "documented example … conforms" test FAILS ("must contain a documented example bundle") → restore the block → re-run → PASS.

- [ ] **Step 5: Run the full suite.** `npm test` → new file's 4 tests included, 0 fail.

- [ ] **Step 6: Commit.**

```bash
git add skills/agent-review-panel/references/prompt-templates.md \
        tests/bundle-roundtrip.test.mjs \
        package.json
git commit -m "feat(v3.6.0): feedback bundle grammar + export toolbar + round-trip/hand-edited/example-parity tests"
```

---

## Task 6: Ingest parser + status routing + grill handoff

Implements spec §7 (ingest mode + routing) and the trigger-description bundle sentinel.

**Files:**
- Modify: `skills/agent-review-panel/SKILL.md` (frontmatter trigger description; Phase 17 Ingest Mode subsection)
- Modify: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 1: Write the failing test.** Add:

```js
describe("v3.6.0 ingest mode + status routing (Phase 17 ③)", () => {
  it("the skill's trigger description recognizes a pasted feedback bundle sentinel", () => {
    const fm = skillMd.match(/^---\n([\s\S]*?)\n---/)[1];
    assert.match(
      fm,
      /=== AGENT-REVIEW-PANEL FEEDBACK/,
      "frontmatter description must mention the bundle sentinel header so a paste triggers ingest"
    );
  });

  it("Phase 17 documents ingest: parse from paste alone, never re-read state/", () => {
    const phase17 = skillMd.split(/^## Phase 17: Decision Resolution/m)[1].split(/^## /m)[0];
    assert.match(phase17, /Ingest Mode|HTML feedback ingest/i, "must have an ingest subsection");
    assert.match(
      phase17,
      /parse[\s\S]{0,160}?(from the paste alone|never re-?read)/i,
      "ingest must parse from the paste alone, never re-read state/"
    );
  });

  it("ingest routes SIGNOFF→close, CHANGE→action item, QUESTION→grill", () => {
    const phase17 = skillMd.split(/^## Phase 17: Decision Resolution/m)[1].split(/^## /m)[0];
    assert.match(phase17, /SIGNOFF[\s\S]{0,80}?(accepted|closed|close)/i, "SIGNOFF → record as accepted/closed");
    assert.match(phase17, /CHANGE[\s\S]{0,80}?action item/i, "CHANGE → emit an action item");
    assert.match(phase17, /QUESTION[\s\S]{0,80}?grill/i, "QUESTION → feed the grill engine");
  });

  it("ingest writes the Phase 17 state file and does not mutate the verified report", () => {
    const phase17 = skillMd.split(/^## Phase 17: Decision Resolution/m)[1].split(/^## /m)[0];
    assert.match(phase17, /phase_17_decision_resolution\.md/);
  });
});
```

- [ ] **Step 2: Run it red.** `npm run test:behavioral` → 4 new FAIL.

- [ ] **Step 3: Add the bundle sentinel to the SKILL.md frontmatter trigger description.** At the end of the `description: >` block (after the "data flow trace tiers" sentence, before the closing `---`), append:

```
  Also trigger when the user pastes a block whose first line begins
  "=== AGENT-REVIEW-PANEL FEEDBACK" — that is an exported HTML feedback bundle
  from a prior panel run; parse it and resolve it via Phase 17 ingest mode
  (sign-offs close, change-requests become action items, questions go to the
  grill engine).
```

- [ ] **Step 4: Fill the Ingest Mode subsection in SKILL.md Phase 17.** Replace the `### ③ HTML feedback ingest` placeholder (added in Task 2) with:

```
### ③ HTML feedback ingest (pasted bundle) — Ingest Mode

**Trigger:** the user pastes a block whose first line begins
`=== AGENT-REVIEW-PANEL FEEDBACK` (the sentinel is in the skill's trigger
description). This is the async round-trip from the HTML report's "📋 Copy
feedback for Claude" / "⬇ Download feedback" export.

- **Parse from the paste ALONE** — never re-read `state/` or the report file.
  The round-trip is async; those paths may be long gone. The bundle is
  self-contained: each block carries its finding ID and title (see the bundle
  grammar in `references/prompt-templates.md` → Phase 15.3).
- **Route by status:**
  - `SIGNOFF` → record the finding as accepted/closed.
  - `CHANGE` → emit it as an action item, carrying the user's free-text verbatim.
  - `QUESTION` → feed it into the Phase 17 grill engine — answer from code where
    possible, otherwise interview.
- Treat the bundle as **user-authored intent** (relevant when a report is
  annotated, possibly by a third party).
- **Output** → `state/phase_17_decision_resolution.md` + a concise chat summary.
  The verified report is not mutated.
```

- [ ] **Step 5: Run it green.** `npm run test:behavioral` → 4 new PASS. Also re-run `npm run test:triggers` (frontmatter change) → still 0 fail. `npm test` → 0 fail.

- [ ] **Step 6: Commit.**

```bash
git add skills/agent-review-panel/SKILL.md \
        tests/behavioral-assertions.test.mjs
git commit -m "feat(v3.6.0): HTML feedback ingest mode (parse-from-paste) + status routing + bundle-sentinel trigger"
```

---

## Task 7: plan-review-integrator handoff (plan-mode, user-gated)

Implements spec §12 stage 7.

**Files:**
- Modify: `skills/agent-review-panel/SKILL.md` (Phase 17 handoff note)
- Modify: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 1: Write the failing test.** Add:

```js
describe("v3.6.0 plan-review-integrator handoff", () => {
  it("Phase 17 offers a user-gated, plan-mode-only handoff to plan-review-integrator", () => {
    const phase17 = skillMd.split(/^## Phase 17: Decision Resolution/m)[1].split(/^## /m)[0];
    assert.match(phase17, /plan-review-integrator/, "must reference plan-review-integrator");
    assert.match(phase17, /plan-mode|plan\/design/i, "handoff is plan-mode only");
    assert.match(phase17, /(user-gated|offer|never auto-run)/i, "handoff is user-gated, never auto-run");
    assert.match(
      phase17,
      /phase_17_decision_resolution\.md[\s\S]{0,160}?(action items|plan)/i,
      "handoff passes the resolution artifact + action items into the plan"
    );
  });
});
```

- [ ] **Step 2: Run it red.** `npm run test:behavioral` → 1 new FAIL.

- [ ] **Step 3: Add the handoff note** at the end of the SKILL.md `## Phase 17` section (after the Ingest Mode subsection):

```
### plan-review-integrator handoff (v3.6.0, plan-mode, user-gated)

When the review target was a plan / design AND decisions were resolved (Phase 0
upstream or Phase 17 downstream), **offer** to hand the resolved decisions plus
the report's action items to the `plan-review-integrator` skill to fold them
back into the plan document. This is **plan-mode only and user-gated** — never
auto-run. The handoff passes `state/phase_17_decision_resolution.md` and the
report's action items; plan-review-integrator cross-references each against the
plan and applies edits. (See the Dependencies note: "For post-review plan
updates, use plan-review-integrator.")
```

- [ ] **Step 4: Run it green.** `npm run test:behavioral` → PASS. `npm test` → 0 fail.

- [ ] **Step 5: Commit.**

```bash
git add skills/agent-review-panel/SKILL.md tests/behavioral-assertions.test.mjs
git commit -m "feat(v3.6.0): plan-review-integrator handoff (plan-mode, user-gated)"
```

---

## Task 8: Version bump (all files) + changelog + ROADMAP + README count + release gate

Implements spec §11, §14, §10 (ROADMAP v3.7.0 deferral). **This is the release stage — `scripts/release-check.sh` is the gate.**

**Files:** `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `package.json`, `skills/agent-review-panel/eval-suite.json`, `skills/agent-review-panel/SKILL.md` (H1 + HTML-footer instruction), `CHANGELOG.md`, `skills/agent-review-panel/references/changelog.md`, `ROADMAP.md`, `README.md`.

- [ ] **Step 1: Bump the four manifests + eval-suite to 3.6.0.**
  - `.claude-plugin/plugin.json`: `"version": "3.5.0"` → `"3.6.0"`.
  - `.claude-plugin/marketplace.json`: the `roundtable` plugin entry `"version": "3.5.0"` → `"3.6.0"`.
  - `package.json`: `"version": "3.5.0"` → `"3.6.0"`.
  - `skills/agent-review-panel/eval-suite.json`: `"version": "3.5.0"` → `"3.6.0"` (release-check enforces this even though `npm test` skips it).

- [ ] **Step 2: Bump SKILL.md H1 + HTML-footer instruction.**
  - Line 34 `# Agent Review Panel v3.5.0` → `# Agent Review Panel v3.6.0`.
  - Locate the HTML-footer instruction (`grep -n 'HTML footer should read' skills/agent-review-panel/SKILL.md`) and bump its `v3.5` → `v3.6`.

- [ ] **Step 3: Add the CHANGELOG.md section** at the top (after the intro line), matching the `## [X.Y.Z] — date — title` format:

```markdown
## [3.6.0] — 2026-06-08 — Human-in-the-loop decision resolution

Adds a human-in-the-loop layer on top of the existing epistemic discipline: one **grill engine** (the grill-me interview pattern inlined — no hard dependency on the external skill) with three entry points, plus a judge `[USER-DECISION]` label guarded by Phase 14.5, and an HTML feedback round-trip. Default-off and additive; existing golden fixtures stay byte-identical.

### Added
- **Judge `[USER-DECISION]` label** (Phase 14) — a sixth disagreement outcome for business/priority tradeoffs with no fact of the matter. The judge may NOT defer an evidence-answerable disagreement.
- **Phase 14.5 kick-back guard** — re-classifies a disguised-verifiable deferral as `[USER-DECISION-REJECTED]` → `[DISPUTED]`, with a worked example in the prompt. The load-bearing safety check that stops `[USER-DECISION]` becoming a correctness-dodge.
- **Phase 17 grill engine** (defined once) — three entry points: ① upstream Phase 0 plan-mode decision lock, ② terminal offer over surviving `[USER-DECISION]` items, ③ HTML feedback bundle ingest. Recommended-answer reconciliation: "if forced X because Y — but your call, here's what changes it." Writes `state/phase_17_decision_resolution.md`; never mutates the verified report. Interactive-only (skipped headless/batch).
- **Phase 0 — Pre-Panel Decision Lock** — grills open plan decisions before reviewers launch; writes a "Locked Decisions" Context-Brief block injected into reviewer prompts ("review as if decided — do not re-litigate").
- **HTML per-card feedback** (Phase 15.3) — ✅ Sign-off / ❓ Question / ✏️ Change-requested + free text per issue card, persisted to `localStorage` keyed `arp-feedback:{run-id}:{issue-id}`; `[USER-DECISION]` cards pre-badged "⚖️ Needs your call". Export toolbar ("📋 Copy feedback for Claude" / "⬇ Download feedback") serializes a self-contained feedback bundle. JS isolated from the existing filter/keyboard/deep-link/Chart.js logic.
- **Feedback bundle grammar** — a first-class producer↔consumer contract, pinned by a round-trip + hand-edited-tolerance + documented-example-parity test (`tests/bundle-roundtrip.test.mjs`).
- **Conditional "⚖️ Deferred to You" report subsection** (Phase 15.1) — rendered only when ≥1 `[USER-DECISION]` survives, so reports without deferrals stay byte-identical. One new golden fixture (`sample-report-user-decision.md`).
- **plan-review-integrator handoff** — plan-mode, user-gated, after decisions are resolved.

### Deferred to v3.7.0
- last30days `[COMMUNITY-SIGNAL]` research input — tracked as [#58](https://github.com/wan-huiyan/agent-review-panel/issues/58). See ROADMAP.md.
```

- [ ] **Step 4: Add a v3.6.0 entry to `references/changelog.md`** at the top (after `# Changelog`), matching the existing secondary-changelog style (terse + pointer to root):

```markdown
## v3.6.0 (2026-06-08) — Human-in-the-loop decision resolution

Adds a human-in-the-loop layer: one inlined grill engine with three entry points (upstream Phase 0 plan-mode decision lock, terminal `[USER-DECISION]` resolution, HTML feedback bundle ingest), a judge `[USER-DECISION]` label guarded by a Phase 14.5 kick-back (with worked example), HTML per-card feedback widgets + a self-contained export bundle (round-trip tested), and a plan-review-integrator handoff. Default-off, additive; existing goldens byte-identical via a conditional report subsection. See root `CHANGELOG.md` for the full entry.
```

- [ ] **Step 5: Add the ROADMAP.md rows.** Add a v3.6.0 **shipped** row and the v3.7.0 deferral row (the v3.7.0 deferral is already linked to #58 per the recent commit — verify it exists; if not, add it). Match the existing ROADMAP row format (`grep -n 'v3.5.0\|v3.7.0' ROADMAP.md` first to see the table/list shape, then add a v3.6.0 row of the same shape):

```
| v3.6.0 | Human-in-the-loop decision resolution (grill engine, [USER-DECISION] + Phase 14.5 guard, HTML feedback round-trip) | Shipped 2026-06-08 |
```

  Ensure a v3.7.0 row exists for last30days `[COMMUNITY-SIGNAL]` (tracked #58). (release-check only asserts a v3.6.0 row exists; the v3.7.0 row satisfies spec §10.)

- [ ] **Step 6: Run the full suite + get the actual test count.** `npm test 2>&1 | tail -5` → note `# tests <N>` (the new total). Expect 0 fail.

- [ ] **Step 7: Update the README test-count claim.** `grep -n '443 tests\|443' README.md` → update every test-count claim to the new `<N>`. (release-check asserts "README test-count claims match actual".)

- [ ] **Step 8: Run the release gate.** `bash scripts/release-check.sh` → **all assertions must pass** with canonical version `3.6.0`. Fix any drift it reports (it is the authoritative version check). Re-run `npm test` → 0 fail.

- [ ] **Step 9: Commit.**

```bash
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json package.json \
        skills/agent-review-panel/eval-suite.json \
        skills/agent-review-panel/SKILL.md \
        CHANGELOG.md skills/agent-review-panel/references/changelog.md \
        ROADMAP.md README.md
git commit -m "chore(release): v3.6.0 — version bump, changelog, ROADMAP, README test-count"
```

---

## Task 9: PR + self-review (dogfood)

- [ ] **Step 1: Final verification.** `npm test` (0 fail, goldens byte-stable) + `bash scripts/release-check.sh` (all pass). Confirm `git status --short tests/golden/` shows only the new golden was added (no existing golden mutated).

- [ ] **Step 2: Push + open the PR** from `feat/grill-me-decision-resolution` with a test-plan checklist. PR body MUST include `Closes #58`? **No** — #58 is the *deferred* v3.7.0 tracking issue; do NOT close it. Reference the spec and list the 7 stages. State explicitly: *"The §3.2 guard is verified as **specified** (worked example + presence assertions), not as **fired** — no LLM runs in CI."*

```bash
git push -u origin feat/grill-me-decision-resolution
gh pr create --title "feat: human-in-the-loop decision resolution (v3.6.0)" --body "<test-plan + stage checklist + guard caveat + spec link>"
```

- [ ] **Step 3: Self-review (dogfood).** Run `superpowers:requesting-code-review`, or dogfood the panel itself on the diff. Address findings before merge. After green CI, self-merge per the established solo-repo pattern (stable-gate + self-merge), then cut `git tag v3.6.0` + `gh release create` (body = the CHANGELOG section) per this repo's release process.

---

## Self-review (plan vs. spec)

**Spec coverage:** §1 problem → addressed across all stages. §2 one engine / three entry points → Task 2 (engine), Task 3 (①), Task 2 (②), Task 6 (③). §2.1 reconciliation → Task 2 Step 3 + test. §3.1 label → Task 1. §3.2 guard → Task 1 (+ worked example, the safety artifact). §4.1/4.2/4.3 HTML → Task 4 (widget/localStorage) + Task 5 (export). §5 canonical finding-ID → Task 4 (`data-issue-id`/`id="issue-{id}"`) + Task 5 grammar note ("finding ID not AI-n"). §6/§6.1 grammar+example → Task 5. §7 ingest+routing+terminal+headless → Task 2 (terminal+headless) + Task 6 (ingest/routing). §8 Phase 0 → Task 3. §9 conditional subsection + fixture → Task 1. §10 v3.7.0 deferral → Task 8 Step 5 (ROADMAP) + CHANGELOG "Deferred". §11 edit surface → all tasks match. §12 build stages → Tasks 1–7. §13 risks (guard, JS collision, bundle robustness) → Task 1 (guard adversarial example), Task 4 (collision assertion), Task 5 (hand-edited tolerance). §14 version files → Task 8.

**Placeholder scan:** none — every code/content step shows the exact text or exact test. The only deliberately deferred specifics are (a) the exact insertion line for the SKILL.md HTML-footer bump (resolved by a given `grep`), and (b) the ROADMAP/README row shapes (resolved by a given `grep` before editing) — both are "match the file's existing shape" instructions, not invented content.

**Type/name consistency:** state file `phase_17_decision_resolution.md` (Tasks 2, 6, 7). localStorage key `arp-feedback:{run-id}:{issue-id}` (Tasks 4, 5). Status tokens `SIGNOFF|QUESTION|CHANGE` uppercase (Tasks 5, 6). Label `[USER-DECISION]` / verdict `[USER-DECISION-REJECTED]` (Tasks 1, 2). `RUN_ID` constant (Tasks 4, 5). Grammar sentinel `=== AGENT-REVIEW-PANEL FEEDBACK` (Tasks 5, 6). Phase 17 prompt defined ONCE (Task 2; Tasks 3 & 6 *reference*, never redefine — Task 2's "defined exactly once" test enforces this).
