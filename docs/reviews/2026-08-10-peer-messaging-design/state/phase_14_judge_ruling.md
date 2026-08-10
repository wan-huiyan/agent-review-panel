# Phase 14 — Supreme Judge ruling

**Work under review:** `docs/plans/2026-08-10-peer-messaging-adaptation-design.md` (agent-review-panel v3.8.3 → v3.9.0)
**Date:** 2026-08-10
**Panel:** Correctness Hawk / Probe Verifier · Architecture Critic · Devil's Advocate (analogical) · Completeness Checker / Fresh Reader

---

## Verdict

**SOUND WITH AMENDMENTS.** Confidence: **High.**

Part 1 (the reviewer addressing contract) is correct, and I verified the premise that three
reviewers attacked as an inversion of the tool's contract — it holds. Part 3's decision to decline
agent teams and defer cross-session messaging is right, but one of its stated facts is false and two
of its four supporting grounds do not survive checking. Part 2 (the blocked-reviewer push) contains
one claim I verified as false, and specifies a mechanism too loosely to do the job it is named for.

Nothing here requires abandoning the design. Every defect below has a fix of a paragraph or less.

**Amendment A1 is the only P0**, and it is the only finding on this panel where a reviewer produced
positive evidence that a statement in the document is false, rather than an inference that something
might not work.

---

## What I verified myself before ruling

I did not take any disputed claim on a reviewer's word. Commands run from the worktree root and from
`~/.claude/projects`:

| Check | Result |
|---|---|
| `ListAgents` in the transcript corpus | **10 transcript files** contain `ListAgents` invocations, spanning **2026-08-07T09:02:35Z → 2026-08-10T17:39:57Z**, in **both** main-session files and subagent files (`.../subagents/agent-a0b6443627a28a8b4.jsonl`, `.../subagents/workflows/wf_de629049-114/agent-a33ae5493de458b43.jsonl`), returning real payloads (`Peer sessions (5)`, `Subagents (4)`) |
| `Agent` spawn parameters across the corpus | **260 real spawn records.** Input keys: `prompt` 260, `description` 260, `subagent_type` 238, `run_in_background` 181, `model` 135, `isolation` 4. A `name` input key appears **zero** times |
| `SendMessage` schema (loaded this session) | Verbatim: `\| "main" \| The main conversation (background subagents only) \|`; and "Refer to agents by name … Use the raw `agentId` … **only when the agent has no name**"; `summary` is "required when message is a string" while `required` lists only `to`/`message` |
| `grep -rn "BLOCKED" skills/agent-review-panel/` | No output. The string is absent from SKILL.md and prompt-templates.md |
| Cross-session / permission-mode note said to be at `SKILL.md:1786-1794` | **Does not exist.** `grep -n "2\.1\.226\|permission mode\|approval dialog\|cross-session\|crossSessionInbound" skills/agent-review-panel/SKILL.md` → no output |
| `CHANGELOG.md:135` | Contains the 2026-07-16 empirical verification, including "Measured trade to watch: **persistent reviewers accumulate context across rounds**" |
| Version strings at 3.8.3 | `package.json:3`, `.claude-plugin/plugin.json:3`, `.claude-plugin/marketplace.json:12`, `skills/agent-review-panel/eval-suite.json:3` |
| README hardcoded test counts | `README.md:437` "The test suite (499 tests)", `README.md:440` "run all 499 tests"; `scripts/release-check.sh:110-115` runs `npm test` and fails any README claim that disagrees; `.github/workflows/test.yml:28` runs release-check in CI |
| Efficiency Discipline section boundaries | `1748:## Orchestrator Efficiency Discipline`, `1792:## Budget Mode`. The section is **1748–1791** |
| Phase 13.5 gate | Three checks only — existence, ≥500 bytes, required headers (`SKILL.md:1126-1134`); COMPRESSED emission conditioned on the gate at `SKILL.md:1297-1300`; absence is the green light at `SKILL.md:1145-1146` |
| Phase 3 required output schema | Score / Confidence / Line-by-Line Audit Findings / Strengths / Weaknesses / Suggestions / Key Concern (`references/prompt-templates.md:100-143`) |
| Debate-in-Workflow recipe | `SKILL.md:1713-1745` re-spawns each reviewer per round by design |
| v3.8.0 test block | `tests/behavioral-assertions.test.mjs:1156` slices exactly 800 characters after each phase heading; `:1177` is the negative assertion pattern |
| Two distinct SendMessage error strings | Both present in the corpus: "Re-send with the ref to confirm you mean …" and "No agent named '…' is reachable.\nUse ListAgents to see everyone you can message" |

---

## Rulings on every disputed finding

### Upheld at P0 — one finding

**The `ListAgents` row in section 2 is false** (Completeness `NEW-P0-listagents-claim-false`).

Design doc line 41 states `ListAgents`, tested "in the main session and inside a subagent", **does
not exist** in this environment. I reproduced the Completeness Checker's measurement independently
and both halves of the claim are contradicted: the tool was invoked successfully from main sessions
*and* from subagents, three days before the document was written and again on the day it was
written, returning real peer and subagent listings.

This matters more than a wrong table cell. Line 41 is the *sole* stated ground for Part 3's
cross-session deferral ("`ListAgents` does not exist in this environment, so nothing here is
verifiable today"), inside a section explicitly written "so this is not re-litigated". A false fact
in a permanent decision record is the design being wrong, which is the P0 standard.

The deferral **decision** survives untouched on the four other grounds the document already lists —
plain text only, the receiver's `crossSessionInbound` policy, the five-minute drop, macOS/Linux only,
and public distribution. Only the evidence changes.

The honest reading is that `ListAgents` was not *exposed to the harness the author probed from* —
which is also true of my own session, where `ToolSearch select:ListAgents` returns nothing. That is a
completely different statement from "does not exist", and it is the one the document should make.

**Not a licence to build cross-session support.** The amendment is a rewrite of one table row and one
paragraph.

### Demoted from P0 to P1 — the BLOCKED state file

Raised as P0 by Architecture (`AC-1`) and Completeness (`P0-2`); graded P1 by Devil's Advocate
(`DA-15`) and P1 by Correctness Hawk (`F11`).

Three reviewers reached "a BLOCKED state file passes the Phase 13.5 gate, so the design ships the
defect it names" from the same two line ranges. Under my rules that is **consensus on an
interpretation, not independent verification**, and it does not compound to P0.

`DA-15` is right about why. The gate's checks are existence, ≥500 bytes, and required headers. The
design says only "still write a state file recording BLOCKED" (line 125) — no filename, no marker,
no format. A terse blocked note fails the byte and header checks, the gate fires, and the design's
"already covered" claim at line 208 works exactly as advertised. A template-shaped file passes all
three and the reviewer reads as clean. **The design does not say which**, so the outcome is
unspecified rather than demonstrably wrong.

That is a real P1 defect and the "already covered" claim at line 208 is unsupported as written. But
`grep -rn "BLOCKED" skills/agent-review-panel/` returning nothing is the sharper way to put it: the
design introduces a state no detector in the skill knows about, and its edit-site table amends
neither of the two places that would detect it.

**I rule for Architecture's option (b)**, which is the smallest fix and the only one requiring no new
gate logic: a blocked reviewer writes `state/reviewer_<slug>_BLOCKED.md` **instead of** the required
phase file. The required file is then genuinely absent, the existing gate fires unmodified,
re-dispatches once — which is exactly what Part 2 rule 3 already asks for — and then emits COMPRESSED.
No fourth check, no new banner, no new stacking-order question, and no reviewer-file content read, so
`P1-8`'s conflict with Efficiency Discipline rule 7 and with budget mode dissolves too.

### Demoted from P0 to P1 [UNVERIFIED] — the nested/depth-2 routing findings

Raised as P0 by Architecture (`AC-2`), Devil's Advocate (`DA-2`), Completeness (`P0-1`) and, in a
different form, Correctness Hawk (`F2`).

Four reviewers, two source lines (design doc line 40 and `SKILL.md:1765-1770`), **zero probes**. The
Completeness Checker withdrew its own P0 in round 2 for exactly this reason and named the others;
that was the right call and I extend it to all four. Nobody observed a message routed from a
reviewer under a nested orchestrator, so every one of these is capped at **P1 and tagged
[UNVERIFIED]**.

`F2`'s specific prediction — that the push "most likely ships as a silent no-op" because `to:"main"`
is annotated "(background subagents only)" — is further weakened by two real observations. `DA-16`
sent to `"main"` from inside a panel reviewer in this very run and got `success:true`. And my own
corpus scan shows `run_in_background: true` on 181 of 260 spawns in this environment, so the
background/blocking distinction is not the cliff `F2` assumed. `F2` drops to **P2**, restated as what
it actually is: the probe table records a result without recording the spawn mode, and the document
never mentions the annotation.

All of this becomes moot under amendment A4, which removes the dependency rather than resolving it.

### Demoted from P0 to P2 — "the panel is frequently invoked from inside a subagent" is false

Devil's Advocate `DA-1`, held at P0 across both rounds.

The underlying point is right: design doc lines 154-156 assert an invocation frequency nobody
measured, and lines 165-167 build a reversal condition on it that can therefore never be evaluated.
That is a genuine defect in a decision record.

But "measurably false" overreaches, and two reviewers said so independently. `F16` found the
corroborating marker does not reproduce (it counts this panel's own reviewers *reading* SKILL.md as
if they had *invoked* it), and `P2-da1` reproduced the headline but reached the same conclusion about
the marker. One machine, a twelve-day retention window, and a **publicly distributed** skill: that
corpus cannot establish falsity about invocation shape in the wild. The claim is unmeasured, not
refuted. **P2**, and the fix is deletion rather than restatement.

### Upheld at P1 — Part 2's benefit claim is false

`F3(b)`, `P1-9`, and `DA-3` converge, and I verified it. Design doc lines 120-122 say the push makes
blockage reportable "at the moment it happens". The document's own probe output on line 40 says
`Message queued for the main conversation's next turn`, and `SKILL.md:1768-1770` tells the
orchestrator to poll the state directory in a sleep loop *inside* the current turn rather than ending
it. The queued message therefore arrives at or after the moment the orchestrator was already going to
read the state file. The stated benefit is not merely unmeasured; it is contradicted by the
document's own evidence.

**I rule for `DA-3`: cut the push.** It has no demonstrated benefit, its latency advantage is false,
its delivery at depth 2 is unverified, `SendMessage` must be loaded through `ToolSearch` before a
reviewer can call it (`F7`, which I reproduced — I had to load it myself this session), and rule 1's
ordering puts that unreliable channel *ahead* of the reliable state file. Cutting it dissolves five
findings at once and removes the entire `BLOCKED — <persona name>:` envelope sub-rule, which exists
only to compensate for the push's inability to identify its sender. In a 2164-line skill, YAGNI says
ship the rule, not the transport.

If the author disagrees, the bar is `DA-7`'s: measure it. Not re-argue it.

### Upheld at P1 — the version and documentation sweep is short by four surfaces

All four reviewers found overlapping subsets (`F6`, `AC-9`, `DA-10-rev`, `P1-4` + `P1-5`). This is
consensus on *re-runnable commands*, not on an interpretation, and I re-ran them. Implementing
exactly what design doc lines 200-203 lists produces a **deterministic red CI**, and line 196's
reassurance ("Version consistency is already covered by `tests/manifest-consistency.test.mjs`")
actively invites the implementer to skip the sweep.

### Upheld at P1 — Part 1 rule 2 is correct, but the document must say why

Raised as P0 by Correctness Hawk (`F1`), endorsed by Architecture (`AC-15`) and by Devil's Advocate
(`DA-8-rev`, withdrawing its own round-1 position). All three argued the rule inverts SendMessage's
documented contract.

**The rule is right and the attack fails.** SendMessage's guidance reads in full: "Refer to agents by
name … Use the raw `agentId` … **only when the agent has no name**". The question is therefore
entirely whether an Agent-tool spawn can carry a name. I checked 260 real spawn records: `description`,
`subagent_type`, `run_in_background`, `model`, `isolation`, `prompt` — and **no `name` key, ever**.
The Completeness Checker reached the same count independently. Agent-tool subagents have no name, so
the agentId branch of the contract is the correct one, and the document's premise at line 46 holds.

I note that `F1` was arguing from the tool's surface text while its own recommendation was to run the
probe — which is the right instinct, and the probe (read-only, on 260 historical spawns) now exists
and points the other way. `DA-8-rev`'s residual P3 also resolves: line 46 (no names) and lines 96-98
(name-reuse exposure) genuinely cannot both be true of Agent-tool subagents, and line 46 wins.

The document still needs a one-clause fix, because three expert reviewers read line 85-87 and
concluded it contradicted the tool. A future maintainer will do the same and "fix" it wrong.

### Upheld at P1 — rule 3 overstates what a send result proves

`F4` (grounded on the live payload), `AC-4` (grounded on a citation that does not exist — see
rejections), and `DA-13` (which found a third outcome nobody else modelled).

"Never read a send as delivered without checking the result" implies that checking the result
establishes delivery. The payload's own verb is `queued`, and the delivery point is a future turn. In
a skill whose culture treats overstatement as a defect, shipping a new overstatement into SKILL.md is
itself the defect.

`DA-13` adds a real observation: a malformed call returns a `tool_use_error` with **no `success`
field at all** ("summary is required when message is a string"), and the schema confirms `summary` is
required-in-practice while absent from the `required` array. Rule 3 models two outcomes where there
are three, and the missing one must not burn a fresh spawn on a live, healthy reviewer.

`P1-7`'s point rides along: rule 3 depends on Claude Code ≥ 2.1.222 and the document sets no floor.

### Upheld at P2 — the remaining specification gaps

- **The agentId map has no home, a colliding key, and no update rule.** `AC-3`/`P2-11` (no storage
  location, lost on compaction), `AC-5`/`P1-map-key-collides-within-run` (Run 3 spawns three Devil's
  Advocates concurrently — verified at `SKILL.md:1951` — so a display-name key holds one entry for
  three live agents), and `P1-6` (unrebutted by anyone: the map is never updated when the fallback
  fires, so the orchestrator addresses a dead agent every subsequent phase). Three gaps, one
  three-sentence fix. The Completeness Checker correctly withdrew its round-1 position that collision
  was a non-issue.
- **Rule 4 names the wrong banner for total loss.** `DA-9`, accepted by Completeness. Verified: zero
  round-1 files is the NO-DEBATE condition (`SKILL.md:1158-1162`), which stacks first with a Medium
  confidence cap; per-file loss is COMPRESSED (`SKILL.md:1169-1171`). "No new banner" stays correct.
- **"Cheap orchestrator" inverts the audit it cites.** `F10` and `DA-4`. I rule for `DA-4`: delete the
  word and retitle the ground to unmeasurability. Do not substitute `F10`'s "might help" — the 69% is
  context re-reading, not relay work, and no direction claim is needed in either direction.
- **Rule numbering is ambiguous and the document's own cross-reference goes stale.** `F8`. "A new
  numbered item" (singular) followed by four items restarting at 1; if four are inserted, the
  fresh-session rule 6 that Part 3 line 173 cites becomes rule 10.
- **The proposed tests are weaker than the block they copy.** `P2-15` (no negative assertion, where
  the v3.8.0 block has one at `tests/behavioral-assertions.test.mjs:1177`), `F13`/`P2-10` (design doc
  line 106 risks breaking the currently-green 800-character slice test at `:1156`), and `DA-7`/`P2-17`
  (the document declines agent teams for being unmeasured, then ships an unmeasured change).
- **Rule 1 is unimplementable in one documented execution shape.** `F12`, new in round 2 and
  unrebutted. Verified at `SKILL.md:1713-1745`: the Debate-in-Workflow recipe re-spawns each reviewer
  every round by design, so there is no persistent agentId to record — yet the rule sits under a
  heading that says "Default for every mode".
- **The fresh-spawn fallback can break Phase 7 blindness.** `AC-11`. One clause.

### Declined for v3.9.0

- **`DA-6` (adopt the sibling skill's up-front pre-staging).** The gap is real — the reviewer that
  silently reviews the wrong checkout is invisible to every mechanism in Part 2, and this skill has a
  matching incident at `SKILL.md:198-203`. But this is a new feature, not a fix to the design under
  review, and Part 2 rule 3 already reaches for materialized paths on re-dispatch. **Record it in
  ROADMAP.md; do not build it in v3.9.0.**
- **`AC-13` (exclude substituted personas from the CONSENSAGENT denominator).** Plausible, speculative,
  and it adds machinery to the debate loop. The substitution record in amendment A7 gives a future
  session what it would need. **P3 note only.**
- **`DA-7`'s full measured verification run.** Disproportionate for a specification fix that changes no
  reviewer, round, or phase. Replaced by one honest sentence (amendment A11).

---

## Rejected findings

| Finding | Ruling |
|---|---|
| `AC-4` **evidence** and `AC-12` **entirely** — both cite a cross-session/permission-mode note "measured 2026-08-10, Claude Code 2.1.226" at `SKILL.md:1786-1794` | **The cited text does not exist anywhere in the repository.** `grep` for `2.1.226`, `permission mode`, `approval dialog`, `cross-session`, `crossSessionInbound` over SKILL.md returns nothing; lines 1786-1790 are Efficiency Discipline rule 7 and 1792 is the Budget Mode heading. `AC-4`'s *conclusion* survives on `F4`'s real payload and is upheld above; its evidence must not enter the record. `AC-12` is withdrawn in full and is actively harmful — it tells the implementer to mark a Part 3 deliverable "done", which would leave it unbuilt while the record says it shipped. Caught independently by `F14`, `DA-14` and `P1-ac4-ac12`. |
| `P1-3` — "the 2026-07-16 persistent-reviewer measurement was invented" | **Refuted.** `CHANGELOG.md:135` records it, including "Measured trade to watch: persistent reviewers accumulate context across rounds", and its nested-harness clause is the provenance for the `(measured 2026-07-16)` label at `SKILL.md:1765`. The audit document the finding checked describes a 2026-07-02 run, but design doc line 26 never cites that document. In a repo whose standard is "measured, not guessed", a fabrication charge must be checked repo-wide before it is filed. |
| `AC-7`'s line-range correction — "the section runs to `SKILL.md:1799`" | **Wrong.** The section is 1748–1791; Budget Mode starts at 1792. The design doc's "§ ~1748–1791" is exact. Following the correction would send an implementer into the wrong section. `AC-7`'s four missing-edit-site items are separately sound and partly adopted. |
| `F5`'s inference — "the error string carries no information about address-form validity" | **Wrong.** Two distinct error strings exist and I confirmed both in the corpus: the ref-handshake form ("Re-send with the ref to confirm you mean …") and the unreachable form ("No agent named '…' is reachable"). `F5`'s four probes were all unresolvable names, so they collapsed to one form. The paired-control recommendation is sensible but low-value; the inference it supports does not hold. |
| `F1` / `AC-15` / `DA-8-rev` at P0 — "rule 2 inverts SendMessage's contract" | **Premise refuted, severity demoted.** 260 spawn records, zero `name` parameters. See the P1 ruling above — the rule is right, only its justification is missing. |
| `F2` at P0 — "the push most likely ships as a silent no-op" | **Demoted to P2.** Contradicted by `DA-16`'s observed `success:true` from a panel reviewer, and by 181 of 260 spawns in this environment already using `run_in_background`. |
| `AC-1` / `P0-2` at P0, `AC-2` / `DA-2` / `P0-1` at P0, `DA-1` at P0 | **All demoted**, for the reasons given in the rulings above: interpretation-consensus, unobserved tool behaviour, and over-claimed measurement respectively. |

---

## Amendments, in priority order

Each names the exact section of the design document to change.

### A1 — P0 · Section 2 table row 5, and Part 3 "Cross-session messaging"

Replace the `ListAgents` row. It currently reads "**does not exist** in this environment". It should
say what was actually observed, scoped to the harness:

> `ListAgents`, from the panel's Agent-tool subagents — **not exposed** in the harness probed. Not
> evidence the tool is absent machine-wide: transcript records show successful `ListAgents` calls
> from both main sessions and subagents between 2026-08-07 and 2026-08-10, returning peer-session and
> subagent listings.

Then rewrite the opening sentence of the cross-session paragraph (line 172). Delete "`ListAgents`
does not exist in this environment, so nothing here is verifiable today" and defer on the grounds
that hold, which the paragraph already lists: plain text only, the receiver's `crossSessionInbound`
policy can hold or refuse delivery, an unanswered approval dialog drops the message after five
minutes, macOS/Linux only, and the skill is distributed publicly so it must work where the feature is
absent.

Also settle the paragraph's internal contradiction that `DA-14` spotted: line 146 says "Neither is
built in v3.9.0" while lines 177-178 say the manual note under rule 6 is "documented". Say plainly
which, and if it is to be written, add it to an edit-site table.

**Why first:** it is the only verified falsehood in the document, and it sits in a section written to
be permanent.

### A2 — P1 · "Version and documentation"

Add the four missing surfaces to the bump list:

- `.claude-plugin/marketplace.json:12`
- `skills/agent-review-panel/eval-suite.json:3` (and its `"updated"` field, currently `"2026-07-16"`)
- `README.md:437` and `README.md:440` — the hardcoded test count, set from the actual post-implementation
  `npm test` figure (499 today; six added tests make it 505)
- a `README.md` v3.9 row in the version-history table at `README.md:530-534`

Replace line 196's reassurance ("Version consistency is already covered by
`tests/manifest-consistency.test.mjs`") with the operative instruction: **run
`bash scripts/release-check.sh` before opening the PR.** Release-check is wired into CI at
`.github/workflows/test.yml:28` and gates all of the above.

**Why:** implementing the list as written turns CI red, deterministically.

### A3 — P1 · Part 2 rule 1, and the Part 2 edit-site table

Specify the BLOCKED file so the existing machinery detects it, with no new gate logic:

> A blocked reviewer writes `state/reviewer_<slug>_BLOCKED.md` **instead of** its required phase file,
> naming what it could not reach. The required phase file is therefore genuinely absent, the Phase
> 13.5 gate fails on the existence check, re-dispatches once, and — if the reviewer is still blocked —
> emits `COMPRESSED RUN` through the existing path.

Then either add `SKILL.md` Phase 13.5 (`:1126-1134`) and Phase 15.1 (`:1297-1315`) to the edit-site
table, or state explicitly that this design deliberately requires no change to either because the
absent required file triggers them unmodified. The second is true under this amendment and is the
cheaper claim to defend.

Fix line 208 in "Out of scope" the same way. "`COMPRESSED RUN` already covers a reviewer that missed a
phase" is only true once the BLOCKED file is defined not to satisfy the phase schema. Say that.

### A4 — P1 · Part 2, rules 1, 2 and 4, and the edit-site table

**Cut the push to `"main"`.** Delete rule 2 (the `BLOCKED — <persona name>:` envelope form) entirely,
delete the "send a message to `main` immediately, before doing anything else" clause from rule 1, and
delete the "accelerator, not a dependency" framing in rule 4. Delete the claim at lines 120-122 that
this makes blockage reportable "at the moment it happens" — the document's own probe output on line 40
says the message is queued for the next turn, and `SKILL.md:1768-1770` already has the orchestrator
polling the state directory within the current turn.

What remains of Part 2 is the part that works and is worth shipping: the reviewer declares blockage in
its ≤50-word return and writes the BLOCKED file from A3; the orchestrator treats a blocked reviewer as
not clean, re-dispatches once with explicit materialized paths, and otherwise counts it as a missing
reviewer. The edit-site table shrinks to two rows.

If the push is kept instead, then all of the following become required rather than optional: probe
depth 2 and record the row with the spawn mode; instruct the reviewer to load `SendMessage` via
`ToolSearch` first; reorder rule 1 so the state file is written **before** the push is attempted; and
specify `summary:` alongside the message body, since the tool rejects a string message without it.

### A5 — P1 · Part 1 rule 3

Rewrite to state the asymmetry and enumerate all three outcomes:

> `success: false` is a definite delivery failure and triggers the documented fresh-spawn fallback
> (Efficiency Discipline rule 2 — *not* the Implementation-Notes "retry failed agents once", which is a
> different rule for a different event). `success: true` means the message was accepted for queueing,
> not that it was delivered — the state file on disk remains the delivery evidence, as
> `SKILL.md:1767-1771` already says. A `tool_use_error` is a malformed call: correct it and retry
> without spawning a replacement and without consuming the retry budget.

Add the version floor: rule 3 depends on Claude Code ≥ 2.1.222; below that a failed send still reports
success, so the state-file check after each dispatched wave is the only signal. Add one sentence on
whether a fallback spawn counts against the Phase 13.5 single-retry budget (`SKILL.md:1141`) — given
the ≤40-turn target, it should.

### A6 — P1 · Part 1 rule 2

Keep the rule. Add the evidence, in one clause, so nobody reverses it later:

> Address by agentId only. The Agent tool's spawn call takes no `name` parameter — `description`,
> `subagent_type`, `run_in_background`, `model`, `prompt`, `isolation` only — so an Agent-tool subagent
> has no name. SendMessage's "refer to agents by name" guidance covers named background agents and
> agent-team teammates; its own text directs you to the raw agentId when the agent has no name, which
> is this case.

Delete or restrict the name-reuse paragraph at lines 96-98. If Agent-tool subagents have no names, the
2.1.212 name-reuse misrouting cannot apply to them, and the paragraph contradicts line 46.

### A7 — P2 · Part 1 rule 1

Three sentences, fixing three gaps at once:

> Persist the map to `state/agent_ids.md` (`state/run_<N>/agent_ids.md` in multi-run mode) so it
> survives context compaction. **Key it on the per-instance state-file slug, not the persona display
> name** — Run 3 spawns three Devil's Advocates concurrently and the display name does not distinguish
> them. When the fresh-spawn fallback fires, the replacement's agentId replaces the dead entry before
> the next phase; otherwise every subsequent send addresses a dead agent and silently re-pays full
> price.

Add `state/agent_ids.md` to the state-file list at `SKILL.md:2058-2062` and to the layout blocks at
`:2064-2093`. Note that an agentId read from disk in a *new* session is unusable — which is safe,
because `success: false` routes to a fresh spawn.

### A8 — P2 · Part 1 rule 4

Split the two cases:

> If some personas lost a phase → `COMPRESSED RUN`. If **all** Phase 5 output is lost → this is the
> `NO-DEBATE` condition (`SKILL.md:1158-1162`), which stacks first and caps verdict confidence at
> Medium.

"**No new banner**" stays, and is now correct for both cases.

### A9 — P2 · Part 3

Four corrections to the decision record:

1. **Delete** "This skill is frequently invoked from inside a subagent or a workflow, and every such
   invocation could not form a team at all" (lines 154-155). It is unmeasured. Keep "No nested teams —
   a teammate cannot spawn teammates" as the factual half.
2. **Delete "cheap"** from line 159 and retitle the third ground to "**Cost effect is unmeasurable
   without adopting an experimental flag**". The audit puts the orchestrator at 69% — it is the most
   expensive component, not the cheap one. Unmeasurability alone declines the change under this repo's
   rules; no direction claim is needed.
3. **Rewrite the reversal condition** (lines 165-167) to something checkable: "Revisit when agent teams
   leave experimental and nested teams are permitted." Drop the dominant-invocation-shape clause, which
   nothing can evaluate.
4. **Label the agent-teams facts.** "A teammate cannot spawn teammates", the
   `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` gate, and "teammates are full Claude Code sessions" carry no
   source in a document that opens by claiming it probed rather than relying on documentation. Tag them
   `[UNVERIFIED — vendor documentation, not probed]`. Same for the unlinked Anthropic quotation at lines
   52-53.

Keep the fourth ground (quality). `DA-11` is right that it is genuine and under-argued, and the
one-line strengthening is worth taking: the Phase 6 CONSENSAGENT check is defined per debate round
(`SKILL.md:807-810`), and a free-running mesh has no rounds, so the check has nothing to count and
nowhere to inject.

### A10 — P2 · Part 1 "Rule" preamble and edit-site table

State the resulting numbering explicitly — whether these become rules 3-6 or one rule with four
sub-points — and fix the stale cross-reference in the same edit: Part 3 line 173 cites "Orchestrator
Efficiency Discipline rule 6", which is the fresh-session rule today and becomes rule 10 if four items
are inserted.

### A11 — P2 · "Tests"

Four additions:

- A **negative assertion**, matching the v3.8.0 block's own pattern at
  `tests/behavioral-assertions.test.mjs:1177`: no text in SKILL.md or `prompt-templates.md` instructs
  addressing a persistent reviewer by persona name or by the Agent tool's `description`.
- Assertions for the map-update-on-fallback rule (A7) and the BLOCKED filename convention (A3).
- A note in the Phases 4/5/7 edit-site row: the pointer text must keep the literals
  `**persistent reviewer agent` and `SendMessage` **within 800 characters** of each phase heading, or
  the existing v3.8.0 test at `:1156` must be updated in the same change.
- One honest sentence in the document: Part 1 is a specification fix verified by presence assertions;
  it is **not** measured at runtime, unlike v3.8.0's turn-count claim. Say so rather than letting the
  test list imply parity.

### A12 — P2 · Part 1 rule 1

Add one scope sentence. The addressing contract governs Agent-tool orchestration. Under the
Debate-in-Workflow recipe (`SKILL.md:1713-1745`) reviewers are re-spawned per round by design, so there
is no persistent agentId to capture and the rule does not apply; the fresh-spawn cost is accepted
there. Write the A11 tests against the scoped wording so they do not freeze the unconditional form.

### P3 notes — record, do not build

- `DA-6` — up-front pre-staging (materialize the branch, pre-generate the scoped diff, hand explicit
  paths plus a "you may have no Bash" preamble). Real gap; new feature. Add a ROADMAP row.
- `AC-13` — exclude a persona substituted mid-round from the CONSENSAGENT denominator. Speculative;
  the substitution record in A7 preserves what a future session would need.
- `AC-11` — one clause on the fresh-spawn fallback: give the replacement the explicit list of its
  **own** prior state-file paths; it must not glob `state/`, which would break Phase 7 blindness with
  no gate that would notice.
- `P3-18` — four terms undefined on first use ("sibling mesh", "star topology", "the envelope", "relay
  work"), and the citation at lines 60-62 points one line above the sentence it quotes (the quoted text
  starts at `SKILL.md:1761`, not `:1760`).

---

## Judge-introduced findings

**None.** Every amendment above traces to a finding a reviewer raised. Where I ruled against the
panel's severity I did so on evidence I gathered myself, and where I ruled against a reviewer's
evidence I reproduced the check.
