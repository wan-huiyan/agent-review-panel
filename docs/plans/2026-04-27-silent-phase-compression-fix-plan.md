# v3.1.0 Silent Phase Compression Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate silent compression of Phases 4/5/7 in the agent-review-panel skill by routing subagent outputs through disk-based state files, adding a pre-judge verification gate, and surfacing residual compression as a fail-loud `⚠️ COMPRESSED RUN` report header.

**Architecture:** The skill spec (`SKILL.md` + `references/prompt-templates.md`) is the artifact being modified. All Phase 3/4/5/7 reviewer prompts, plus Phase 8/10/11 verifier prompts, gain a directive to write their output to `state/<reviewer>_phase_<N>.md` and return only a path + 100-word summary. A new Phase 13.5 verification gate checks file existence + minimum-bytes + required-headers before allowing Phase 14 (Supreme Judge) to launch. Phase 14 reads state files on demand and materializes its ruling to `phase_14_judge_ruling.md`. Phase 15.1 / 15.3 conditionally render a COMPRESSED RUN warning when the gate detected unrecoverable phase loss.

**Tech Stack:** Markdown skill spec, Node.js test runner (`node --test`), regex-based content assertions in `tests/behavioral-assertions.test.mjs`, fixture-driven structural assertions in `tests/report-structure.test.mjs`, golden-file snapshot tests.

**Reference:** [Design doc](docs/plans/2026-04-27-silent-phase-compression-fix-design.md), [Issue #35](https://github.com/wan-huiyan/agent-review-panel/issues/35)

---

## File Structure

**Files to create:**
- `tests/fixtures/sample-report-compressed-run.md` — fixture demonstrating the COMPRESSED RUN header pattern, used by report-structure and golden tests
- `tests/golden/sample-report-compressed-run.golden.json` — committed golden snapshot for the compressed-run fixture

**Files to modify:**
- `skills/agent-review-panel/SKILL.md` — multiple sections (Implementation Notes, Phases 3, 4, 5, 7, 8, 10, 11, 14, 15.1, 15.3, new Phase 13.5, Phase 16 multi-run section)
- `skills/agent-review-panel/references/prompt-templates.md` — Phase 3, 4, 5, 7 reviewer prompts; Phase 8 audit prompt; Phase 10/11 verification prompts; Phase 14 judge prompt
- `tests/behavioral-assertions.test.mjs` — add SKILL.md content assertions for v3.1.0 features
- `tests/report-structure.test.mjs` — recognize the optional COMPRESSED RUN header block
- `CHANGELOG.md` — add v3.1.0 entry
- `package.json` — bump version 3.0.0 → 3.1.0
- `.claude-plugin/plugin.json` — bump version 3.0.0 → 3.1.0
- `skills/agent-review-panel/references/changelog.md` — add v3.1.0 entry mirroring root CHANGELOG

---

## Conventions Used Below

- Every prose block intended for SKILL.md / prompt-templates.md is enclosed in triple backticks with `markdown` syntax. Copy verbatim.
- "Run tests:" assumes the working directory is the repo root.
- "Commit:" steps use a per-task message; squash at the end is fine but not required.
- For surgical edits, the plan shows a `Find:` block (the existing text to locate) and a `Replace with:` block (the new text). Use the Edit tool's exact-match behavior.

---

## Task 1: State directory convention in SKILL.md Implementation Notes

**Files:**
- Modify: `skills/agent-review-panel/SKILL.md` (Implementation Notes section, around line 1328)
- Test: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 1.1: Write the failing test**

Open `tests/behavioral-assertions.test.mjs`. Find the existing `describe(...)` block for SKILL.md content checks (search for `describe("SKILL.md" ` or similar — if absent, add a new one at the bottom of the file). Add this test:

```javascript
describe("v3.1.0 file-based state convention", () => {
  it("documents the state/ directory layout in Implementation Notes", () => {
    assert.match(
      skillMd,
      /state\/reviewer_<name>_phase_<N>\.md/,
      "SKILL.md must document the state file naming convention"
    );
    assert.match(
      skillMd,
      /Implementation Notes[\s\S]+?state\/.+?phase_14_judge_ruling\.md/,
      "Implementation Notes must list phase_14_judge_ruling.md as a materialized state file"
    );
  });

  it("documents multi-run namespacing under state/", () => {
    assert.match(
      skillMd,
      /state\/run_\d+\/reviewer/,
      "SKILL.md must document run_<N>/ namespacing for multi-run mode"
    );
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npm run test:behavioral`
Expected: 2 new assertions FAIL (the patterns are not yet in SKILL.md).

- [ ] **Step 1.3: Add the State Files subsection to SKILL.md Implementation Notes**

Find the line `## Implementation Notes` in `skills/agent-review-panel/SKILL.md` (around line 1328). Immediately after that heading, before the existing content, insert this subsection:

````markdown
### State files (v3.1.0+)

Subagent outputs for Phases 3, 4, 5, 7, 8, 10, 11, and 14 are written to disk
under a `state/` subdirectory of the review output directory, then the
subagent returns only the file path plus a 100-word summary. The orchestrator
reads files on demand rather than holding verbatim subagent outputs in its
context window.

**Single-run layout:**

```
docs/reviews/<date>-<topic>/
├── state/
│   ├── reviewer_<name>_phase_3.md         # independent review
│   ├── reviewer_<name>_phase_4.md         # private reflection
│   ├── reviewer_<name>_phase_5_round1.md  # debate response
│   ├── reviewer_<name>_phase_7.md         # blind final assessment
│   ├── phase_8_audit.md
│   ├── phase_10_claim_verification.md
│   ├── phase_11_severity_verification.md
│   └── phase_14_judge_ruling.md
├── review_panel_report.md                  # Phase 15.1
├── review_panel_process.md                 # Phase 15.2
└── review_panel_report.html                # Phase 15.3
```

**Multi-run layout (Phase 16):**

```
docs/reviews/<date>-<topic>/
├── state/
│   ├── run_1/reviewer_<name>_phase_3.md
│   ├── run_1/reviewer_<name>_phase_4.md
│   ├── ...
│   ├── run_2/reviewer_<name>_phase_3.md
│   └── ...
```

Each run's state lives under `state/run_<N>/`. The merge step (Phase 16)
reads state files from each run independently when computing union findings.

This pattern mirrors `overnight-insight-discovery`, `successor-handoff`, and
`cloud-run-results-bq-postsync` — every long-running multi-agent skill in the
local catalog routes intermediate outputs through disk to keep the
orchestrator window small.
````

- [ ] **Step 1.4: Run test to verify it passes**

Run: `npm run test:behavioral`
Expected: PASS for both new assertions in the v3.1.0 describe block.

- [ ] **Step 1.5: Commit**

```bash
git add skills/agent-review-panel/SKILL.md tests/behavioral-assertions.test.mjs
git commit -m "feat(skill): document state/ directory convention for v3.1.0"
```

---

## Task 2: Phase 3 reviewer writes to disk

**Files:**
- Modify: `skills/agent-review-panel/SKILL.md` (Phase 3 section, line 598)
- Modify: `skills/agent-review-panel/references/prompt-templates.md` (Phase 3 prompt, line 17)
- Test: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 2.1: Write the failing test**

Append to the v3.1.0 describe block in `tests/behavioral-assertions.test.mjs`:

```javascript
  it("Phase 3 reviewer prompt writes output to disk", () => {
    const promptTemplates = readFileSync(
      resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
      "utf-8"
    );
    const phase3 = promptTemplates.split(/^## Phase 4/m)[0];
    assert.match(
      phase3,
      /Write your full (output|review) to.*reviewer_.*phase_3\.md/i,
      "Phase 3 prompt must direct the reviewer to write to state/reviewer_<name>_phase_3.md"
    );
    assert.match(
      phase3,
      /100[- ]word summary/i,
      "Phase 3 prompt must request a 100-word summary in the chat return"
    );
  });
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npm run test:behavioral`
Expected: FAIL — Phase 3 prompt does not yet contain disk-write directive.

- [ ] **Step 2.3: Update Phase 3 prompt template**

In `skills/agent-review-panel/references/prompt-templates.md`, find the `## Phase 3: Independent Reviewer Prompt` section. At the end of that section's prompt body (before `## Phase 4: Private Reflection Prompt`), append:

````markdown
**Output protocol (v3.1.0+):** Write your full review to
`{state_dir}/reviewer_{persona_short_name}_phase_3.md`. Then return ONLY:

1. The absolute path you wrote to.
2. A 100-word summary of your top conclusions and severity counts.

Do NOT return your full review in chat. The orchestrator reads from disk.
````

- [ ] **Step 2.4: Update SKILL.md Phase 3 spec**

In `skills/agent-review-panel/SKILL.md`, find the `## Phase 3: Independent Review (Round 0)` section (around line 598). After the section's existing description text, before the next `## Phase 4` heading, append:

```markdown
**Output (v3.1.0+):** Each reviewer subagent writes its full review to
`state/reviewer_<name>_phase_3.md` and returns only the path + a 100-word
summary. The orchestrator does NOT hold verbatim reviews in its window.
```

- [ ] **Step 2.5: Run test to verify it passes**

Run: `npm run test:behavioral`
Expected: PASS for the new Phase 3 assertion.

- [ ] **Step 2.6: Commit**

```bash
git add skills/agent-review-panel/SKILL.md skills/agent-review-panel/references/prompt-templates.md tests/behavioral-assertions.test.mjs
git commit -m "feat(skill): Phase 3 reviewer writes review to state/ on disk"
```

---

## Task 3: Phase 4 reflection writes to disk

**Files:**
- Modify: `skills/agent-review-panel/SKILL.md` (Phase 4, line 610)
- Modify: `skills/agent-review-panel/references/prompt-templates.md` (Phase 4 prompt, line 120)
- Test: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 3.1: Write the failing test**

Append to the v3.1.0 describe block:

```javascript
  it("Phase 4 reflection prompt writes output to disk", () => {
    const promptTemplates = readFileSync(
      resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
      "utf-8"
    );
    const phase4 = promptTemplates
      .split(/^## Phase 4/m)[1]
      .split(/^## Phase 5/m)[0];
    assert.match(
      phase4,
      /reviewer_.*phase_4\.md/i,
      "Phase 4 prompt must direct disk-write to state/reviewer_<name>_phase_4.md"
    );
  });
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `npm run test:behavioral`
Expected: FAIL.

- [ ] **Step 3.3: Update Phase 4 prompt template**

In `references/prompt-templates.md`, find `## Phase 4: Private Reflection Prompt`. Append at the end of that section, before `## Phase 5`:

````markdown
**Output protocol (v3.1.0+):** Write your full reflection to
`{state_dir}/reviewer_{persona_short_name}_phase_4.md`. Return ONLY the path
plus a 100-word summary of changes from your Phase 3 review (what you'd
update, what you'd add, what you'd retract). Do NOT return the verbatim
reflection in chat.
````

- [ ] **Step 3.4: Update SKILL.md Phase 4 spec**

Find `## Phase 4: Private Reflection` in SKILL.md. After existing description, append:

```markdown
**Output (v3.1.0+):** Each reviewer's reflection is written to
`state/reviewer_<name>_phase_4.md`. Subagent returns only path + 100-word
summary.
```

- [ ] **Step 3.5: Run test to verify it passes**

Run: `npm run test:behavioral`
Expected: PASS.

- [ ] **Step 3.6: Commit**

```bash
git add -u
git commit -m "feat(skill): Phase 4 reflection writes to state/ on disk"
```

---

## Task 4: Phase 5 debate writes to disk

**Files:**
- Modify: `skills/agent-review-panel/SKILL.md` (Phase 5, line 618)
- Modify: `skills/agent-review-panel/references/prompt-templates.md` (Phase 5 prompt, line 144)
- Test: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 4.1: Write the failing test**

```javascript
  it("Phase 5 debate prompt writes round outputs to disk", () => {
    const promptTemplates = readFileSync(
      resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
      "utf-8"
    );
    const phase5 = promptTemplates
      .split(/^## Phase 5/m)[1]
      .split(/^## Phase 6|^## Phase 7/m)[0];
    assert.match(
      phase5,
      /reviewer_.*phase_5_round\d+\.md/i,
      "Phase 5 prompt must direct disk-write to state/reviewer_<name>_phase_5_round<R>.md"
    );
  });
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `npm run test:behavioral`
Expected: FAIL.

- [ ] **Step 4.3: Update Phase 5 prompt template**

In `references/prompt-templates.md`, find `## Phase 5: Debate Round Prompt`. Append at the end:

````markdown
**Output protocol (v3.1.0+):** Write your full debate response to
`{state_dir}/reviewer_{persona_short_name}_phase_5_round{round_number}.md`.
Return ONLY the path + a 100-word summary of: which reviewers you agreed
with, which you challenged, and your one new finding. Do NOT return the
verbatim debate response in chat.
````

- [ ] **Step 4.4: Update SKILL.md Phase 5 spec**

After the `## Phase 5: Debate (Rounds 1-3, adaptive)` heading description, append:

```markdown
**Output (v3.1.0+):** Each reviewer's per-round debate response is written
to `state/reviewer_<name>_phase_5_round<R>.md` (R = 1, 2, or 3). Round 1 is
mandatory; rounds 2 and 3 follow the existing convergence-based skip rules.
Subagent returns only path + 100-word summary.
```

- [ ] **Step 4.5: Run test to verify it passes**

Run: `npm run test:behavioral`
Expected: PASS.

- [ ] **Step 4.6: Commit**

```bash
git add -u
git commit -m "feat(skill): Phase 5 debate writes per-round outputs to state/ on disk"
```

---

## Task 5: Phase 7 blind final writes to disk

**Files:**
- Modify: `skills/agent-review-panel/SKILL.md` (Phase 7, line 646)
- Modify: `skills/agent-review-panel/references/prompt-templates.md` (Phase 7 prompt, line 179)
- Test: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 5.1: Write the failing test**

```javascript
  it("Phase 7 blind final prompt writes output to disk", () => {
    const promptTemplates = readFileSync(
      resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
      "utf-8"
    );
    const phase7 = promptTemplates
      .split(/^## Phase 7/m)[1]
      .split(/^## (Phase 8|Phase 10|Claim Verification)/m)[0];
    assert.match(
      phase7,
      /reviewer_.*phase_7\.md/i,
      "Phase 7 prompt must direct disk-write to state/reviewer_<name>_phase_7.md"
    );
  });
```

- [ ] **Step 5.2: Run test to verify it fails**

Run: `npm run test:behavioral`
Expected: FAIL.

- [ ] **Step 5.3: Update Phase 7 prompt template**

In `references/prompt-templates.md`, find `## Phase 7: Blind Final Assessment Prompt`. Append at the end:

````markdown
**Output protocol (v3.1.0+):** Write your blind final assessment to
`{state_dir}/reviewer_{persona_short_name}_phase_7.md`. Return ONLY the path
+ a 100-word summary of new findings (those NO reviewer mentioned). Do NOT
return the verbatim assessment in chat.
````

- [ ] **Step 5.4: Update SKILL.md Phase 7 spec**

After the `## Phase 7: Blind Final Assessment` heading description, append:

```markdown
**Output (v3.1.0+):** Each reviewer's blind final is written to
`state/reviewer_<name>_phase_7.md`. Subagent returns only path + 100-word
summary of new findings.
```

- [ ] **Step 5.5: Run test to verify it passes**

Run: `npm run test:behavioral`
Expected: PASS.

- [ ] **Step 5.6: Commit**

```bash
git add -u
git commit -m "feat(skill): Phase 7 blind final writes to state/ on disk"
```

---

## Task 6: Phases 8, 10, 11 verifiers write to disk

**Files:**
- Modify: `skills/agent-review-panel/SKILL.md` (Phases 8 / 10 / 11, lines 653, 686, 686+)
- Modify: `skills/agent-review-panel/references/prompt-templates.md` (verification prompts, around lines 238 / 314)
- Test: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 6.1: Write the failing test**

```javascript
  it("Phases 8, 10, 11 verifier prompts write outputs to disk", () => {
    const promptTemplates = readFileSync(
      resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
      "utf-8"
    );
    assert.match(
      promptTemplates,
      /phase_8_audit\.md/,
      "Phase 8 audit prompt must direct disk-write"
    );
    assert.match(
      promptTemplates,
      /phase_10_claim_verification\.md/,
      "Phase 10 verification prompt must direct disk-write"
    );
    assert.match(
      promptTemplates,
      /phase_11_severity_verification\.md/,
      "Phase 11 severity verification prompt must direct disk-write"
    );
  });
```

- [ ] **Step 6.2: Run test to verify it fails**

Run: `npm run test:behavioral`
Expected: FAIL on all three.

- [ ] **Step 6.3: Update Phase 8 / 10 / 11 prompts**

In `references/prompt-templates.md`, locate each of:
- The Phase 8 completeness audit prompt (search for "completeness audit" or scan around line 220-238)
- The Phase 10 Claim Verification prompt (around line 238, header `Claim Verification`)
- The Phase 11 Severity Verification prompt (around line 276 / 314)

Append to each prompt section:

````markdown
**Output protocol (v3.1.0+):** Write your full output to
`{state_dir}/{phase_filename}.md` where `{phase_filename}` is one of:
`phase_8_audit`, `phase_10_claim_verification`, `phase_11_severity_verification`.
Return ONLY the path + a 100-word summary of findings or verification
verdicts. Do NOT return verbatim verification text in chat.
````

(Adjust `{phase_filename}` to the specific phase in each instance.)

- [ ] **Step 6.4: Update SKILL.md Phase 8 / 10 / 11 sections**

After each of these phase headings in SKILL.md, append a one-line `**Output (v3.1.0+):**` directive matching the pattern from Tasks 2-5.

- [ ] **Step 6.5: Run test to verify it passes**

Run: `npm run test:behavioral`
Expected: PASS for all three assertions.

- [ ] **Step 6.6: Commit**

```bash
git add -u
git commit -m "feat(skill): Phase 8, 10, 11 verifiers write to state/ on disk"
```

---

## Task 7: New Phase 13.5 — Pre-Judge Verification Gate

**Files:**
- Modify: `skills/agent-review-panel/SKILL.md` (insert new Phase 13.5 between line 893 and the existing Phase 14 heading)
- Test: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 7.1: Write the failing test**

Append to the v3.1.0 describe block:

```javascript
  it("Phase 13.5 pre-judge verification gate is documented", () => {
    assert.match(
      skillMd,
      /## Phase 13\.5: Pre-Judge Verification Gate/,
      "SKILL.md must contain the Phase 13.5 verification gate section"
    );
    assert.match(
      skillMd,
      /## Phase 13\.5[\s\S]+?Existence check[\s\S]+?Minimum-bytes[\s\S]+?Required-headers/,
      "Phase 13.5 must document existence + minimum-bytes + required-headers checks"
    );
    assert.match(
      skillMd,
      /## Phase 13\.5[\s\S]+?single retry/i,
      "Phase 13.5 must document the single-retry policy"
    );
  });
```

- [ ] **Step 7.2: Run test to verify it fails**

Run: `npm run test:behavioral`
Expected: FAIL on all three (no Phase 13.5 yet).

- [ ] **Step 7.3: Insert Phase 13.5 into SKILL.md**

Find the line `## Phase 14: Supreme Judge` in SKILL.md (around line 893). Immediately BEFORE that heading, insert:

````markdown
## Phase 13.5: Pre-Judge Verification Gate (v3.1.0)

Before launching the Supreme Judge (Phase 14), the orchestrator MUST verify
that all mandatory phase outputs exist on disk. This gate is the load-bearing
guardrail against silent compression of Phases 4 / 5 / 7.

**Gate logic (orchestrator-executed, no subagent dispatch):**

For each reviewer in the panel, verify these files exist under `state/`
(or `state/run_<N>/` in multi-run mode):

| Required file | Phase | Mandatory |
|---|---|---|
| `reviewer_<name>_phase_3.md` | Independent review | Always |
| `reviewer_<name>_phase_4.md` | Private reflection | Always |
| `reviewer_<name>_phase_5_round1.md` | Debate round 1 | Always (rounds 2/3 per existing skip rules) |
| `reviewer_<name>_phase_7.md` | Blind final | Always |

Plus panel-level files:
- `phase_8_audit.md`
- `phase_10_claim_verification.md`
- `phase_11_severity_verification.md`

**For each required file, run three checks:**

1. **Existence check** — file is present on disk.
2. **Minimum-bytes check** — file size ≥ 500 bytes. Below this is empirically
   a stub (subagent crashed mid-write or returned a placeholder).
3. **Required-headers check** — parse the file and confirm it contains the
   required schema sections for that phase (e.g., a Phase 3 review must
   contain a Score, a Findings section, and severity tags). The exact required
   sections per phase are defined in `references/prompt-templates.md`.

**On gate failure for any file:**

1. Log loudly: `GATE FAIL: <file> missing | stub | malformed`
2. Re-dispatch the subagent for the missing/malformed phase output.
3. Re-run the gate after re-dispatch.
4. **Single retry only.** If the second attempt also fails, do NOT block the
   run. Mark the phase as unrecoverable, write the COMPRESSED RUN header in
   Phase 15.1 (see Phase 15.1 spec), and proceed to Phase 14 with the
   partial input. The deliverable is produced with explicit warning rather
   than failing entirely — partial review with loud warning beats no review.

**On full gate pass:** proceed to Phase 14. The COMPRESSED RUN header is NOT
emitted (its absence is the green light).

**Why bytes + headers, not just existence:** A subagent can write a stub and
crash, leaving an empty/partial file. Existence alone passes the gate on a
stub. Bytes + required-headers makes the check load-bearing. This mirrors
how the Phase 15 verification gate (v2.16.4) validates HTML output
structurally, not just by file presence.

````

- [ ] **Step 7.4: Run test to verify it passes**

Run: `npm run test:behavioral`
Expected: PASS for all three Phase 13.5 assertions.

- [ ] **Step 7.5: Commit**

```bash
git add -u
git commit -m "feat(skill): add Phase 13.5 Pre-Judge Verification Gate"
```

---

## Task 8: Phase 14 reads files on demand + materializes ruling to disk

**Files:**
- Modify: `skills/agent-review-panel/SKILL.md` (Phase 14, line 893)
- Modify: `skills/agent-review-panel/references/prompt-templates.md` (Phase 14 prompt, line 469)
- Test: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 8.1: Write the failing test**

```javascript
  it("Phase 14 reads state files on demand", () => {
    assert.match(
      skillMd,
      /## Phase 14: Supreme Judge[\s\S]+?reads? .*state.*on demand/i,
      "Phase 14 must document reading state files on demand"
    );
  });

  it("Phase 14 materializes ruling to phase_14_judge_ruling.md", () => {
    assert.match(
      skillMd,
      /phase_14_judge_ruling\.md/,
      "Phase 14 must write its ruling to state/phase_14_judge_ruling.md"
    );
  });
```

- [ ] **Step 8.2: Run test to verify it fails**

Run: `npm run test:behavioral`
Expected: FAIL on both.

- [ ] **Step 8.3: Update Phase 14 spec in SKILL.md**

Find `## Phase 14: Supreme Judge` in SKILL.md. Replace its current preamble paragraph (the one starting `Single agent (\`model: "opus"\`). Receives all prior outputs ...`) with:

```markdown
Single agent (`model: "opus"`). The launch prompt is ~200 tokens of metadata:
the paths to the state files produced by Phases 3, 4, 5, 7, 8, 10, 11, and
13. The judge **reads state files on demand** using the Read tool — it does
NOT receive verbatim phase outputs pre-stuffed into its launch prompt. This
mirrors the Phase 15.3 HTML-agent pattern (v2.16.4) and caps the judge's
window load even when the panel has produced hundreds of kilobytes of
material.

The judge's ruling is materialized to `state/phase_14_judge_ruling.md` so
Phase 15.1 can later consume it from disk (rather than from chat).

Steps (in order):
0. Review verification results (claims, severity, commands, **and verification round**)
0.5a-b. Verify audit findings, anti-rhetoric assessment
0.5c. Severity dampening — minimum evidence-justified severity. **In Precise mode, findings without code citations cannot exceed P2.**
0.5d. Coverage check — flag unexamined risk categories, scan source for gaps
1-3. Debate quality, disagreement rulings, consensus correctness
4-5. Absent-safeguard check, independent gap scan, score assessment
6-7. Epistemic label classification, final verdict
8-9. Action items, meta-observation
10. **Write ruling to `{state_dir}/phase_14_judge_ruling.md`** (v3.1.0+).
```

- [ ] **Step 8.4: Update Phase 14 prompt template**

In `references/prompt-templates.md`, find `## Phase 14: Supreme Judge Prompt`. At the very top of that prompt body, prepend a paragraph:

````markdown
**Input protocol (v3.1.0+):** You will receive only file paths in your launch
prompt — not verbatim phase content. Use the Read tool to load specific files
when you need them for adjudication. The available state files are:

- `{state_dir}/reviewer_<name>_phase_3.md` for each reviewer
- `{state_dir}/reviewer_<name>_phase_4.md` for each reviewer
- `{state_dir}/reviewer_<name>_phase_5_round<R>.md` for each reviewer per round
- `{state_dir}/reviewer_<name>_phase_7.md` for each reviewer
- `{state_dir}/phase_8_audit.md`
- `{state_dir}/phase_10_claim_verification.md`
- `{state_dir}/phase_11_severity_verification.md`

Read what you need to adjudicate. You do not need to read everything.

**Output protocol (v3.1.0+):** Write your full ruling to
`{state_dir}/phase_14_judge_ruling.md`. The ruling must include all sections
defined in the steps below (verdict, action items, severity assessment,
meta-observation, etc.). Phase 15.1 will read this file from disk.
````

- [ ] **Step 8.5: Run test to verify it passes**

Run: `npm run test:behavioral`
Expected: PASS on both.

- [ ] **Step 8.6: Commit**

```bash
git add -u
git commit -m "feat(skill): Phase 14 reads state on demand + materializes ruling"
```

---

## Task 9: COMPRESSED RUN header in Phase 15.1

**Files:**
- Modify: `skills/agent-review-panel/SKILL.md` (Phase 15.1 schema, around line 921)
- Test: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 9.1: Write the failing test**

```javascript
  it("Phase 15.1 documents COMPRESSED RUN header schema", () => {
    assert.match(
      skillMd,
      /COMPRESSED RUN/,
      "SKILL.md must mention the COMPRESSED RUN header"
    );
    assert.match(
      skillMd,
      /## Phase 15\.1[\s\S]+?⚠️[\s\S]+?COMPRESSED RUN[\s\S]+?Phases skipped/,
      "Phase 15.1 must define the warning header format with phases-skipped list"
    );
    assert.match(
      skillMd,
      /\[COMPRESSED\]/,
      "SKILL.md must define the [COMPRESSED] epistemic label suffix for action items in compressed runs"
    );
  });
```

- [ ] **Step 9.2: Run test to verify it fails**

Run: `npm run test:behavioral`
Expected: FAIL on all three.

- [ ] **Step 9.3: Add COMPRESSED RUN block to Phase 15.1 schema**

In `skills/agent-review-panel/SKILL.md`, find the `### Phase 15.1: Primary Markdown Report` section. Right after the existing description text and before the section template that lists `## Executive Summary`, insert:

````markdown
**Compressed-run warning (v3.1.0+):** If the Phase 13.5 verification gate
detected any unrecoverable missing phase output, Phase 15.1 MUST emit this
block as the FIRST content of the report (before any other section,
including Executive Summary):

```markdown
> ⚠️ **COMPRESSED RUN — Phases skipped: <comma-separated list, e.g., "4 (security), 5 (security, devils-advocate)">**
>
> This run did not complete the full panel protocol. The Supreme Judge ruled
> on partial input. Findings below should be treated as **lower confidence**
> than a full-run report. Re-run the panel for a complete review.
```

Additionally, in compressed runs, every action item MUST have `[COMPRESSED]`
appended to its epistemic label (e.g., `[CONSENSUS][COMPRESSED]`,
`[VERIFIED][COMPRESSED]`).

For full runs, the warning block is absent. Its absence is the green-light
signal that the panel completed the full protocol.
````

- [ ] **Step 9.4: Run test to verify it passes**

Run: `npm run test:behavioral`
Expected: PASS for all three.

- [ ] **Step 9.5: Commit**

```bash
git add -u
git commit -m "feat(skill): Phase 15.1 emits COMPRESSED RUN header on gate failure"
```

---

## Task 10: COMPRESSED RUN HTML banner in Phase 15.3

**Files:**
- Modify: `skills/agent-review-panel/SKILL.md` (Phase 15.3 spec, line 1072)
- Test: `tests/behavioral-assertions.test.mjs`

- [ ] **Step 10.1: Write the failing test**

```javascript
  it("Phase 15.3 documents COMPRESSED RUN HTML banner", () => {
    assert.match(
      skillMd,
      /## Phase 15\.3[\s\S]+?COMPRESSED RUN[\s\S]+?banner/i,
      "Phase 15.3 must document the red HTML banner for compressed runs"
    );
  });
```

- [ ] **Step 10.2: Run test to verify it fails**

Run: `npm run test:behavioral`
Expected: FAIL.

- [ ] **Step 10.3: Add COMPRESSED RUN banner spec to Phase 15.3**

In `skills/agent-review-panel/SKILL.md`, find `### Phase 15.3: Interactive HTML Report`. Append to that section, before the next `### Phase 15 Verification Gate` heading:

````markdown
**Compressed-run banner (v3.1.0+):** If the source Phase 15.1 markdown
report begins with the `⚠️ COMPRESSED RUN` blockquote, Phase 15.3 MUST render
a prominent red banner at the top of the HTML body containing the same
warning text. Suggested CSS:

```html
<div role="alert" style="background:#FEE2E2; color:#991B1B; padding:1rem 1.25rem; margin:1rem 0; border:2px solid #DC2626; border-radius:6px;">
  <strong>⚠️ COMPRESSED RUN — Phases skipped: <list></strong>
  <p>This run did not complete the full panel protocol. ... Re-run the panel for a complete review.</p>
</div>
```

The banner appears above the report header summary card.
````

- [ ] **Step 10.4: Run test to verify it passes**

Run: `npm run test:behavioral`
Expected: PASS.

- [ ] **Step 10.5: Commit**

```bash
git add -u
git commit -m "feat(skill): Phase 15.3 renders COMPRESSED RUN HTML banner"
```

---

## Task 11: Compressed-run fixture + parser support + golden file

**Files:**
- Create: `tests/fixtures/sample-report-compressed-run.md`
- Create: `tests/golden/sample-report-compressed-run.golden.json`
- Modify: `tests/report-structure.test.mjs`

- [ ] **Step 11.1: Write the failing test in `report-structure.test.mjs`**

In `tests/report-structure.test.mjs`, locate the existing fixtures-loop test (search for `readdirSync(FIXTURES)` or the loop that iterates over fixture files). Add a dedicated assertion AFTER the existing fixture loop:

```javascript
describe("compressed-run fixture", () => {
  it("parses the COMPRESSED RUN warning block", () => {
    const fixturePath = resolve(FIXTURES, "sample-report-compressed-run.md");
    const md = readFileSync(fixturePath, "utf-8");
    const report = parseReport(md);
    assert.equal(
      report.compressedRun?.detected,
      true,
      "parser must set report.compressedRun.detected = true"
    );
    assert.match(
      report.compressedRun.phasesSkipped,
      /4|5|7/,
      "parser must extract the phases-skipped list"
    );
  });

  it("non-compressed fixtures have compressedRun.detected = false", () => {
    const fixturePath = resolve(FIXTURES, "sample-report-valid.md");
    const md = readFileSync(fixturePath, "utf-8");
    const report = parseReport(md);
    assert.equal(
      report.compressedRun?.detected ?? false,
      false,
      "non-compressed fixture must report compressedRun.detected = false"
    );
  });
});
```

- [ ] **Step 11.2: Create the compressed-run fixture**

Create `tests/fixtures/sample-report-compressed-run.md` with this exact content:

````markdown
> ⚠️ **COMPRESSED RUN — Phases skipped: 4 (security), 5 (security, devils-advocate), 7 (architecture)**
>
> This run did not complete the full panel protocol. The Supreme Judge ruled on partial input. Findings below should be treated as **lower confidence** than a full-run report. Re-run the panel for a complete review.

# Review Panel Report

**Work reviewed:** PR #999 — example compressed run | **Date:** 2026-04-27 | **Panel:** 5 reviewers + judge | **Verdict:** REQUEST CHANGES | **Confidence:** Low
**Auto-detected signals:** test-fixture
**Review mode:** Mixed (compressed)

## Executive Summary

This is a synthetic fixture demonstrating the COMPRESSED RUN warning pattern. The panel ran with Phases 4, 5 (rounds), and 7 partially missing for 3 reviewers. The judge ruled on partial input. Findings are flagged with `[COMPRESSED]` suffix.

## Scope & Limitations

Synthetic test fixture. Not a real review.

## Score Summary

| Reviewer | Score |
|---|---|
| Architecture | 5.0 |
| Security | 5.5 |
| SRE | 4.5 |
| Code Quality | 6.0 |
| Devil's Advocate | 5.0 |

## Consensus Points

- Example consensus point [CONSENSUS][COMPRESSED]

## Disagreement Points (with judge rulings)

- Example disagreement [SINGLE-SOURCE][COMPRESSED]

## Completeness Audit Findings

Synthetic.

## Action Items (with severity AND epistemic labels)

1. P1 — Example action [VERIFIED][COMPRESSED]
2. P2 — Example action [CONSENSUS][COMPRESSED]

## Detailed Reviews (collapsible sections)

<details><summary>Architecture review</summary>Synthetic.</details>
````

- [ ] **Step 11.3: Update the parser in `report-structure.test.mjs`**

In `tests/report-structure.test.mjs`, find the `parseReport` function. After the header-pattern parsing block, BEFORE the `--- Required sections ---` block, insert:

```javascript
  // --- Compressed-run warning (v3.1.0+) ---
  const compressedMatch = markdown.match(
    /^>\s*⚠️\s*\*\*COMPRESSED RUN — Phases skipped:\s*(.+?)\*\*/m
  );
  if (compressedMatch) {
    report.compressedRun = {
      detected: true,
      phasesSkipped: compressedMatch[1].trim(),
    };
  } else {
    report.compressedRun = { detected: false, phasesSkipped: null };
  }
```

- [ ] **Step 11.4: Run report-structure tests to verify they pass**

Run: `npm run test:report`
Expected: PASS for the new compressed-run describe block AND all existing fixture loops still pass.

- [ ] **Step 11.5: Generate the golden snapshot**

Run: `npm run test:golden:update`
This regenerates all `*.golden.json` files including the new compressed-run fixture. Inspect:

```bash
git status tests/golden/
cat tests/golden/sample-report-compressed-run.golden.json
```

Verify the golden contains `"compressedRun": { "detected": true, "phasesSkipped": "4 (security)..." }`.

- [ ] **Step 11.6: Run full golden test to verify pass**

Run: `npm run test:golden`
Expected: PASS for all golden comparisons.

- [ ] **Step 11.7: Commit**

```bash
git add tests/fixtures/sample-report-compressed-run.md tests/golden/sample-report-compressed-run.golden.json tests/report-structure.test.mjs
git commit -m "test: add compressed-run fixture + parser support + golden snapshot"
```

---

## Task 12: Update CHANGELOG.md and references/changelog.md

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `skills/agent-review-panel/references/changelog.md`

- [ ] **Step 12.1: Add v3.1.0 entry to root CHANGELOG.md**

Open `CHANGELOG.md`. At the top (under any "Unreleased" placeholder, or as the new top entry if there is none), add:

```markdown
## v3.1.0 — 2026-04-27 — silent-phase-compression fix

### Bug fix

Under context-budget pressure, the v3.0.0 orchestrator silently inlined
Phases 4 (private reflection), 5 (debate), 6 (round summaries), and 7
(blind final assessments) into the Supreme Judge step, producing
deliverables indistinguishable from full runs. Empirical cost measured at
6 net-new findings (including 1 P0) missed by a compressed run vs. the
corrective full run on the same input.

Fixes [#35](https://github.com/wan-huiyan/agent-review-panel/issues/35).

### Architectural changes

- **File-based subagent state.** All Phase 3/4/5/7/8/10/11/14 outputs are
  written to `state/<file>.md` under the review output directory, with
  subagents returning only path + 100-word summary. The orchestrator stays
  at ~10k tokens throughout, eliminating the bloat that drove compression.
- **Pre-Judge Verification Gate (new Phase 13.5).** Before the Supreme Judge
  launches, the orchestrator verifies all mandatory Phase 4/5/7 outputs
  exist, are non-stub (≥500 bytes), and contain required schema headers.
  Missing outputs trigger a single retry; persistent failures emit the
  COMPRESSED RUN warning rather than producing a silently incomplete report.
- **Judge reads state on demand.** Phase 14 launch prompt is ~200 tokens of
  paths; the judge uses Read on individual state files. Mirrors the v2.16.4
  Phase 15.3 pattern.
- **`⚠️ COMPRESSED RUN` header.** When the gate detects unrecoverable phase
  loss, Phase 15.1 emits a fail-loud blockquote at the top of the report
  listing the skipped phases, and every action item gets a `[COMPRESSED]`
  epistemic label suffix. Phase 15.3 renders the same warning as a red HTML
  banner.

### Multi-run mode

- State files in multi-run mode are namespaced under `state/run_<N>/` so the
  Phase 16 merge step can disambiguate by run.

### Breaking changes

None for consumers of the existing report files. The `state/` directory is
net-new and may be `.gitignore`'d if not desired in commits.

### Tests

- New fixture: `tests/fixtures/sample-report-compressed-run.md`
- New golden: `tests/golden/sample-report-compressed-run.golden.json`
- Parser update in `tests/report-structure.test.mjs` recognizes the
  COMPRESSED RUN block and exposes `report.compressedRun.detected`.
- New `behavioral-assertions.test.mjs` describe block validates SKILL.md
  documents the v3.1.0 architecture.
```

- [ ] **Step 12.2: Mirror v3.1.0 entry to references changelog**

Open `skills/agent-review-panel/references/changelog.md`. Add the same entry at the top.

- [ ] **Step 12.3: Commit**

```bash
git add CHANGELOG.md skills/agent-review-panel/references/changelog.md
git commit -m "docs: changelog entry for v3.1.0 silent-phase-compression fix"
```

---

## Task 13: Bump version 3.0.0 → 3.1.0

**Files:**
- Modify: `package.json`
- Modify: `.claude-plugin/plugin.json`
- Test: `tests/manifest-consistency.test.mjs`

- [ ] **Step 13.1: Run manifest-consistency baseline**

Run: `npm run test:manifest`
Expected: PASS at v3.0.0. Note any version-related assertions for awareness.

- [ ] **Step 13.2: Bump `package.json`**

Open `package.json`. Find:

```json
"version": "3.0.0",
```

Replace with:

```json
"version": "3.1.0",
```

- [ ] **Step 13.3: Bump `.claude-plugin/plugin.json`**

Open `.claude-plugin/plugin.json`. Find:

```json
"version": "3.0.0",
```

Replace with:

```json
"version": "3.1.0",
```

- [ ] **Step 13.4: Run manifest-consistency to verify pass**

Run: `npm run test:manifest`
Expected: PASS.

- [ ] **Step 13.5: Run the full test suite**

Run: `npm test`
Expected: PASS for all six suites (triggers, manifest, eval-suite, report, behavioral, golden).

- [ ] **Step 13.6: Commit**

```bash
git add package.json .claude-plugin/plugin.json
git commit -m "release: v3.1.0 — silent phase compression fix"
```

---

## Task 14: End-to-end manual verification (out of automated test scope)

This task is documented for the implementer but is NOT a coded automation
step — it requires invoking the skill against a real codebase with Claude
Code. Capture results in a comment on issue #35.

- [ ] **Step 14.1: Run the panel against a moderately complex codebase**

In a separate Claude Code session, invoke `/agent-review-panel` against a
project with 5+ source files and 1000+ LOC. Suggested target: replay
`barryu_application_propensity` PR #117 (the corrective full-run input from
the original bug report).

- [ ] **Step 14.2: Verify file-based state landed on disk**

After the run completes, in the review output directory:

```bash
ls -la docs/reviews/<date>-<topic>/state/
```

Expected: 5 reviewers × 4 files (phase 3, 4, 5_round1, 7) + 4 panel-level
files (phase_8_audit, phase_10_claim_verification,
phase_11_severity_verification, phase_14_judge_ruling) = 24 files for a
5-reviewer 1-debate-round panel.

- [ ] **Step 14.3: Verify orchestrator window stayed small**

Spot-check the Claude Code conversation — orchestrator messages between
phases should contain only paths + 100-word summaries, not verbatim review
text.

- [ ] **Step 14.4: Verify the COMPRESSED RUN header is absent**

Open `review_panel_report.md`. Confirm no `⚠️ COMPRESSED RUN` blockquote at
the top. The Phase 14 ruling must reference all 5 reviewers' Phase 4/5/7
outputs.

- [ ] **Step 14.5: Force a gate-failure scenario (negative test)**

Run the panel a second time. After Phase 4 dispatches, manually delete one
file:

```bash
rm docs/reviews/<date>-<topic>/state/reviewer_security_phase_4.md
```

Watch the orchestrator: it should detect the missing file at Phase 13.5,
re-dispatch the security reviewer's Phase 4. If you delete it again
immediately after re-dispatch (or use a second strategy to force two
failures), the run should complete with the COMPRESSED RUN warning at the
top of the report listing `4 (security)` as skipped.

- [ ] **Step 14.6: Diff against barryu#117**

Compare the v3.1.0 run's findings count against barryu#117's corrective
report. The 6 net-new findings (1 P0 FERPA/DPA gap, 1 P0 reliability meta,
1 P1 CSRF, etc.) listed in issue #35 should appear. If any are missing,
file a follow-up issue describing which.

- [ ] **Step 14.7: Post results to issue #35**

Comment on the issue with the run's `state/` directory contents
(`ls -la state/` output), confirmation that COMPRESSED RUN header was
absent in the happy-path run and present in the forced-failure run, and
the findings-count diff vs. barryu#117.

---

## Task 15: Tag and release

- [ ] **Step 15.1: Verify clean status**

Run: `git status`
Expected: clean working tree on a topic branch (e.g., `fix/issue-35-silent-compression`).

- [ ] **Step 15.2: Open the PR**

```bash
gh pr create --title "fix(#35): silent phase compression — v3.1.0" --body "$(cat <<'EOF'
## Summary

- Routes Phase 3/4/5/7/8/10/11/14 outputs through `state/` on disk; orchestrator stays at ~10k tokens
- Adds Phase 13.5 Pre-Judge Verification Gate (existence + bytes + headers)
- Adds `⚠️ COMPRESSED RUN` header to Phase 15.1 + red HTML banner to Phase 15.3 for fail-loud detection of residual compression
- Judge reads state files on demand (mirrors v2.16.4 Phase 15.3 pattern)

Fixes #35.

## Test plan

- [x] Unit: `npm test` (all 6 suites)
- [ ] Manual: end-to-end run against moderately complex codebase, gate happy-path
- [ ] Manual: forced gate-failure run produces COMPRESSED RUN header
- [ ] Manual: findings count matches barryu#117 corrective report

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 15.3: After PR review and merge, tag**

Once the PR merges to `main`:

```bash
git checkout main
git pull
git tag -a v3.1.0 -m "v3.1.0 — silent phase compression fix"
git push origin v3.1.0
```

- [ ] **Step 15.4: Create the GitHub release**

```bash
gh release create v3.1.0 \
  --title "v3.1.0 — silent phase compression fix" \
  --notes-from-tag
```

Users can now `/plugin update` to receive the fix.

---

## Self-Review Notes

**Spec coverage check** — verifying every design-doc requirement maps to a task:

| Design doc §  | Requirement | Task(s) |
|---|---|---|
| §3 Tier 1 row 1 | File-based subagent state | Tasks 1, 2, 3, 4, 5, 6 |
| §3 Tier 1 row 2 | Judge reads files on demand | Task 8 |
| §3 Tier 1 row 3 | Pre-judge verification gate | Task 7 |
| §3 Tier 1 row 4 | COMPRESSED RUN header | Tasks 9, 10 |
| §4.1 Multi-run namespacing | `state/run_<N>/` | Task 1 |
| §4.3 Bytes + headers gate logic | Existence + ≥500B + headers | Task 7 |
| §4.3 Single-retry policy | One retry, then partial+warn | Task 7 |
| §4.4 `[COMPRESSED]` action-item suffix | Per-action label | Task 9 |
| §5 Schema: phase_14_judge_ruling.md | Materialized to disk | Task 8 |
| §7 Test plan: gate fixture detection | Compressed-run fixture | Task 11 |
| §9 Acceptance: CHANGELOG | v3.1.0 entry | Task 12 |
| §9 Acceptance: tag release | git tag + gh release | Task 15 |
| §9 Acceptance: end-to-end test | Manual verification | Task 14 |

No gaps detected.

**Type / name consistency check:**
- `state/reviewer_<name>_phase_<N>.md` naming used consistently in Tasks 1-8, 11
- `phase_14_judge_ruling.md` referenced consistently in Tasks 1, 8, 12
- `compressedRun.detected` parser field consistent across Tasks 11 and the fixture-test assertions
- Single-retry policy phrased consistently in Task 7 and Task 14.5

No inconsistencies detected.

**Placeholder scan:** No "TBD", "implement later", "similar to Task N", or
"add appropriate handling" placeholders. All code blocks contain copy-pasteable
content.
