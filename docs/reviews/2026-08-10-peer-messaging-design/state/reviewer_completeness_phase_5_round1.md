# Reviewer: Completeness Checker / Fresh Reader — Phase 5, Round 1

**Doc under review:** `docs/plans/2026-08-10-peer-messaging-adaptation-design.md`
**Mode:** Exhaustive. Agreement intensity 40%.
**Score:** 6 / 10

## Summary

This is a better-than-average design doc: it probed the tool instead of trusting the changelog, it
records what it declined and why, and it explicitly refuses to add a banner it does not need. That
is the repo's culture working.

But it has two gaps that would ship a defect, one false claim about the repo's own measurement
record, and a version-bump list that will fail CI as written. Separately, the whole of Part 2 rests
on a channel whose behaviour was never probed in the execution shape the doc itself calls frequent.

---

## P0-1 — Part 2's push channel was not probed in the nested case, which the doc calls frequent

The verification table (design doc:36–41) has four rows. None of them is "reviewer running under a
nested orchestrator → `main`". The probe that succeeded returned, verbatim (design doc:40):

> `{"success":true,"message":"Message queued for the main conversation's next turn."}`

"The main conversation" is the root session. But the skill documents the nested shape as real and
measured — `SKILL.md:1765`:

> **Nested-context caveat (measured 2026-07-16):** when the orchestrator is itself a subagent,
> reviewers' SendMessage *replies* may not route back…

and the design doc itself argues (line 154–155) that "This skill is frequently invoked from inside a
subagent or a workflow, and every such invocation could not form a team at all."

So in the frequent case, a BLOCKED push does not reach the orchestrator that must act on it — it
lands in the user's root conversation, from an agent the user did not spawn, tagged
`from="general-purpose"` (design doc:48), with no run identifier. The doc's claim that the channel
"makes this reportable at the moment it happens" (line 120–122) is unverified for that shape and
probably false. Rule 4's state-file fallback prevents data loss but does not prevent the misdelivery,
and the doc never mentions it.

**Fix:** add a probe row for reviewer-under-nested-orchestrator → `main`, and state explicitly what
Part 2 does when the orchestrator is not `main`. If the answer is "the push is skipped", say so in
the reviewer prompt.

## P0-2 — A BLOCKED reviewer that writes a state file passes the Phase 13.5 gate, so no COMPRESSED banner fires

Part 2 rule 1 tells the blocked reviewer to "still write a state file recording BLOCKED"
(design doc:123–125). Rule 3 says the orchestrator counts a still-blocked reviewer "as a missing
reviewer under the existing `COMPRESSED RUN` machinery" (line 129–131).

That machinery does not key on "blocked". It keys on missing files. `SKILL.md:1111–1135` runs three
checks per required file: existence, ≥500 bytes, and required headers. `SKILL.md:1297–1299` emits the
COMPRESSED block only "If the Phase 13.5 verification gate detected any unrecoverable missing phase
output". A blocked reviewer that writes a schema-shaped file with an empty Findings section passes all
three checks, the gate passes, and — per `SKILL.md:1145–1146` — the banner's *absence* is the green
light. That is the exact failure the design says it is fixing.

Which way it falls is currently undefined, because the doc never specifies the BLOCKED file's format.
A terse file under 500 bytes trips the minimum-bytes check by accident; a well-formed one does not.

The edit-site table (line 138–142) lists prompt-templates Phase 3, SKILL.md Phase 3, and SKILL.md Edge
Cases. Phase 13.5 and Phase 15.1 — the two chokepoints — are not in it, so rule 3 has no
implementation site. The repo's own audit is that orchestrator-instruction-only enforcement fails:
50/51 runs skipped debate until the check was anchored at Phase 15.1 (`SKILL.md:1165–1167`,
`SKILL.md:1317–1322`).

**Fix:** specify the BLOCKED state-file marker, and amend Phase 13.5 to treat a file carrying that
marker as a gate failure, plus Phase 15.1 to include the persona in the COMPRESSED phase list.

## P1-3 — "v3.8.0's persistent-reviewer measurement" does not exist

Design doc line 26: "v3.8.0's persistent-reviewer measurement was taken on 2026-07-16, when a failed
send could still report success."

There is no such measurement. `docs/analysis/2026-07-16-panel-token-split-audit.md:3–9` states the
method: a cost split of one run executed **2026-07-02**, parsed from transcripts. Persistent
reviewers appear in that document only as a *recommendation to ship* — line 56–57: "Countermeasures
shipped as Budget Mode (v3.7.0) … 1. Orchestrator turn diet (69% driver): batched launches, persistent
reviewers via SendMessage…". A grep of that file for `reply|replies|route|routing|nested` returns
nothing.

So the audited run predates persistent reviewers; nothing about SendMessage delivery was measured. The
sentence invents a measurement in a repo whose selling point is that changes are measured. The same
problem infects the doc's use of `SKILL.md:1765`'s "(measured 2026-07-16)" label at design doc:68–72 —
that label is also unsupported by the cited audit, and the doc leans on it without checking.

**Fix:** delete the sentence, or replace it with what is true: v3.8.0 adopted persistent reviewers as
an untested inference from a cost split, and the delivery path has never been measured at all — which
strengthens, not weakens, the case for Part 1.

## P1-4 — The version-bump list omits two files that CI enforces

Design doc:200–203 lists `package.json`, `.claude-plugin/plugin.json`, `SKILL.md:22`, `SKILL.md:1664`,
`CHANGELOG.md`, `references/changelog.md`, and a `ROADMAP.md` row. Two more carry `3.8.3` and are
enforced:

- `skills/agent-review-panel/eval-suite.json:3` — checked by `scripts/release-check.sh:153`
  (`check_version_in "skills/agent-review-panel/eval-suite.json"`) and by
  `tests/manifest-consistency.test.mjs:197–201` ("marquee eval-suite version … must match plugin.json
  version").
- `.claude-plugin/marketplace.json:12` — checked by `scripts/release-check.sh:167–168` and
  `tests/manifest-consistency.test.mjs:296–300`.

The doc says "Version consistency is already covered by `tests/manifest-consistency.test.mjs`" (line
196). It is — and it will go red, because the list is short by two. Release-check is now wired into CI
(commit `e4cc236`, "anchor release-check version compares + wire release-check into CI").

This also answers the eval-suite question directly: **yes, `eval-suite.json` must change** — at minimum
its `version` field, and its `updated` field (currently `"2026-07-16"`) is the repo's convention. Whether
new `test_cases`/`edge_cases` are needed is a judgement call; `tests/eval-suite-integrity.test.mjs:203–320`
only enforces per-version coverage blocks for v2.9, v2.14 and v2.15, so nothing forces a v3.9 block — but
the pattern is one block per feature version, and a blocked-reviewer edge case is exactly what the
`edge_cases` array is for.

## P1-5 — Six new tests will break the README's test-count claim, which release-check enforces

`README.md:437` reads "The test suite (499 tests)…" and `README.md:440` repeats "499 tests". Verbatim
from `npm test` on this worktree: `ℹ tests 499 / ℹ pass 499 / ℹ fail 0`.

`scripts/release-check.sh:110–113` runs `npm test`, greps README for `[0-9]+ tests`, and fails on any
claim that does not equal the actual count. Six new assertions take it to 505 and the check fails. The
doc never mentions README.

## P1-6 — The agentId map is never updated after the fresh-spawn fallback

Traced through the phases the doc names:

- **Phase 3** — rule 1 records persona → agentId for the Phase 3 spawns. Fine.
- **Phase 4** — send to agentId `A` returns `success:false`; rule 3 triggers a fresh spawn, producing
  agent `B`. The doc says nothing about `B`'s agentId. Rule 1 is scoped to "Every Phase 3 spawn", and a
  Phase 4 fallback spawn is not a Phase 3 spawn.
- **Phase 5 round 1** — rule 2 says "Every Phase 4 / 5 / 7 SendMessage uses the raw agentId". The only
  agentId in the map is `A`, which is dead. Send fails. Fresh spawn `C`.
- **Rounds 2, 3, Phase 7** — same, every time.

The result is a silent regression to per-phase fresh spawns — precisely the behaviour v3.8.0 exists to
remove, at the cost `SKILL.md:1762` names ("a fresh spawn re-reads the work at full price"). Rule 4
explicitly declines a banner, and COMPRESSED does not fire because every phase produced its file. So the
cost regression is invisible, which is the failure mode this repo says it does not ship.

**Fix:** one sentence — "a fallback spawn's agentId replaces the dead one in the map before the next
phase."

## P1-7 — Rule 3 assumes Claude Code ≥ 2.1.222 and the doc never says so

Rule 3 (line 88–91) makes `success: false` the trigger for the whole fallback path. On any Claude Code
below 2.1.222, a failed send still reports success — that is the fix the doc itself cites (line 23). On
those installs rule 3 never fires, the reviewer silently misses the phase, its state file is never
written, and Phase 13.5 catches it only if the gate runs at all (`SKILL.md:1174–1180` says an
inline/workflow-shaped run can skip the gate entirely).

The doc applies exactly the right standard to Part 3 — "this skill is distributed publicly so it must
work where the feature is absent" (line 177) — and then does not apply it to Part 1. There is no
version floor, no detection, no note.

## P1-8 — Budget mode is absent, and Part 2's fallback conflicts with the read rules in every mode

Budget mode does not appear once in the design. Its Phase 7 is driven by SendMessage to the same
persistent agents (`SKILL.md:1839`), so Part 1 does apply there — by inheritance, since the discipline
section declares itself "Default for every mode — full panel, deep, multi-run, assessment, and budget
alike" (`SKILL.md:1750–1751`). That inheritance is probably sufficient for Part 1, and I would not
add prose for it.

Part 2 is a different matter. Rule 4 says the push is "an accelerator, not a dependency" because "the
orchestrator's existing state-file poll picks it up" (line 132–134). Detecting BLOCKED requires
*opening* a reviewer's Phase 3 file. Efficiency Discipline rule 7 forbids that: the orchestrator "opens
a state file only where a phase requires orchestrator-side work on it (Phase 6 … 12a … 14 … 14.5/15.1)"
and "never re-reads files that the next agent can read from disk itself" (`SKILL.md:1786–1790`). Budget
mode tightens it to "reads NO state file except the judge ruling and the consolidated verifier summary"
(`SKILL.md:1874–1878`). The nested-caveat poll at `SKILL.md:1768–1770` is a poll for file *existence*,
not content.

So the graceful-degradation path is inert as specified, and most inert in budget mode — where there are
only three reviewers and losing one leaves the documented minimum of two.

## P1-9 — "At the moment it happens" is undercut by the queue semantics the doc itself quotes

Design doc:40 quotes the success response verbatim: "Message queued for the main conversation's next
turn." `SKILL.md:1768–1769` instructs the orchestrator, after dispatching a wave, to "**not** end the
turn to 'wait' — poll the state directory for the expected files (sleep loop)". A message queued for the
next turn is not delivered during the current one. The push therefore arrives no earlier than the
orchestrator's own poll loop would have found the state file. The doc's central benefit claim for Part 2
(line 120–122) is not supported by its own evidence.

## P2-10 — The Phase 4/5/7 edit risks breaking an existing green test

Edit site (line 106): "SKILL.md — Phases 4, 5, 7 | Point at the addressing rule rather than restating
it." `tests/behavioral-assertions.test.mjs:1148–1167` asserts, for each of the three phase headings,
that `skillMd.slice(idx, idx + 800)` matches `/\*\*persistent reviewer agent/` **and** contains the
literal string `SendMessage`. Replacing the restatement with a pointer, or inserting text ahead of those
strings and pushing them past the 800-character window, turns a currently-passing test red. The design
does not mention it.

## P2-11 — The agentId map has no storage location

Rule 1 says "Record a persona → agentId map" (line 83) and never says where. The repo's convention is
the opposite of in-context state: `SKILL.md:2100–2103` — "every long-running multi-agent skill in the
local catalog routes intermediate outputs through disk to keep the orchestrator window small". An
in-context map is the one piece of run state that cannot survive a compaction across a ≤40-turn run
(`SKILL.md:1777`), and losing it silently converts every later phase into a fresh spawn (see P1-6). If
the answer is `state/agent_map.json`, say so — and note the rule-7 tension, since the orchestrator then
has to read it.

## P2-12 — Multi-run BLOCKED messages are unattributable

The doc handles the map collision question (line 84: "In multi-run mode the map is per-run and never
shared across runs") and that is correct — state is already namespaced under `state/run_<N>/`
(`SKILL.md:2095–2097`), and parallel runs are independent orchestrations, so the maps are naturally
disjoint. Good.

The BLOCKED message form is not. Required form is `BLOCKED — <persona name>: <what it could not reach>`
(line 128) — no run number. Meanwhile: runs "MAY execute in parallel … launching multiple run
orchestrations as parallel background agents" (`SKILL.md:1971–1972`), Run 4+ "cycle[s] through 1–3"
(`SKILL.md:1952`) so persona names repeat across runs, and the envelope reports only
`from="general-purpose"` (design doc:48). Two parallel runs, both with a Devil's Advocate, both blocked,
produce two identical messages in the same inbox. Add the run number to the required form.

## P2-13 — Two paragraphs raise a suspicion, decline to resolve it, and produce no action

Line 26–28: "That does not prove the measurement was wrong, but it does mean a silent delivery failure
was possible and invisible at the time." Line 70–72: "We are not asserting that was the cause; we are
noting it is now testable because failures are visible."

Read cold, both are hedged to the point of carrying no instruction. The second one names a test that
now exists and then never proposes running it — nothing in Tests, nothing in the edit sites. Either
propose the probe (re-run a nested panel on 2.1.226 and check whether replies now route) or cut the
paragraphs. As written they cost a paragraph each and change nothing.

## P2-14 — The edit-site tables name places, not text; there are no acceptance criteria

"Point at the addressing rule rather than restating it" (line 106) and "Note in the Phase 4/5/7
templates that these are delivered to an already-running reviewer" (line 108) do not tell an
implementer what to write. That matters more than usual here, because the proposed tests are regex
assertions against the exact wording (line 187–194) — so the test author and the prose author have to
guess the same string. The v3.1.0 and v3.8.0 test blocks this doc says it is copying assert on very
specific literals (e.g. `tests/behavioral-assertions.test.mjs:1138`,
`/\*\*Persistent reviewers\*\* — spawn each persona ONCE in Phase 3/`).

There is also no "how we know this worked" section and no rollback note.

## P2-15 — The proposed tests can only catch a missing paragraph

Answering the question directly: yes, they can fail — a missing paragraph turns them red, which is real.
No, they cannot catch a wrong implementation; they assert that SKILL.md *says* the thing, not that an
orchestrator *does* it. That is the repo's existing epistemic position and I am not asking it to change.

What is missing is the one kind of assertion that raises the bar within that position: a **negative**
one. The v3.8.0 block has one — `tests/behavioral-assertions.test.mjs:1177–1190`, "no 100-word return
protocol survives anywhere", asserting the *absence* of the superseded instruction across both SKILL.md
and prompt-templates.md. The six proposed assertions are all presence checks, so a SKILL.md that
contains the new addressing rule **and** a surviving instruction elsewhere implying persona-name
addressing passes clean. Add: no reviewer-addressing text anywhere in SKILL.md or prompt-templates.md
tells the orchestrator to address an agent by persona name or `description`.

Also absent from the test list: nothing covers the fresh-spawn map update (because the design does not
specify it — P1-6), and nothing covers Phase 13.5's handling of a BLOCKED file (because the design does
not amend it — P0-2).

## P2-16 — README's version-history table needs a v3.9 row

`README.md:528–534` carries one row per minor version, and `README.md:534` is the v3.8 row describing
the Efficiency Discipline. The documentation list (line 200–203) omits README entirely. Not
test-enforced, but the table is the repo's public feature index and v3.9 changes the discipline the v3.8
row describes.

## P2-17 — Part 3 declines agent teams for being unmeasured; Part 2 ships unmeasured

Line 160: "This repo does not ship unmeasured changes." Part 2 then ships a new runtime mechanism whose
benefit (earlier detection) is unmeasured, whose latency claim is contradicted by the doc's own probe
output (P1-9), and whose cost (an extra inbound message per blocked reviewer into the main loop — the
measured 69% driver) is unquantified. Part 1 is a specification fix and passes this bar easily. Part 2
does not, and the doc should either measure it or say plainly that it is an unmeasured accelerator with
a state-file floor.

## P3-18 — Cold-read wording

- **Undefined on first use:** "sibling mesh" (line 39), "star topology" (line 168), "the envelope"
  (lines 49, 126), "relay work" (line 159). Each needs three or four words of definition inline, or
  replacing with the plain phrase — "there is no sibling mesh" → "subagents cannot message each other".
- **Citation precision:** line 60–62 attributes the quoted sentence to `SKILL.md:1760`. Line 1760 is
  `2. **Persistent reviewers** — spawn each persona ONCE in Phase 3;`; the quoted sentence begins at
  1761. Close enough to land the reader, but this repo's culture is exact citation.
- Sections 1 and 2 are structured as the author's investigation ("What changed upstream" / "What we
  verified"). Here that is provenance a reviewer needs, so I would keep them — but the two hedged
  paragraphs called out in P2-13 are the part that is journey, not design.

---

## What the doc gets right

- Probing the tool rather than trusting the changelog, and publishing the failure modes verbatim.
- Naming the real defect precisely: not "the path is broken" but "the path is unspecified" (line 63–66).
- Declining a banner (line 92–94) and recording the declines with reversal conditions (line 166–168).
- Correctly identifying that the map must be per-run in multi-run mode.
