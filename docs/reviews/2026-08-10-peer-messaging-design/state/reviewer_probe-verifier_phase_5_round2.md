# Phase 5 — Debate Round 2 — Correctness Hawk / Probe Verifier

**Score: 5.5/10** (round 1: 5)
**Confidence: High** on everything I re-ran a command for; **Medium** on the two
addressing questions that still need a probe from the main session.
**Agreement intensity: 30%.**

**Headline for this round:** I ran commands against the three peer claims that
would most change my position. Two of them do not survive. The Architecture
Critic's AC-4 and AC-12 both cite a passage of SKILL.md that **does not exist
anywhere in the repository**. The Completeness Checker's P1-3 ("invented
measurement") checked the wrong document — the measurement it says does not
exist is at `CHANGELOG.md:135`, and the Devil's Advocate cited it in the same
packet. Meanwhile every P0 on this panel, mine included, is an inference from
static text that nobody has probed. Applying the falsification rule honestly,
**no finding on this panel survives at P0**, and I am demoting my own two.

---

## 1. Points of agreement — what I now accept

### 1a. ACCEPTED, and I upgrade my own finding: the Phase 13.5 interaction (AC-1, P0-2)

I raised this in round 1 as F11 at **P2** ("asserted, not shown"). The
Architecture Critic and the Completeness Checker both went further and they are
right that I under-rated it. What convinced me was reading the gate's three
checks against the Phase 3 template in the same sitting:

- Gate checks, verbatim from `skills/agent-review-panel/SKILL.md:1126-1134`:
  existence; **"file size ≥ 500 bytes"**; and **"the required schema sections
  for that phase (e.g., a Phase 3 review must contain a Score, a Findings
  section, and severity tags). The exact required sections per phase are
  defined in `references/prompt-templates.md`."**
- The template that defines those sections:
  `references/prompt-templates.md:100-128` mandates `**Score: X/10**`,
  `**Confidence:**`, `#### Line-by-Line Audit Findings`, `#### Strengths`,
  `#### Weaknesses`, `#### Suggestions`, `#### Key Concern` — and at :141-143,
  **"If the line-by-line audit found nothing, state: 'Line-by-line audit: no
  issues found.'"**

So the gate's schema is *defined by the very template the design proposes to
edit*, and the design edits the template without touching its Required Output
Format. That is a sharper statement of the problem than either peer made, and it
identifies the cheapest fix: the BLOCKED marker belongs in the template's
Required Output Format, because that is what the gate parses.

**But I do not accept it at P0, and I will not let the two-reviewer agreement
carry it there.** `[STATIC-INFERENCE-CONSENSUS]` — AC-1 and P0-2 read the same
two passages (SKILL.md:1126-1134 and prompt-templates.md:100-128) and reached
the same reading. That is one interpretation held twice, not two verifications.
And the interpretation asserts one of two live branches as certain: the design
says only "still write a state file recording BLOCKED" (design doc line 125) and
never specifies the file's name, length, or contents. A blocked reviewer writing
a two-line "BLOCKED — cannot read the PR branch" note lands **well under 500
bytes** and fails the gate, which then fires COMPRESSED exactly as the design
claims. A blocked reviewer that dutifully fills in the template skeleton passes.
The defect is that **the outcome is decided by unspecified content**, which
makes the doc's "already covers" (line 208) unverifiable-as-written rather than
demonstrably false. That is a solid **P1**. I have moved F11 from P2 to P1 and
adopted the peers' remedy.

### 1b. ACCEPTED, unreservedly: the 800-character test constraint (P2-10)

This is the best-verified finding anyone brought this round and I missed it
entirely. Verified by reading the test:
`tests/behavioral-assertions.test.mjs`, the case *"Phases 4, 5, and 7 drive
persistent reviewers via SendMessage"*, does
`const section = skillMd.slice(idx, idx + 800)` for each of the three phase
headings and then asserts `/\*\*persistent reviewer agent/` and
`section.includes("SendMessage")`. Design doc line 106 tells the implementer to
"Point at the addressing rule rather than restating it" in exactly those three
sections. Rewrite them carelessly and a currently-green v3.8.0 test goes red.
Accepted as stated.

I will add the corollary nobody stated: the same test file computes
`const discipline = skillMd.slice(skillMd.indexOf("## Orchestrator Efficiency
Discipline (v3.8.0 — all modes)"))` **with no end bound**, so that slice runs to
end-of-file. The design's proposed v3.9.0 block says it will follow this
pattern; if it does, an assertion like "SKILL.md forbids addressing by persona
name" will pass no matter where in the file the sentence lands. Worth one line
in the test plan.

### 1c. ACCEPTED: the negative assertion (P2-15) and the version sweep (AC-9, DA-10, P1-4)

P2-15 is right and I verified the precedent: the v3.8.0 block's last case is
*"no 100-word return protocol survives anywhere"*, which checks **absence**
across both SKILL.md and prompt-templates.md. The proposed v3.9.0 block has no
such case, so it can catch a missing paragraph but not a surviving contradictory
one. Adopt.

On versions, four of us converged and it is command-verified, so it is not
merely consensus: `grep -rn '"version"'` returns `.claude-plugin/marketplace.json:12`
and `skills/agent-review-panel/eval-suite.json:3` both at `3.8.3`; `README.md:437`
and `:440` both claim `499 tests`; `scripts/release-check.sh:153` checks the
eval-suite, `:168-171` checks the marketplace entry, and `:110-118` runs
`npm test` and fails any README count that disagrees. Stays **P1**, and my
recommendation stands: replace the doc's reassurance sentence with the operative
instruction to run `bash scripts/release-check.sh` before the PR.

### 1d. PARTIALLY ACCEPTED: DA-6's pre-staging point

The Devil's Advocate is right that the design imports the sibling skill's
failure class but only its step 5. The second branch — a reviewer that silently
reviews the wrong checkout and never knows it is blocked — is untouched by
anything in Part 2, and this repo has a real incident of that class at
`SKILL.md:198-203`. I accept the gap. I do not accept it as a v3.9.0 blocker;
adding worktree materialization to Phase 3 is a larger change than the whole of
Parts 1 and 2, and the repo applies YAGNI ruthlessly to a 2164-line file
(`wc -l skills/agent-review-panel/SKILL.md` → `2164`). Note it as out-of-scope
with a reason, do not silently omit it.

---

## 2. Points of disagreement — verified

### 2a. AC-4 and AC-12 cite a passage that does not exist. Both must be withdrawn.

The Architecture Critic quotes, as a measured counter-example living in the
skill:

> "a send into a session whose permission mode differs from the sender's returns
> `success: true` with a message id while the message is silently held for an
> approval dialog that a headless session never shows (measured 2026-08-10,
> Claude Code 2.1.226)" — cited as `skills/agent-review-panel/SKILL.md:1790-1793`

and AC-12 asserts the cross-session manual note "already exists, complete with
the 2026-08-10 measurement, at `SKILL.md:1786-1794`."

Verbatim, from the worktree root:

```
$ grep -rn "2\.1\.2\|permission mode\|cross-session\|crossSession" skills/
NO MATCHES

$ grep -rn "2\.1\.226\|permission mode\|crossSessionInbound\|silently held for an approval" \
    --include="*.md" --include="*.json" --include="*.mjs" .   # excluding the design doc + this review dir
NO MATCHES ANYWHERE IN REPO
```

And the lines actually cited, from `grep -n "" skills/agent-review-panel/SKILL.md`:

```
1786:7. **Read state files only for orchestrator logic** — the orchestrator opens
...
1790:   next agent can read from disk itself.
1791:
1792:## Budget Mode (v3.7.0)
```

Lines 1786-1790 are rule 7. Line 1792 is the next section heading. There is no
cross-session note, no permission-mode measurement, and no `2.1.226` string
anywhere in this repository outside the design doc under review.

Consequences the implementer must not inherit:

1. **AC-4's evidence is void.** Its conclusion — that `success: true` is not a
   delivery guarantee — is still correct, but it is correct because
   `SendMessage`'s own success payload says **"queued"**, which is my F4 and my
   round-1 probe, not because of a measurement in the skill.
2. **AC-12 is actively harmful and must be rejected.** It tells the implementer
   to "mark it done rather than planned" for the Part 3 cross-session note. The
   note does not exist. Following AC-12 drops a documented deliverable from
   v3.9.0 on the strength of a citation to nothing.

I also checked AC-7's correction that "the section runs to SKILL.md:1799". It
does not: rule 7 ends at 1790 and Budget Mode opens at 1792. The design doc's
own range, "§ ~1748–1791", is the accurate one. AC-7's other four missing edit
sites are fine; that one correction is wrong and would send an implementer into
the Budget Mode section.

### 2b. P1-3 "invented measurement" is itself the invented claim.

The Completeness Checker calls design doc line 26 ("v3.8.0's persistent-reviewer
measurement was taken on 2026-07-16") a fabrication, on the grounds that the
2026-07-16 audit is a cost split of a 2026-07-02 run.

The audit part is right — verbatim from
`docs/analysis/2026-07-16-panel-token-split-audit.md:3-9`: *"parsed the Claude
Code transcripts … of one real full-protocol run … executed 2026-07-02"*. But
the doc never cites the audit for that sentence, and the measurement it names
exists in a different file. `CHANGELOG.md:135`, verbatim:

> **Empirically verified** (2026-07-16, full protocol on a 206-line script, 4
> opus reviewers, 3 adaptive debate rounds, HTML skipped): orchestrator **51
> turns / $22 / 31% of run cost** vs the pre-discipline baseline's **157 turns /
> $111 / 69%** … Measured trade to watch: persistent reviewers accumulate
> context across rounds

That is a 2026-07-16 empirical verification of the v3.8.0 discipline —
persistent reviewers included, by name, in its own "measured trade to watch"
clause. Design doc line 26 is supported. The Devil's Advocate quoted this exact
line in DA-7 in the same packet, so the panel had the refutation in hand and
still shipped the accusation.

The same line also rehabilitates the "(measured 2026-07-16)" label on the
nested-context caveat at `SKILL.md:1765`, which P1-3 attacks as unsupported:
`CHANGELOG.md:135` attributes its 11-turn overshoot to *"nested-verification
harness effects (idle/nudge cycles before the poll-loop instruction landed)"* —
i.e. the nested observation comes from the verification run, not the audit.
P1-3 should be withdrawn. Accusing a doc of inventing a measurement is the most
serious charge available under this repo's culture and it has to be checked
across the repo, not against one file.

### 2c. DA-1's measurement does not reproduce, and its P0 framing overreaches.

DA-1 reports, over `~/.claude/projects`, `MAIN: SKILL.md body loaded (heading) = 6`
and `SUB: … = 0`, and concludes the doc's "frequently invoked from inside a
subagent" is *"measurably false"*.

I re-ran it. Two things.

**First, a methodology trap that silently zeroes results here.** Every project
directory name begins with `-` (e.g.
`-Users-huiyan-Documents-agent-review-panel--claude-worktrees-peer-messaging-skill-adapt-1f4bd1`).
Any pipeline that passes those paths as arguments to `grep`/`ls` has them parsed
as options; with stderr suppressed, the run returns a clean, confident **0**. My
first attempt produced exactly that false zero for a pattern I knew was present.
Prefixing `./` fixes it. I cannot tell whether DA-1 hit this, but a bare `0` from
this corpus needs a positive control before it carries a P0.

**Second, the corrected counts.** Same corpus (156 main + 1847 subagent
transcripts, vs DA-1's 156 + 1837 — the delta is this session's own files):

```
pattern [# Agent Review Panel v]                -> main=6  sub=6
pattern [skills/agent-review-panel/SKILL.md]    -> main=4  sub=32
```

`sub=6`, not 0. Resolving where those six sit is the interesting part:

```
SUB ./-Users-…-peer-messaging-skill-adapt-1f4bd1/f7211ff9-…/subagents/workflows/wf_20d93ba5-9dc/agent-a50967a9706b5d312.jsonl
SUB ./-Users-…-peer-messaging-skill-adapt-1f4bd1/f7211ff9-…/subagents/workflows/wf_3750aa56-40c/agent-a230f658cb387b60c.jsonl
… 4 more, all under the same session f7211ff9 …
```

All six are **this panel run** — reviewer subagents reading SKILL.md because
SKILL.md is the work under review. They are self-review artifacts, not nested
invocations. So DA-1's directional conclusion survives (no nested invocation of
the panel appears in this corpus) but its strength does not: the corpus contains
roughly four real invocations over twelve days on one machine, and four
observations cannot make a frequency claim about a **publicly distributed** skill
*"measurably false"*. The correct label is the one DA-1's own recommendation
lands on — the claim is unmeasured and the reversal condition built on it is
uncheckable. **P0 → P2.** The reversal-condition criticism is good and I support
it.

### 2d. DA-8 tries to refute my F1 with the doc's own unprobed premise. It cannot.

DA-8 argues that if Agent-tool subagents have no human-readable name, the
2.1.212 name-reuse rationale is structurally inapplicable, and the paragraph
should be deleted. That reasoning takes design doc line 46 ("Agent-tool
subagents have no human-readable name") as established. It is not established —
it is the single untested premise my F1 is about, inferred from spawns that did
not set a name. `SendMessage`'s own schema, which I loaded again this round,
says the opposite is the normal case, verbatim:

> "Refer to agents by name — names keep working after an agent completes (a send
> resumes it from its transcript). Use the raw `agentId` (format `a...-...`) from
> its spawn result **only when the agent has no name**, or when a newer agent
> took the name (latest wins)."

and `TaskStop`'s says *"To stop a background agent spawned with a name, pass
that name as task_id"*. You cannot delete the name-reuse paragraph *because*
names do not exist while the doc's evidence that names do not exist is the thing
under challenge. Either probe it or leave both alone.

I re-checked whether I can settle it from here. I cannot: I have no spawn tool.
`ToolSearch select:TaskCreate` returns a **to-do list manager** ("create a
structured task list for your current coding session"), not an agent spawner, so
the Task* family is not the spawn API. That is itself the argument for re-running
section 2 from the main session.

### 2e. On the three nested-routing P0s (AC-2, DA-2, P0-1)

`[STATIC-INFERENCE-CONSENSUS]` — all three rest on the same two lines: design doc
line 40 (the "main conversation's next turn" payload) and `SKILL.md:1765` (the
nested caveat). Nobody spawned an agent inside an agent and sent to `"main"`.
Three reviewers reading the same two lines is one interpretation held three
times. The gap is real and the recommendation (probe it, record the row) is
right — but it is a **P1**, not a P0, until somebody runs the spawn.

---

## 3. Updated assessment

**5 → 5.5.** Small, and I want to be precise about why it moved at all.

Moving it **down**: the Phase 13.5 interaction is worse than my P2 (§1a), and
the 800-character test constraint (§1b) is a concrete way the implementation
breaks a green test.

Moving it **up**, more strongly: three of the panel's harshest charges against
this doc do not survive contact with a command. It does not cite a passage that
does not exist (AC-4, AC-12 do). It does not invent a measurement (P1-3 says so,
`CHANGELOG.md:135` says otherwise). Its frequency claim is unmeasured, not
"measurably false" (§2c). A doc that survives that much adversarial checking with
its evidence base intact is better than a 5.

What keeps it at 5.5 rather than 7 is unchanged from round 1 and unaddressed by
anyone: **section 2 is four probe rows and two inferences, and the inferences are
what get written into a 2164-line skill as normative rules.** The two verbatim
strings reproduce byte-for-byte in my probes. "Address by agentId only, never the
persona name" does not follow from them, and the channel Part 2 depends on is
documented "(background subagents only)" against a skill that launches reviewers
as ordinary blocking parallel Agent calls (`SKILL.md:743`). Re-probe section 2
from the main session with paired controls, a name-parameter probe, a
background-vs-blocking probe, and a nested probe. Four probes fix most of this
panel's findings at once.

---

## 4. New finding — the workflow execution shape makes Part 1 rule 1 unimplementable

**F12 — P1.** Nobody has raised this, and I found it by accident while
re-measuring DA-1.

Part 1 rule 1 is written unconditionally: *"Every Phase 3 spawn returns an
`agentId`. Record a persona → agentId map before leaving Phase 3."* It lands in
a section that opens, at `SKILL.md:1749-1750`, *"**Default for every mode — full
panel, deep, multi-run, assessment, and budget alike.**"*

But SKILL.md documents a supported execution shape in which there is no
orchestrator-visible spawn result at all. The **Debate-in-Workflow recipe**
(`SKILL.md:1713-1745`) spawns reviewers from a script and, by design,
**re-spawns them every round** rather than messaging a persistent agent:

```js
const round2 = await parallel(PERSONAS.map((p, i) => () =>
  agent(`You are ${p.name}. Your round-1 findings: …`, {phase: 'Debate', …})));
```

In that shape there is no `agentId` to capture, no `SendMessage` to Phases 4/5/7,
and rule 3's "`success: false` triggers the fresh-spawn fallback" is vacuous
because every round already is a fresh spawn. Rule 1 as drafted is therefore
false in a documented shape, and the proposed test *"SKILL.md documents capturing
`agentId` from the Phase 3 spawn result"* would freeze the unconditional wording
in place.

This is not hypothetical. **This panel run is executing in that shape right now.**
My own system prompt opens *"You are a subagent spawned by a workflow
orchestration script"*, and the transcript layout confirms it — the reviewer
subagents for this review live under
`~/.claude/projects/-Users-…-peer-messaging-skill-adapt-1f4bd1/f7211ff9-…/subagents/workflows/wf_3750aa56-40c/agent-*.jsonl`,
a `workflows/wf_*` directory, five agents in one wave. The workflow shape is
also the one `SKILL.md:1704-1712` singles out as producing structurally
debate-less runs, and `SKILL.md:1174-1178` says an inline/workflow-shaped run
*"can skip this gate entirely"* — so it is precisely the shape where the design's
COMPRESSED backstop is weakest.

**Recommendation.** Add one scope sentence to rule 1 and one row to the
Review-Mode Spectrum section: the addressing contract governs Agent-tool
orchestration; under the Debate-in-Workflow recipe reviewers are re-spawned per
round by design, the agentId rule does not apply, and the fresh-spawn cost is
accepted for that shape. Then write the proposed test against the scoped wording,
not the unconditional wording. Same treatment for Part 2: state whether a
workflow-spawned reviewer is expected to push to `"main"` at all.

---

## 5. Falsification check on every P0

Applying the rule as given — *if a P0 could be falsified by one cheap read-only
observation and nobody has run it, cap it at P1 until verified.*

| Finding | Single observation that would prove it wrong | Cheap? | Verdict |
|---|---|---|---|
| **My F1** (addressing rule inverts the tool contract on an untested premise) | Read the spawn tool's schema from the main session and find no `name` parameter — then "subagents have no name" is established and the rule is merely unidiomatic, not wrong | Yes — one schema read, read-only. **Nobody has run it, and I cannot: I have no spawn tool** (`ToolSearch select:TaskCreate` returns a to-do list manager) | **P0 → P1.** Demoted by my own rule |
| **My F2** (Part 2 targets a "background subagents only" channel; reviewers launch as blocking parallel Agent calls at `SKILL.md:743`) | Spawn one ordinary blocking parallel Agent subagent and have it send to `"main"`; if it arrives, the channel is not background-only | Yes — one spawn + one send from the main session. Not run by anyone | **P0 → P1.** Demoted |
| **My F3** ("was delivered" vs the "queued" payload; the `pin` mis-attribution) | Produce the arrival evidence for the subagent→main send, and name which send emitted the `pin` | Yes — it is one line of the author's own transcript | **P0 → P1.** Demoted |
| AC-1 / P0-2 (BLOCKED file passes the gate) | Show that a blocked reviewer's file lands under 500 bytes, which fails check 2 and fires COMPRESSED exactly as the doc claims | Not obtainable at all — the design never specifies the file's content, so both branches are live | **P0 → P1.** The defect is "unspecified", not "demonstrably passes" |
| AC-2 / DA-2 / P0-1 (nested → `"main"` misroutes) | One depth-2 probe: main → orchestrator-subagent → reviewer → `"main"`, and observe where it lands | Yes — one spawn chain. Not run by anyone | **P0 → P1** |
| DA-1 (frequency claim "measurably false") | Already falsified as framed — my re-measure gives `sub=6`, not 0, and the four real invocations in a 12-day single-machine corpus cannot establish falsity for a publicly distributed skill | Already run, above | **P0 → P2** (unmeasured claim, uncheckable reversal condition) |

**Net: no finding on this panel survives at P0.** Every one is a static
inference about tool behaviour that four probes from the main session would
settle. That is the recommendation the panel should converge on — not a stack of
P0s built on the same unprobed lines.

---

## 6. Shared-artifact check

- **`[STATIC-INFERENCE-CONSENSUS]`** — AC-1 and P0-2 (BLOCKED passes the gate):
  both from `SKILL.md:1126-1134` + `prompt-templates.md:100-128`. One reading,
  held twice. Capped at P1.
- **`[STATIC-INFERENCE-CONSENSUS]`** — AC-2, DA-2 and P0-1 (nested misrouting):
  all three from design doc line 40 + `SKILL.md:1765`. One reading, held three
  times. Capped at P1.
- **`[STATIC-INFERENCE-CONSENSUS]`** — AC-4 and my F4 (success ≠ delivery): same
  conclusion, but *not* the same artifact. AC-4's artifact does not exist
  (§2a); mine is the live payload from my own probe. Keep mine, drop AC-4's
  evidence line.
- **NOT consensus — independently command-verified by four of us:** the version
  sweep (AC-9, DA-10, P1-4, my F6). `grep`, `npm test` and
  `scripts/release-check.sh` are re-runnable and I re-ran them. This one is safe
  to act on without further probing.
- **NOT consensus — single-source, command-verified by me alone:** §2a (the
  nonexistent SKILL.md passage), §2b (`CHANGELOG.md:135`), §2c (the corrected
  transcript counts), and F12 (the workflow shape). Each is one grep away from
  being checked by anyone who doubts it, and I have given the commands.
