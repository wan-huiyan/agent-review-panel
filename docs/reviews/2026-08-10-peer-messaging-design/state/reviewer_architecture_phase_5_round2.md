# Architecture Critic — Phase 5, Debate Round 2

**Score: 4.5/10** (was 5/10 in round 1)

**Confidence: High** on Part 2's two structural problems; **Medium** on the severity of the
addressing-contract issues in Part 1, which are fixable with sentences rather than redesign.

---

## 1. Points of agreement — what I now accept, and what convinced me

### 1a. Probe Verifier F2 — accepted, and it supersedes my AC-2 as the primary framing

I loaded the SendMessage schema and read its description. Verbatim:

```
| `to` | |
|---|---|
| `"researcher"` | Teammate by name |
| `"main"` | The main conversation (background subagents only) |
```

That parenthetical is the tool's own contract, not an inference. And the skill spawns reviewers
without any background flag — `skills/agent-review-panel/SKILL.md:743`:

```
Launch ALL reviewer agents **in parallel** using Agent tool with `model: "opus"`.
```

I re-ran the grep myself: `grep -n "run_in_background\|background agent\|background subagent"
skills/agent-review-panel/SKILL.md` returns exactly one line, `:1972`, which is about multi-**run**
orchestrations, not reviewers.

My round-1 AC-2 attacked the nested case. F2 attacks a more basic case that bites even when the
orchestrator *is* the main conversation. Both are unrecorded gaps in the same probe row. I am merging
them: the defect is that the design doc's probe table (lines 36-41) does not record **which spawn
mode** produced row 4, so the row cannot support the rule that Part 2 builds on it. That is a
documentation-of-measurement failure, which is precisely what this repo's culture forbids.

### 1b. Probe Verifier F1 — accepted; my AC-5 partially folds into it

Also verbatim from the SendMessage description:

> Refer to agents by name — names keep working after an agent completes (a send resumes it from its
> transcript). Use the raw `agentId` (format `a...-...`) from its spawn result only when the agent
> has no name, or when a newer agent took the name (latest wins).

Part 1 rule 2 ("Address by agentId only. … Never the persona name") is the inverse of this. And
TaskStop's description, verbatim, establishes that background agents can carry names:

> - To stop a background agent spawned with a name, pass that name as task_id

So the design's premise at line 46 ("Agent-tool subagents have no human-readable name") is asserting
a negative from spawns that did not set one. My AC-5 (persona names collide, so key on the
per-instance slug) was right about the collision but reached for the wrong remedy: if a `name` can be
set at spawn, distinct per-instance names are both the tool's documented primary address AND the
collision fix, and the opaque-UUID map (AC-3) becomes unnecessary. I now think the probe F1 asks for
should gate the whole of Part 1.

### 1c. Devil's Advocate DA-1 — conclusion accepted; I re-derived it independently and it holds,
### but the corpus cannot carry "measurably false"

I re-ran the measurement with a *different* marker to avoid depending on DA-1's exact JSON shape.
First with a deliberately loose marker, to show why the loose one is worthless:

```
=== main transcripts (top-level .jsonl) ===  156
=== subagent transcripts ===                1846
=== MAIN: grep -rl 'roundtable:agent-review-panel' ===   138
=== SUB:  grep -rl 'roundtable:agent-review-panel' ===  1682
```

1682 of 1846 subagent transcripts "mention" the skill — because the available-skills listing is
injected into every session's system prompt, mine included. That marker measures nothing.

Then with a body-only marker — `Orchestrator Efficiency Discipline`, a phrase that appears in
SKILL.md's body but not in its listing description:

```
=== SUB: 'Orchestrator Efficiency Discipline' in a subagent transcript === 19
=== which projects? ===
  19 -Users-huiyan-Documents-agent-review-panel--claude-worktrees-peer-messaging-skill-adapt-1f4bd1/f7211ff9-...
```

All 19 are from **this very review session** — this panel's own reviewer subagents reading SKILL.md
to review it. Excluding the current session: zero. DA-1's zero reproduces under an independent
marker. I accept the finding.

Two caveats DA-1 should carry, though, and they matter for severity:

1. The marker conflates *invoking* the skill with *reading the file*. This session proves the
   conflation is real — 19 hits, none of them invocations.
2. The design's sentence is "invoked from inside a subagent **or a workflow**" (line 154-155). A
   workflow invocation is not a subagent transcript, so the corpus does not speak to that half at
   all.

So the design's claim is **unmeasured**, which is the finding. "Measurably false" overshoots what a
12-day single-machine corpus with a conflated marker can establish. I would run DA-1 at P1.

---

## 2. Points of disagreement — verified before contesting

### 2a. Completeness P1-3 ("invented measurement") is itself factually wrong — and it is the same
### class of error the reviewer is accusing the doc of

Completeness claims: *"No such measurement exists — the audit is a cost split of a 2026-07-02 run
that predates persistent reviewers."*

The audit file does say the run was executed 2026-07-02
(`docs/analysis/2026-07-16-panel-token-split-audit.md:3-9`) — that part is right. But the design's
sentence at line 26 does not cite the audit. There is a separate, explicitly labelled
persistent-reviewer measurement, at `CHANGELOG.md:135`, verbatim:

> **Empirically verified** (2026-07-16, full protocol on a 206-line script, 4 opus reviewers, 3
> adaptive debate rounds, HTML skipped): orchestrator **51 turns / $22 / 31% of run cost** vs the
> pre-discipline baseline's **157 turns / $111 / 69%** … Measured trade to watch: persistent
> reviewers accumulate context across rounds

That is a run of the v3.8.0 discipline *including persistent reviewers*, dated 2026-07-16. The design
doc's line 26 is correct as written.

The follow-on recommendation is wrong too. Completeness says *"stop leaning on SKILL.md:1765's
'(measured 2026-07-16)' label — the cited audit does not support it either."* The same CHANGELOG
entry supplies the provenance: *"The ≤40-turn target was missed by 11 turns, attributable to
**nested-verification harness effects** (idle/nudge cycles before the poll-loop instruction
landed)."* That is exactly what the nested-context caveat at SKILL.md:1765-1771 records.

Completeness searched one file, found nothing, and concluded the measurement was fabricated. In a
review whose stated standard is "measured, not guessed", asserting that a colleague invented a
measurement is the most expensive kind of false claim to get wrong. I would score P1-3 as a defect in
the review, not the doc, and I would not let it reach the judge unchallenged.

### 2b. Devil's Advocate DA-3 ("cut the push, keep the rule") — half right, and the half it keeps
### is the half that does not work

DA-3 is right that the transport is largely redundant: the Phase 3 return path already delivers a
≤50-word summary to the orchestrator (`SKILL.md:754-756`), so a reviewer that says "BLOCKED" in its
return has already reached the orchestrator without SendMessage. Given F2's spawn-mode problem, I
support cutting the push.

But DA-3's kept remedy is *"declare blockage in the return summary + write a BLOCKED state file"* plus
*"the orchestrator not-clean/re-dispatch rule"* — and there is no detector for either. I ran the
check:

```
$ grep -rn "BLOCKED" skills/agent-review-panel/
(no output)
```

The string does not occur anywhere in the skill. And Efficiency Discipline rule 7
(`SKILL.md:1786-1791`) plus the poll-loop instruction (`SKILL.md:1768-1771`) tell the orchestrator to
poll for **file existence**, not to read returns for content. So DA-3's remedy relies on the
orchestrator noticing prose in a return summary at a point where the skill has told it to watch the
filesystem instead. Cutting the push is only safe if paired with a real detector — which is my AC-1.

### 2c. Devil's Advocate DA-8 ("delete the name-reuse paragraph") — reject, given F1

DA-8 argues that if `pin.name` is the agentId, name collision is structurally impossible, so the
2.1.212 rationale does not apply. That reasoning inherits the doc's unprobed premise (line 46) and
inverts it. F1's TaskStop quote establishes that named background agents exist. Whether the panel's
spawns *can* be named is the open question. Deleting a paragraph on the strength of an unprobed
negative repeats the doc's own error in the opposite direction. Probe first.

### 2d. Probe Verifier F3(b) and Completeness P1-9 (the "at the moment it happens" latency claim) —
### I agree with both and have nothing to add

The doc's own quoted result says "queued for the main conversation's next turn" and SKILL.md:1768-1771
tells the orchestrator to poll inside one turn rather than end it. The claimed acceleration is
unmeasured and plausibly zero. Conceded; I did not raise it in round 1 and should have.

---

## 3. Updated assessment

**5 → 4.5.** My view hardened on Part 2 and softened slightly on Part 1.

Part 2 now has two independent structural problems rather than one. My AC-1 (no detector) is a
verified absence, not an interpretation — `grep -rn "BLOCKED" skills/agent-review-panel/` returns
nothing, and the design amends neither Phase 13.5 (`SKILL.md:1126-1134`) nor Phase 15.1
(`SKILL.md:1297-1300`). F2 adds that the push channel is documented out of scope for the spawn shape
the skill uses. Part 2 as written would add skill text describing a protection that has no detector
behind it and a transport that may not exist. That is worse than today's state, where nobody believes
the case is handled.

Part 1 I now read as *sound in direction, wrong in one rule*. Rule 2's "never the persona name" is
the inverse of the tool's documented contract and rests on an unprobed negative. But rules 1, 3 and
the edit-site work are the right shape and one probe would settle the whole thing.

The doc is not far from shippable if Part 2 is either cut to a detector-only change or held for the
probe. My 4.5 reflects that Part 2 is currently a net negative, not that the work is misconceived.

---

## 4. New finding — AC-13

**The fresh-spawn fallback silently substitutes a different agent mid-debate, and the Phase 6
CONSENSAGENT counter has no way to know. Part 1 rule 3 turns that substitution from rare into
routine — degrading the exact check that Part 3 of the same document cites as a reason to decline
agent teams.**

Nobody has raised this. The mechanics:

- The Phase 5 fallback is a *replacement agent*, not a resumed one:
  `SKILL.md:783-784` — "all sends batched in one message; fresh-spawn fallback reads the persona's
  prior state files"; `SKILL.md:761-762` — "fall back to a fresh spawn that reads that persona's
  prior `state/` files from disk"; Phase 7 the same at `SKILL.md:832`.
- The replacement has none of the in-context debate history the persistent agent accumulated.
  `CHANGELOG.md:135` names the accumulation explicitly: *"persistent reviewers accumulate context
  across rounds — reviewer-side cost share rises when debate runs the full 3 rounds."*
- Phase 6's sycophancy check counts across rounds, per persona:
  `SKILL.md:807-810` — "### Sycophancy Detection (CONSENSAGENT) / Count position changes toward
  majority. If >50% lack new evidence → inject sycophancy alert into next round prompt for all
  reviewers."
- Nothing records that a substitution happened. So when a replacement writes round R, the Phase 6
  count reads it as the *same* reviewer either changing position or holding it. Both readings are
  artifacts of the substitution, not of persuasion. With 4 reviewers over 3 rounds the denominator is
  small enough that one or two substituted personas can flip the >50% threshold in either direction —
  either firing a spurious sycophancy alert into the next round's prompts for everyone, or
  suppressing a real one.
- Part 1 rule 3 (design doc lines 88-91) makes this routine: *every* `success: false` triggers the
  fallback, on every one of the five sends per persona (Phase 4, Phase 5 rounds 1-3, Phase 7). Before
  2.1.222 a failed send could report success, so the fallback rarely fired; the whole point of rule 3
  is that it now fires whenever delivery fails.
- And the irony is load-bearing: Part 3 declines agent teams partly because *"Free-running direct
  peer messaging plausibly increases the anchoring and sycophancy that the Phase 6 CONSENSAGENT check
  exists to catch"* (design doc lines 161-163). Part 1 degrades that check's input while Part 3
  invokes its integrity as a reason to refuse a feature.

**Severity: P1.** It does not ship a false claim on its own, and it only bites when sends fail. But it
is a measurement-integrity regression in the skill's one anti-conformity control, introduced by a
change whose stated purpose is to make failures visible.

**Recommendation.** One line in rule 1 or 3: when a fallback spawn replaces a persona for a round,
append a substitution record (persona slug, round, new agentId) to the agentId state file, and one
line in Phase 6: a persona substituted during round R is excluded from that round's CONSENSAGENT
denominator. This costs two sentences and no new machinery.

---

## 5. Falsification check on the P0s I am keeping

### AC-1 — Part 2 adds a BLOCKED concept with no detector

**Single falsifying observation:** a detector for BLOCKED already exists in the skill, or the design
specifies BLOCKED-file content that Phase 13.5's required-headers check would reject.

**Cheap?** Yes — two read-only commands. **I ran both.**

- `grep -rn "BLOCKED" skills/agent-review-panel/` → no output. No detector exists anywhere in the
  skill, in SKILL.md or in prompt-templates.md.
- Design doc lines 123-125 say only "still write a state file recording BLOCKED". No filename, no
  marker text, no content spec. Phase 13.5's three checks (`SKILL.md:1126-1134`) are existence,
  ≥500 bytes, and required headers per phase; the Phase 3 required schema is at
  `references/prompt-templates.md:100-143`.

Neither falsified it. **P0 held**, with the claim tightened to the verified fact — *the design
introduces a state the skill has no detector for, and amends neither of the two gates that would
have to detect it* — rather than the round-1 framing, which predicted a specific gate outcome from
unspecified file content. See §6.

### AC-2 / F2 (merged) — the push channel's spawn mode is unrecorded and the documented scope
### excludes the skill's spawn shape

**Single falsifying observation:** one probe — spawn a *blocking* (non-background) Agent-tool
subagent, from a main session, and have it call `SendMessage(to: "main")`. If it succeeds and the
message arrives, the tool description's "(background subagents only)" is stale and Part 2's channel
is fine for the non-nested case. A second probe (orchestrator-as-subagent → reviewer → "main")
settles the nested case.

**Cheap?** Yes for the main session — two agent spawns. Not read-only, and not available to me: this
subagent has no spawn tool (`ToolSearch` over the deferred list surfaces `TaskCreate`/`TaskStop` but
no Agent/Task spawn tool).

**Why it stays P0 despite being unprobed:** the finding I am asserting is about the *document*, and
that part is fully verified. Three verbatim facts, no inference between them:

1. SendMessage's own contract: `| "main" | The main conversation (background subagents only) |`
2. `SKILL.md:743`: "Launch ALL reviewer agents **in parallel** using Agent tool with
   `model: "opus"`" — with `run_in_background` appearing nowhere in the file except `:1972`
   (multi-run orchestrations).
3. The design's probe table (lines 36-41) records the result but not the spawn mode, and the design
   builds a normative rule on it.

A design doc in this repo may not build a rule on a probe whose scope it did not record, when the
tool's own documentation scopes the channel away from the code path in question. That defect holds
regardless of how the probe comes out. **P0 held.** If the probe comes back "blocking subagents can
also reach main", the fix is a one-row addition to the table, not a redesign — so this is a cheap P0
to clear, and it should be cleared before implementation rather than argued about.

---

## 6. Shared-artifact check

**[STATIC-INFERENCE-CONSENSUS] — AC-1 and Completeness's P0-2-blocked-passes-gate.**

Completeness and I reached the same conclusion from the same lines: `SKILL.md:1126-1134` (the three
gate checks), `SKILL.md:1297-1300` (COMPRESSED gated on the gate), `SKILL.md:1145-1146` (absence of
the banner is the green light), and design doc lines 123-131 and 138-142 (the rule and its edit-site
table). Neither of us executed anything; we both read the same static text and drew the same
inference. Under Live-State Claim Discipline Rule 3 (`SKILL.md:812-819`) that agreement does not
compound to `[VERIFIED]` and must not by itself justify P0.

**How I discharged it.** I routed the shared inference to verification and replaced the interpretive
core of the claim with an executed check:

- The interpretive part — *"a BLOCKED file would pass the ≥500-byte and required-headers checks"* —
  depends on file content the design never specifies. Under the template-shaped branch it passes;
  under a terse-note branch it fails the byte check, the gate re-dispatches once
  (`SKILL.md:1136-1141`), the retry fails identically, and COMPRESSED fires with the text "Phases
  skipped: <list>" (`SKILL.md:1303`) — which has no vocabulary for a reviewer that ran but could not
  see the work. I am **not** claiming to know which branch ships.
- The verified part — `grep -rn "BLOCKED" skills/agent-review-panel/` → no output — is an executed
  observation, not an interpretation. It establishes that no detector for the new state exists, and
  that the design's edit-site table (lines 138-142) adds none.

So the P0 now rests on the executed absence plus the design's own omission, and the shared static
inference is demoted to illustrating *one* of two bad branches. Two reviewers agreeing on the branch
is not evidence for the branch.

**Also worth flagging for the judge:** F2 (Probe Verifier), DA-2 (Devil's Advocate), P0-1-nested-main-unprobed
(Completeness) and my AC-2 all converge on "Part 2's channel is unprobed in the shape that matters".
Three of the four are reasoning from the same two artifacts — the design's probe table and
`SKILL.md:1765-1770`. F2 is the exception: it introduces a genuinely independent artifact, the
SendMessage tool description's "(background subagents only)". The convergence is therefore **not**
four independent confirmations; it is one independent documentary fact (F2's) plus three readings of
the same table. Tag the cluster `[STATIC-INFERENCE-CONSENSUS]` except for F2's tool-description
quote, which I re-derived myself and confirm verbatim.
