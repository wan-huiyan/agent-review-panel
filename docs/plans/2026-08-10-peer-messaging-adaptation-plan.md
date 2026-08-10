# v3.9.0 Reviewer Addressing + Blocked-Reviewer Handling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the panel's persistent-reviewer path deterministic (address by `agentId`, treat a failed send as a failed agent), give the fresh-spawn fallback its memory back, and stop a reviewer that could not see the code from counting as a clean vote.

**Architecture:** This is a documentation-and-contract change to a prompt-engineering skill. There is no runtime code — the "implementation" is precise text in `SKILL.md` and `references/prompt-templates.md`, enforced by regex assertions in `tests/behavioral-assertions.test.mjs`. Part 2 deliberately adds no new detector: a blocked reviewer writes its BLOCKED file *instead of* the required phase file, so the existing Phase 13.5 existence check fires through the path that already exists.

**Tech Stack:** Markdown (the skill), Node's built-in test runner (`node --test`), bash (`scripts/release-check.sh`).

**Source spec:** `docs/plans/2026-08-10-peer-messaging-adaptation-design.md`

## Global Constraints

- **Never reword two pinned strings.** `tests/behavioral-assertions.test.mjs:1138` and `:1143` match `**Persistent reviewers** — spawn each persona ONCE in Phase 3` and `Fallback: if SendMessage fails or is unavailable, fresh-spawn` by regex. **Append only.** Rewording turns two existing tests red for no benefit.
- **Add no new banner.** `COMPRESSED RUN` already covers a reviewer that missed a phase. The report already stacks three banners.
- **Create no new state file** for the persona→agentId map. It lives in orchestrator context for the length of the run; nothing would read a file.
- **Do not mandate background Agent spawns.** Verified: foreground spawns return an `agentId` too.
- **Do not touch the frontmatter `description`.** Invisible to triggering; 31 characters from the 1,536 cap.
- **Do not bundle** the multi-run persona-slug collision, the dead `release-check` test-count gate, or the Workflow-recipe phase compression. All real, all unrelated, each its own commit. The third is already being handled on branch `claude/optimistic-elion-d69b24`.
- **em-dash style:** the file uses `—` (U+2014) surrounded by spaces. Match it.
- Every task ends with `npm test` green before committing.

---

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `skills/agent-review-panel/SKILL.md` | The protocol contract the orchestrator follows | 1, 3, 4 |
| `skills/agent-review-panel/references/prompt-templates.md` | The verbatim prompts sent to subagents | 2, 3 |
| `tests/behavioral-assertions.test.mjs` | Regex enforcement of the above | 1, 2, 3 |
| `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `skills/agent-review-panel/eval-suite.json` | Version surfaces, CI-gated | 4 |
| `CHANGELOG.md`, `references/changelog.md`, `ROADMAP.md`, `README.md` | Release documentation | 4 |

**Test placement note:** append the new `describe` block at the end of `tests/behavioral-assertions.test.mjs`, after the `v3.8.0` block, keeping version order. Branch `claude/optimistic-elion-d69b24` is also appending a block there. If that branch lands first, the merge conflict is two adjacent `describe` blocks — resolve by keeping both, in version order.

---

### Task 1: Reviewer addressing contract

**Files:**
- Modify: `skills/agent-review-panel/SKILL.md` (rule 2 at ~1760–1770; Phase 3 at ~758–762; Implementation Notes at ~2115)
- Test: `tests/behavioral-assertions.test.mjs` (append new describe block)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: the section anchor string `### Addressing persistent reviewers (v3.9.0)`, which Task 3 does **not** depend on. Tasks are independent.

- [ ] **Step 1: Write the failing test**

Append to the very end of `tests/behavioral-assertions.test.mjs`:

```javascript
describe("v3.9.0 reviewer addressing contract", () => {
  const discipline39 = skillMd.slice(
    skillMd.indexOf("## Orchestrator Efficiency Discipline (v3.8.0 — all modes)")
  );

  it("mandates capturing the agentId from the Phase 3 spawn result", () => {
    assert.match(
      discipline39,
      /agentId/,
      "the discipline section must name agentId as the reviewer address"
    );
    assert.match(
      discipline39,
      /persona\s*→\s*agentId map/,
      "must instruct the orchestrator to keep a persona → agentId map"
    );
  });

  it("forbids addressing a reviewer by persona name or description", () => {
    assert.match(
      discipline39,
      /[Nn]ever the persona (label|name), never the `description`/,
      "must forbid name/description addressing, which does not resolve"
    );
  });

  it("names success: false as a delivery failure that triggers the fallback", () => {
    assert.match(
      discipline39,
      /`\{"success": false/,
      "must name the literal failed-send result shape"
    );
    assert.match(
      discipline39,
      /failed agent under the existing retry-once rule/,
      "a failed send must route into the existing retry-once rule"
    );
  });

  it("scopes the agentId map per-run in multi-run mode", () => {
    assert.match(
      discipline39,
      /per-run in multi-run mode/,
      "multi-run must not share one map across runs"
    );
  });

  it("keeps the two v3.8.0 pinned strings intact", () => {
    assert.match(
      discipline39,
      /\*\*Persistent reviewers\*\* — spawn each persona ONCE in Phase 3/,
      "v3.8.0 persistent-reviewer string must survive the v3.9.0 append"
    );
    assert.match(
      discipline39,
      /Fallback: if SendMessage fails or is unavailable, fresh-spawn/,
      "v3.8.0 fallback string must survive the v3.9.0 append"
    );
  });

  it("Phase 3 tells the orchestrator to capture the spawn result's agentId", () => {
    const idx = skillMd.indexOf("**Persistent reviewers (v3.8.0):**");
    assert.ok(idx >= 0, "Phase 3 persistent-reviewer paragraph must exist");
    const para = skillMd.slice(idx, idx + 900);
    assert.match(
      para,
      /agentId/,
      "Phase 3 must say the spawn result's agentId is captured"
    );
  });

  it("Implementation Notes treats a failed send as a failed agent", () => {
    const idx = skillMd.indexOf("- **Error handling:**");
    assert.ok(idx >= 0, "Implementation Notes error-handling bullet must exist");
    const bullet = skillMd.slice(idx, idx + 700);
    assert.match(
      bullet,
      /success: false/,
      "error handling must name a failed SendMessage as a failed agent"
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test 2>&1 | tail -20`
Expected: FAIL — 7 new failing assertions in `v3.9.0 reviewer addressing contract`. The two pinned-string assertions should PASS already (they guard against regression).

- [ ] **Step 3: Append the addressing rules to SKILL.md**

In `skills/agent-review-panel/SKILL.md`, find the end of rule 2 — the line `   verify, and proceed.` — and insert the following **between** it and the line `3. **≤50-word agent returns**`:

```markdown

   **Addressing persistent reviewers (v3.9.0).** `SendMessage` has resolved a
   subagent by its `agentId` since Claude Code 2.1.77; panel reviewers are
   spawned without a name, so that is the only address that works.

   - **Capture it.** Every Phase 3 spawn result carries an `agentId` (foreground
     and background spawns alike). Record a **persona → agentId map** before
     leaving Phase 3, **per-run in multi-run mode**. Keep it in orchestrator
     context — do NOT write a state file for it; nothing would read it.
   - **Use only it.** Address every Phase 4 / 5 / 7 send by that raw `agentId`.
     Never the persona label, never the `description` string passed to the Agent
     tool — neither resolves, and a send to one returns
     `{"success": false, "message": "No agent named '<X>' is reachable..."}`.
     Addressing by `agentId` also avoids the name-reuse misrouting fixed in
     2.1.199, which Run 3 is exposed to because it spawns three Devil's
     Advocates at once.
   - **Check the result.** Since 2.1.224 a failed delivery returns
     `{"success": false, ...}` instead of reporting success. Treat it as a
     failed agent under the existing retry-once rule in Implementation Notes,
     firing the fresh-spawn fallback in the same turn. Never assume a send
     landed.
   - **Applies to budget mode too** — its Phase 7 drives the same persistent
     reviewers.
```

- [ ] **Step 4: Add the Phase 3 pointer**

In the Phase 3 section, find:

```
**Persistent reviewers (v3.8.0):** these Phase 3 spawns are the ONLY reviewer
spawns of the run — Phases 4, 5, and 7 are driven by SendMessage to these same
agents (see Orchestrator Efficiency Discipline). If SendMessage to an agent
fails or is unavailable, fall back to a fresh spawn that reads that persona's
prior state files from disk.
```

Append this sentence to that paragraph:

```
Record each spawn result's `agentId` into the
persona → agentId map as you launch — that id is the only address Phases 4/5/7
can use (see Addressing persistent reviewers).
```

- [ ] **Step 5: Amend the Implementation Notes error-handling bullet**

Find:

```
- **Error handling:** Retry failed agents once. Proceed with minimum 2 reviewers.
```

Replace that first sentence pair with:

```
- **Error handling:** Retry failed agents once — including a `SendMessage` that
  returns `success: false`, which is a failed agent, not a delivered message.
  Proceed with minimum 2 reviewers.
```

- [ ] **Step 6: Run the tests and verify they pass**

Run: `npm test 2>&1 | tail -12`
Expected: PASS, 506 tests (499 + 7).

- [ ] **Step 7: Commit**

```bash
git add skills/agent-review-panel/SKILL.md tests/behavioral-assertions.test.mjs
git commit -m "feat: address persistent reviewers by agentId, treat success:false as a failed agent

SKILL.md drove Phases 4/5/7 via SendMessage 'to these same agents' without
ever saying what string identifies them; grep for agentId across skills/
returned nothing. Panel reviewers are spawned nameless, so the persona label
and the Agent tool's description both fail to resolve. Whether a run reached
its cached reviewer or silently fell back to a full re-spawn was left to
chance, and unknowable afterwards.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Give the fresh-spawn fallback its memory back

**Files:**
- Modify: `skills/agent-review-panel/references/prompt-templates.md` (Phase 4 at ~176, Phase 5 at ~222, Phase 7 at ~245)
- Test: `tests/behavioral-assertions.test.mjs`

**Interfaces:**
- Consumes: nothing — independent of Task 1
- Produces: the literal sentence `If you were freshly spawned rather than resumed, read your own prior` in all three templates, which Task 2's test asserts

**Why:** `SKILL.md` promises five separate times that a freshly spawned replacement "reads its own prior state files from disk". `prompt-templates.md` never tells it to. Today the fallback yields a reviewer with no knowledge of its own Phase 3 findings, which answers anyway and produces a file that passes the Phase 13.5 gate on size and headers.

- [ ] **Step 1: Write the failing test**

Append at the end of `tests/behavioral-assertions.test.mjs`:

```javascript
describe("v3.9.0 fresh-spawn fallback reads prior state", () => {
  const templates = readFileSync(
    resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
    "utf-8"
  );

  const sections = [
    ["Phase 4", "## Phase 4: Private Reflection Prompt", "## Phase 5"],
    ["Phase 5", "## Phase 5: Debate Round Prompt", "## Phase 7"],
    ["Phase 7", "## Phase 7: Blind Final Assessment Prompt", "## Phase 8"],
  ];

  for (const [label, startAnchor, endAnchor] of sections) {
    it(`${label} template tells a freshly spawned reviewer to read its prior state`, () => {
      const start = templates.indexOf(startAnchor);
      assert.ok(start >= 0, `${startAnchor} must exist`);
      const end = templates.indexOf(endAnchor, start);
      assert.ok(end > start, `${endAnchor} must follow ${startAnchor}`);
      const section = templates.slice(start, end);
      assert.match(
        section,
        /freshly spawned rather than resumed/,
        `${label} must handle the fresh-spawn fallback case`
      );
      assert.match(
        section,
        /reviewer_\{persona_short_name\}_phase_\*\.md/,
        `${label} must name the prior state files to read`
      );
    });
  }
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test 2>&1 | tail -20`
Expected: FAIL — 3 failing assertions, one per phase.

- [ ] **Step 3: Add the preamble to all three templates**

In `skills/agent-review-panel/references/prompt-templates.md`, insert this identical line immediately **before** the `**Output protocol (v3.1.0+):**` line in each of the Phase 4, Phase 5, and Phase 7 templates (three insertions, same text):

```markdown
**If you were freshly spawned rather than resumed** (the orchestrator's
SendMessage to your prior agent failed), you do NOT remember your earlier work:
read your own prior `{state_dir}/reviewer_{persona_short_name}_phase_*.md` files
before answering. Do not answer from an empty context.

```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test 2>&1 | tail -12`
Expected: PASS, 509 tests (506 + 3).

- [ ] **Step 5: Commit**

```bash
git add skills/agent-review-panel/references/prompt-templates.md tests/behavioral-assertions.test.mjs
git commit -m "fix: fresh-spawn fallback produced a reviewer with no memory

SKILL.md promises five times that a freshly spawned replacement reads its own
prior state files from disk. The Phase 4/5/7 templates never told it to, so a
replacement received a debate prompt with no knowledge of its own Phase 3
findings, answered anyway, and produced a file that passed the Phase 13.5 gate
on size and headers. This is the path the v3.9.0 addressing fix routes failed
sends onto, so it is closed in the same release.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: A blocked reviewer is not a clean vote

**Files:**
- Modify: `skills/agent-review-panel/references/prompt-templates.md` (Phase 3 output protocol at ~145)
- Modify: `skills/agent-review-panel/SKILL.md` (Phase 3 section; Edge Cases list near the end)
- Test: `tests/behavioral-assertions.test.mjs`

**Interfaces:**
- Consumes: nothing — independent of Tasks 1 and 2
- Produces: the state-file name `reviewer_<slug>_BLOCKED.md`

**Why:** Phase 13.5 runs exactly three checks — file exists, ≥500 bytes, required headers present (`SKILL.md:1126–1134`). A reviewer that could not see the code but writes a well-formed "no findings" review passes all three, so no banner fires and the judge counts it as genuine agreement. `grep -rin "blocked" skills/agent-review-panel/` currently returns nothing.

**Design choice that keeps this small:** the BLOCKED file is written **instead of** the required phase file. The required file is then genuinely absent, the existing existence check fails, the gate re-dispatches once, and `COMPRESSED RUN` fires. No fourth check, no new banner, no change to Phase 13.5 or Phase 15.1.

- [ ] **Step 1: Write the failing test**

Append at the end of `tests/behavioral-assertions.test.mjs`:

```javascript
describe("v3.9.0 blocked reviewer is not a clean vote", () => {
  const templates = readFileSync(
    resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
    "utf-8"
  );

  it("Phase 3 template instructs a blocked reviewer to write a BLOCKED file instead", () => {
    const start = templates.indexOf("## Phase 3");
    assert.ok(start >= 0, "Phase 3 template must exist");
    const end = templates.indexOf("## Phase 4", start);
    const phase3 = templates.slice(start, end);
    assert.match(
      phase3,
      /reviewer_\{persona_short_name\}_BLOCKED\.md/,
      "Phase 3 must name the BLOCKED state file"
    );
    assert.match(
      phase3,
      /INSTEAD of your required phase file/i,
      "the BLOCKED file must replace the required file so the gate detects it"
    );
    assert.match(
      phase3,
      /do NOT return findings as though you had reviewed/i,
      "a blocked reviewer must not fabricate a clean review"
    );
  });

  it("SKILL.md states a BLOCKED reviewer is never counted as clean", () => {
    assert.match(
      skillMd,
      /BLOCKED reviewer is (never|not) a clean vote/,
      "SKILL.md must carry the not-clean rule"
    );
    assert.match(
      skillMd,
      /re-dispatch once with explicit\s+materialized paths/,
      "the not-clean rule must prescribe one re-dispatch with real paths"
    );
  });

  it("SKILL.md has an edge case for a reviewer that cannot see the work", () => {
    const idx = skillMd.indexOf("## Edge Cases");
    assert.ok(idx >= 0, "Edge Cases section must exist");
    const edge = skillMd.slice(idx);
    assert.match(
      edge,
      /cannot see the work under review/i,
      "Edge Cases must cover the blocked-reviewer case"
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test 2>&1 | tail -20`
Expected: FAIL — 3 failing assertions.

- [ ] **Step 3: Add the blocked-reviewer clause to the Phase 3 template**

In `references/prompt-templates.md`, insert immediately **before** the Phase 3 `**Output protocol (v3.1.0+):**` line (at ~145):

```markdown
**If you cannot read the work under review** — you have no `Bash` tool, the
branch is not checked out in the working tree, or a given path does not exist —
do NOT guess and do NOT return findings as though you had reviewed. Write
`{state_dir}/reviewer_{persona_short_name}_BLOCKED.md` naming exactly what you
could not reach and what you tried, **INSTEAD of your required phase file**, and
say "BLOCKED" in your ≤50-word return. Writing the BLOCKED file in place of the
required file is deliberate: it makes the required file genuinely absent so the
Phase 13.5 gate detects the gap instead of counting you as agreeing.

```

- [ ] **Step 4: Add the orchestrator not-clean rule to SKILL.md Phase 3**

In `SKILL.md`, in the Phase 3 section, insert after the `**Persistent reviewers (v3.8.0):**` paragraph:

```markdown

**Blocked reviewers (v3.9.0).** A reviewer that could not see the code returns
no findings, and no findings reads as agreement — the Phase 13.5 gate checks
existence, size and headers, all of which a well-formed "no findings" review
from a blind reviewer passes. So: a **BLOCKED reviewer is never a clean vote.**
A blocked reviewer writes `state/reviewer_<slug>_BLOCKED.md` instead of its
required phase file; the orchestrator must re-dispatch once with explicit
materialized paths (a pre-generated diff file, a checked-out worktree). If it is
still blocked, it counts as a missing reviewer and the existing COMPRESSED RUN
machinery reports it. Never let a BLOCKED return pass silently into the judge's
input as consensus.
```

- [ ] **Step 5: Add the Edge Case entry**

In the `## Edge Cases` list in `SKILL.md`, add:

```markdown
- **Reviewer cannot see the work under review (v3.9.0):** the reviewer writes `state/reviewer_<slug>_BLOCKED.md` in place of its required phase file and reports BLOCKED in its return. Re-dispatch once with explicit materialized paths; if still blocked, count it as a missing reviewer (COMPRESSED RUN), never as a clean vote. Most common cause is a reviewer subagent provisioned without `Bash`, so it cannot run `gh pr diff` or `git checkout`.
```

- [ ] **Step 6: Run the tests and verify they pass**

Run: `npm test 2>&1 | tail -12`
Expected: PASS, 512 tests (509 + 3).

- [ ] **Step 7: Commit**

```bash
git add skills/agent-review-panel/SKILL.md skills/agent-review-panel/references/prompt-templates.md tests/behavioral-assertions.test.mjs
git commit -m "fix: a reviewer that could not see the code no longer reads as a clean vote

Phase 13.5 runs three checks - file exists, >=500 bytes, required headers - and
a blind reviewer that writes a well-formed 'no findings' review passes all
three, so the judge counts it as agreement. grep for BLOCKED across the skill
returned nothing. Fixed without new gate logic: the blocked reviewer writes its
BLOCKED file INSTEAD of the required phase file, so the required file is
genuinely absent and the existing existence check re-dispatches, then falls
through to COMPRESSED RUN.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Version sweep and release documentation

**Files:**
- Modify: `package.json:3`, `.claude-plugin/plugin.json:3`, `.claude-plugin/marketplace.json:12`, `skills/agent-review-panel/eval-suite.json:3` and its `"updated"` field at `:5`
- Modify: `skills/agent-review-panel/SKILL.md:22` (H1) and `:1664` (HTML footer string)
- Modify: `CHANGELOG.md`, `skills/agent-review-panel/references/changelog.md`, `ROADMAP.md`, `README.md:437`, `:440`, and the version table at `:534`

**Interfaces:**
- Consumes: Tasks 1–3 must be committed first, because the README test count is read from the final `npm test` output.
- Produces: version `3.9.0` everywhere.

**Note:** `manifest-consistency.test.mjs` enforces that the marquee skill's `SKILL.md` version tracks `plugin.json`'s major.minor, so `SKILL.md:22` and the manifests must agree or the suite goes red.

- [ ] **Step 1: Bump the four JSON version surfaces**

Change `"version": "3.8.3"` to `"version": "3.9.0"` in:
- `package.json` line 3
- `.claude-plugin/plugin.json` line 3
- `.claude-plugin/marketplace.json` line 12
- `skills/agent-review-panel/eval-suite.json` line 3

And in `skills/agent-review-panel/eval-suite.json` line 5, change `"updated": "2026-07-16"` to `"updated": "2026-08-10"`.

- [ ] **Step 2: Bump the two SKILL.md version strings**

- Line 22: `# Agent Review Panel v3.8.3` → `# Agent Review Panel v3.9.0`
- Line 1664: the HTML footer bullet — change `"Agent Review Panel v3.8.3"` to `"Agent Review Panel v3.9.0"`

- [ ] **Step 3: Run the tests to confirm the manifest gate is satisfied**

Run: `npm test 2>&1 | tail -12`
Expected: PASS. If `manifest-consistency` fails, a version surface was missed.

- [ ] **Step 4: Record the true test count and update the README**

Run: `npm test 2>&1 | grep '^ℹ tests'`

Take the number it prints (expected 512 after Tasks 1–3) and update both README references:
- Line 437: `The test suite (499 tests) uses Node's built-in test runner` → substitute the real count
- Line 440: `npm test                    # run all 499 tests` → substitute the real count

**Do not trust `release-check.sh` to catch a mistake here.** Its test-count check at line 110 greps `'^# tests'` while the reporter emits `ℹ tests 512`, so `ACTUAL_TESTS` is empty and the whole block is skipped. Verify by eye.

- [ ] **Step 5: Add the README version-history row**

In the table at `README.md:532`, insert directly above the `| **v3.8** |` row:

```markdown
| **v3.9** | **Reviewer addressing contract** — persistent reviewers are addressed by the `agentId` from their spawn result (a nameless subagent has no other address), and a `SendMessage` returning `success: false` is a failed agent, not a delivered message. Plus: the fresh-spawn fallback now reads its own prior state files, and a reviewer that could not see the code writes a BLOCKED file instead of its phase file so the Phase 13.5 gate catches it rather than counting it as a clean vote |
```

- [ ] **Step 6: Write the CHANGELOG entry**

At the top of `CHANGELOG.md`, above the `## [3.8.3]` entry:

```markdown
## [3.9.0] — 2026-08-10 — Reviewer addressing contract + blocked-reviewer handling

Investigated adapting the panel to Claude Code's cross-session/peer messaging update (2.1.224). Most of what that surfaced was not new capability — two of the three changes here are defects the skill already had, which the update only made *detectable*.

- **Reviewer addressing contract.** v3.8.0 drove Phases 4/5/7 via `SendMessage` "to these same agents" but never said what string identifies them (`grep -rn agentId skills/` returned zero). Panel reviewers are spawned nameless, so the persona label and the Agent tool's `description` both fail to resolve — only the raw `agentId` from the spawn result works, as `SendMessage` has documented since **2.1.77**. The orchestrator now records a persona → agentId map (per-run in multi-run mode, held in context — no state file), addresses every send by that id, and treats `{"success": false}` as a failed agent under the existing retry-once rule. Since **2.1.224** a failed delivery reports an error instead of success, which is what makes this checkable at all. Correctness was never at risk — the fallback is documented at all four dispatch sites — but *which* path a run took was unknowable, and an unannounced fallback is the wrong default in a skill built on announcing degradation.
- **Fresh-spawn fallback had no memory.** SKILL.md promises five times that a freshly spawned replacement reads its own prior `state/` files; `prompt-templates.md` never told it to. A replacement answered a debate prompt from an empty context and its output still passed the Phase 13.5 gate. One preamble line added to the Phase 4/5/7 templates.
- **A blocked reviewer no longer reads as a clean vote.** Phase 13.5 checks existence, ≥500 bytes and required headers — all of which a blind reviewer's well-formed "no findings" review passes, so the judge counted it as agreement. A reviewer that cannot reach the work now writes `state/reviewer_<slug>_BLOCKED.md` **instead of** its required phase file, making the file genuinely absent so the existing gate re-dispatches and then falls through to `COMPRESSED RUN`. No new gate logic, no fourth check, no new banner.

**Declined, with reasons recorded** in `docs/plans/2026-08-10-peer-messaging-adaptation-design.md` so they are not re-litigated: **agent teams** (the only route to a real peer-to-peer debate mesh) — teammates cannot spawn teammates and this panel is often invoked nested; teammates are full sessions while reviewer fan-out is only 7% of measured run cost; and a free-running mesh would disable the Phase 6 sycophancy detector, which needs a round barrier to count position changes before the next round is written. **Cross-session messaging** — messages carry plain text only and so cannot hand over a report; the receiver's `crossSessionInbound` policy can hold or refuse; unanswered approval dialogs drop after five minutes; macOS/Linux only.

**Verified by probe** (Claude Code 2.1.226, macOS): orchestrator → subagent by `agentId` works and by persona name fails; there is no sibling mesh; a subagent → `"main"` push works from foreground spawns too but is queued for the next turn, so it arrives no earlier than the return value (which is why the blocked-reviewer fix uses no messaging at all); foreground spawns do return an `agentId`, so no background-spawn mandate was needed.

Reviewed by a four-reviewer adversarial panel with debate and an Opus judge: SOUND WITH AMENDMENTS. That review run was itself compressed to 3 of 16 phases, so its verdict was held at Medium confidence and every load-bearing claim was re-verified by hand — which caught two errors in the design doc (a false claim that `ListAgents` does not exist, and three wrong changelog version attributions) and two errors in the review itself.
```

- [ ] **Step 7: Mirror into the skill's own changelog and ROADMAP**

Add a matching, shorter entry at the top of `skills/agent-review-panel/references/changelog.md`, and a `| v3.9.0 | 2026-08-10 | ... |` row to the `ROADMAP.md` version table, following the format of the existing `v3.8.0` row.

- [ ] **Step 8: Run the full gate**

```bash
npm test 2>&1 | tail -12 && bash scripts/release-check.sh
```

Expected: tests PASS; `release-check.sh` reports no FAIL lines. Remember its test-count check is inert — the README number is on you.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: v3.9.0 — version sweep, changelog, roadmap, README

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage.** Design Part 1 → Task 1. Part 1b → Task 2. Part 2 → Task 3. "Tests" section items 1–4 → Task 1; item 5 → Task 2; items 6–7 → Task 3. "Version and documentation" → Task 4. Part 3 (declined) requires no code and is captured in the Task 4 CHANGELOG entry. Out-of-scope items are in Global Constraints.

**Placeholder scan.** No TBDs. Every edit shows the literal text to insert and the anchor to insert it against. Every test step shows the runnable command and the expected outcome.

**Type consistency.** The state-file name is `reviewer_<slug>_BLOCKED.md` in SKILL.md prose and `reviewer_{persona_short_name}_BLOCKED.md` in the template — matching the existing convention, where SKILL.md uses `<name>` and templates use `{persona_short_name}`. Test regexes match each in its own file. Test counts chain 499 → 506 → 509 → 512 across tasks; Task 4 Step 4 reads the real number rather than assuming it.

**Known merge risk.** `tests/behavioral-assertions.test.mjs` gains three appended `describe` blocks, and branch `claude/optimistic-elion-d69b24` is appending one too. Resolve by keeping both in version order.
