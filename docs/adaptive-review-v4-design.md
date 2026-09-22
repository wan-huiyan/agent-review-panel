# Agent Review Panel v4 — Adaptive evidence-driven orchestration

Status: **draft design / shadow-only proposal**  
Prepared: 2026-09-20  
Companion context-routing work:
- memory-hygiene#12 — shared registry/router/Jev provider
- agent-traffic-control#71 — workflow adapter and safeguards

## Why change the default

The current v3.9.1 full panel is deliberately thorough, but it buys expensive reasoning before
it knows whether that reasoning will change the answer. A normal full run can include 4–6 Opus
reviewers, reflection, up to 3 debate rounds, completeness audit, claim/severity verification,
targeted verification agents, an Opus judge, post-judge verification, and report generation.

### What this is not

**It is not primarily a cost argument, and the numbers matter here.**
[`docs/analysis/2026-07-16-panel-token-split-audit.md`](analysis/2026-07-16-panel-token-split-audit.md)
parsed the transcripts of one real full-protocol run ($162.01) and found the cost sits almost
nowhere near the reviewer fan-out:

| Line | Cost | Share |
|---|---|---|
| Main session (orchestrator) — 157 turns, context 270k→630k, 58.75M cache-read | $111.49 | 69% |
| Supreme Judge (ran twice) | $13.53 | 8% |
| Verification agents (P8, P10, P11 + ad-hoc) | $10.98 | 7% |
| 4 reviewers, Phases 3–7 | $11.86 | 7% |
| HTML report agent (P15.3) | $6.50 | 4% |
| P14.5 judge-output verifier | $4.77 | 3% |

That audit also splits the orchestrator's $111.49 by stretch: pre-panel baseline $15,
**Phase 3–14.5 coordination only ~$13**, **Phase 15.x report-driving ~$60**, post-panel
follow-ups ~$23.

So the phases adaptive routing can touch are the reviewer line, debate rounds inside it, the judge
and its verifier, some of the verification agents, and the ~$13 of coordination that drives them:

```
reviewers            $11.86
judge                $13.53
P14.5 verifier        $4.77
P3-14.5 coordination ~$13
                    -------
                     $43.16   = 27% of $162   (before any verification-agent share)
+ all verification   $10.98
                    -------
                     $54.14   = 33% of $162
```

Call it **roughly a quarter to a third**. The exact share depends on how much of the verification
line adaptive routing actually removes, which this design does not settle — it keeps the evidence
floors, so probably not all of it. The ~$60 Phase 15.x report-driving stretch is the single
largest item in the whole run at 37%, and nothing in this design touches it. Budget mode (v3.7)
is cheaper than a full run largely *because* it went after that line (markdown-only output,
15.2/15.3 offered post-hoc).

**That share is measured against a protocol that no longer runs.** The audited run executed
2026-07-02. v3.7.0 (budget mode) and v3.8.0 (the orchestrator turn diet, default for *every* mode)
both shipped 2026-07-16, two weeks later. `README.md` says it plainly: the turn diet "applies to
**every** mode since v3.8.0 ... so even full-protocol runs should now cost a fraction of the
audited baseline", against a ≤40-turn target where the audited run took 157. The turn diet cuts
the whole main loop, including the ~$13 of coordination that sits *inside* the addressable set, so
both the numerator and the denominator moved and **neither the current share nor its direction is
derivable from this audit.** Re-measuring a present-day full run is a prerequisite for the
evaluation below, not an optional extra.

`HOW_WE_BUILT_THIS.md` Lesson 51 states the general form: "Everyone (including this repo's own
earlier analysis) assumed the N-reviewer fan-out dominated. It was 7%." Halving the reviewer
count is a small lever, and this design should not be sold as a cost reduction.

**The real argument for v4 is evidence ordering.** Checking a cheap factual claim before sending
reviewers to argue about it is better epistemics whatever it costs, and buying a judge only when
a decision is genuinely unresolved keeps the judge's verdict meaningful. Those hold even if the
token bill is unchanged.

**The open risk runs the other way.** Adaptive routing adds orchestrator decision points — triage,
normalize, classify, verify-before-debate, re-evaluate after a debate round, escalation gate — and
Lesson 52 is "the cheapest agent is a turn the orchestrator never takes." Replacing "drive rounds
1–3" with "gate, then maybe one round" may just as plausibly remove turns. **Which way it goes is
unknown, and the evaluation below has to be able to measure it.**

Claude Workflow / Agent can now supply parallel workers natively. The enduring value of this
plugin is therefore no longer “can it spawn several reviewers?” The value is the accumulated
control logic learned from panel failures:

- consensus on one artifact is not independent verification;
- blocked/missing reviewers are not clean votes;
- stale worktrees and branch drift can make unanimous findings wrong;
- live-state claims need live evidence;
- P0/P1 claims should be falsified cheaply before escalation;
- temporal and data-flow composition bugs need explicit checks;
- debate can add value, but it can also spend heavily without changing evidence;
- judge confidence and compressed/no-debate runs need visible epistemic labels.

v4 keeps that machinery and changes **when expensive work is purchased**.

## Product shift

Old default:

```
4–6 reviewers -> reflection -> debate 1..3 -> audit -> verify -> targeted verify -> judge
```

Proposed default:

```
request
  -> deterministic triage + context gathering
  -> 2–3 materially different independent reviewers
  -> normalize findings/evidence
  -> cheap falsification / direct verification first
  -> bounded orchestration decision
       -> stop + report
       -> one targeted debate round
       -> targeted specialist verification
       -> full panel escalation
  -> judge only when a material unresolved decision remains
```

The existing full 16-phase protocol remains the explicit high-stakes / maximum-coverage path.

## Modes

### adaptive (new default candidate)

Cost emerges from uncertainty. Start with the smallest panel that can provide independent
coverage, then escalate only when evidence says another expensive call can change the result.

### full

The current v3.9.1 protocol, preserved as the compatibility and maximum-coverage path.
Explicit user requests such as “full panel”, “maximum coverage”, “run the full debate”, and
future `--full` should select this mode. No Jev decision may silently downgrade an explicit
full request.

### budget

Keep v3.9.1 budget mode during the shadow trial for comparison. Do **not** delete it in the
first v4 release. If adaptive demonstrates equal/better task success at lower cost, budget
mode can later become a compatibility alias or be deprecated with evidence.

### multi-run / exhaustive trace / deep research

Retain as explicit modifiers. Adaptive routing may recommend escalation, but explicit user
modifiers remain authoritative floors.

## Jev's role

Jev is **not a reviewer, fact checker, safety authority, or judge of truth**.

Use the same optional shared provider introduced in memory-hygiene#12. No separate Jev skill
or second transport implementation should be added here.

Both companion PRs are still open drafts as of 2026-09-21, so there is nothing to import yet.
Note the distinction: a reachable Jev endpoint is not what blocks this: the shared
registry/router/provider module is. Whichever companion PR lands first defines the interface;
this repo consumes it and does not grow a second one.

Good bounded decisions:

1. **Persona diversity**
   - candidate set generated deterministically from existing content signals + base personas;
   - choose 2–3 perspectives whose expected failure modes are materially non-overlapping;
   - never drop a user-explicit persona.

2. **Finding normalization**
   - after local deterministic clustering, score whether two compact finding summaries are
     likely the same issue;
   - only propose merges; preserve original source/evidence references.

3. **Debate gate**
   - is there a substantive disagreement after cheap evidence checks?
   - would cross-examination likely resolve a judgment/trade-off rather than a factual claim?
   - if no, emit `[DEBATE-NOT-NEEDED]`, not `[NO-DEBATE]`.

4. **Verify-vs-debate**
   - classify an unresolved point as cheaply falsifiable, cross-file/static, external/runtime,
     or judgment/trade-off;
   - deterministic capability constraints remain authoritative.

5. **Verification tier**
   - replace the default Opus Phase 12b “tier refinement advisor” with a bounded
     Light / Standard / Deep choice;
   - deterministic floors still apply: external/runtime claims cannot be Light solely because
     a model says so.

6. **Escalation / stop**
   - another reviewer?
   - one debate round?
   - targeted verification?
   - judge?
   - full panel?
   - uncertainty or unavailable Jev falls back to deterministic conservative routing.

### What Jev must never decide

- whether a vulnerability is real;
- whether code is safe to merge/deploy;
- whether a P0/P1 fact is true;
- whether live state exists;
- whether a blocked reviewer counts as agreement;
- whether mandatory verification can be skipped;
- whether an explicit `full`, `deep`, `exhaustive`, or named-persona request may be downgraded;
- whether a source can be rewritten/deleted;
- whether a report may claim `[VERIFIED]`.

## Adaptive protocol

### A0 — request / risk triage

Deterministic first. Determine content type, explicit modes/personas, codebase state, signals,
and whether the request is actually appropriate for this skill.

Suggested risk signals:

- explicit high-stakes/security/irreversible request;
- auth/security, infrastructure, payments, data loss, migration, production, compliance;
- broad cross-file/codebase change;
- live-state dependency;
- novel/external domain;
- user explicitly wants adversarial debate / maximum coverage.

Output a structured summary of the request — content type, explicit modes and personas, codebase state, risk signals. That summary is also the only input Jev should see, after the
existing outbound privacy approval rules.

Adaptive must **not** steal routine single-review work. The existing negative triggers remain.

### A1 — candidate personas

Generate candidates using current deterministic signal tables and user-explicit roles.

Select 2–3 by default:
- one correctness/architecture perspective appropriate to content;
- one domain-risk specialist when signal exists;
- one adversarial/independent perspective when the risk profile benefits.

The goal is not “highest relevance”; it is **non-overlapping failure coverage**.

If Jev is absent or uncertain, deterministic fallback uses:
- Pure code: Correctness Hawk + Architecture Critic; add Security/Domain specialist on signal.
- Plans: Feasibility/Architecture + Risk/Devil’s Advocate; add domain specialist on signal.
- Docs/assessment: Clarity/Completeness + appropriate domain/fact perspective.

### A2 — independent review

Use persistent reviewer agents exactly as today, but start with only the selected adaptive
set. Full mode still starts the existing 4–6.

Each reviewer writes state to disk and returns a short summary. Blocked-reviewer rules remain.

### A3 — normalize and evidence map

Before any debate:
- extract compact finding IDs, severity, claim type, evidence source, cited lines, confidence;
- identify same-source consensus;
- cluster likely duplicates locally;
- retain provenance from every original finding.

No cluster merge may destroy a dissenting severity/verdict or a distinct evidence source.

### A4 — verify before debate

For each P0/P1 or disputed factual claim:

1. Ask “what observation would falsify this?”
2. If cheap/read-only and allowed, run it before debate.
3. Reclassify:
   - confirmed;
   - contradicted/demoted;
   - unresolved;
   - judgment/trade-off.

This moves the current Phase 9 / parts of 10–11 earlier for the claims where evidence is cheap.

Examples:
- “safety guard is missing” -> grep/read;
- “class does not exist” -> check current branch + main;
- “live IAM is wrong” -> live describe if available, otherwise STATIC-INFERENCE;
- “architecture coupling is too high” -> not reducible to one grep; keep for discussion.

### A5 — debate gate

Debate is not mandatory in adaptive mode.

Emit one of:

- `[DEBATE-NOT-NEEDED]`: no material disagreement remains after evidence normalization;
- `[DEBATE-DEFERRED-TO-VERIFICATION]`: factual dispute is better resolved by a tool/specialist;
- `[ADAPTIVE]`: substantive judgment/trade-off remains and cross-examination can add information,
  so one debate round runs;
- `[NO-DEBATE]`: execution shape could not provide debate. This is a limitation and keeps the
  existing lower-confidence NO-DEBATE semantics.

**Only accidental/unavailable debate absence is `[NO-DEBATE]`.**
A deliberate evidence-backed stop must not be penalized as if the protocol silently failed.

Adaptive default: at most **one** debate round before re-evaluation.

A second round requires:
- unresolved material disagreement;
- genuinely new evidence or changed positions grounded in evidence;
- expected information gain above a predeclared threshold.

Three rounds remain available only in full mode or explicit user request.

### A6 — targeted verification

Re-use current Light / Standard / Deep semantics, but remove the default Opus Phase 12b advisor.

Deterministic draft tier -> optional Jev bounded refinement -> floor/ceiling policy:
- simple single-file fact may be Light;
- cross-file execution semantics at least Standard;
- external/runtime/novel domain usually Deep unless authoritative evidence is already supplied;
- security/live-state P0 cannot be downgraded below the evidence requirements in current v3.9.1.

Only unresolved points receive verification agents. Batch independent checks in parallel.

### A7 — escalation gate

After independent review + evidence checks + optional one debate + verification, choose the
smallest next step:

- report without judge if findings are verified, no material dispute remains, and no
  irreversible/high-stakes decision requires adjudication;
- judge if a material recommendation/severity/trade-off remains unresolved;
- add one specialist reviewer if coverage audit finds a real uncovered risk category;
- full panel escalation when uncertainty remains high on high-impact work, or explicit mode demands it.

A judge-less adaptive run must not pretend a “Supreme Judge verdict” exists. Use an
`Adaptive Review Outcome` section and deterministic confidence rules.

This gate overlaps issue #59 (Supreme Judge model override, plus an advisory-demotion path when a
stronger judge model is available). Whichever lands first should define the judge-invocation
contract; the other should adopt it rather than adding a second one.

### A8 — reporting

Primary report should distinguish:
- review coverage;
- what was independently reviewed;
- what was tool-verified;
- what debate was intentionally skipped;
- what remains unresolved;
- why escalation stopped.

New labels:
- `[ADAPTIVE]`
- `[DEBATE-NOT-NEEDED]`
- `[DEBATE-DEFERRED-TO-VERIFICATION]`
- `[ESCALATED-FULL]`
- existing `[NO-DEBATE]` remains only for accidental/unavailable debate
- existing `[COMPRESSED]`, `[BLOCKED]`, verification and live-state labels remain unchanged.

Do not inflate confidence just because fewer agents disagree. Coverage and evidence are separate.

## Cost accounting

Every adaptive run should record:

- reviewer calls by model;
- debate messages/rounds;
- verification-agent calls by tier/model;
- judge calls;
- Jev requests/input usage;
- wall-clock latency;
- main-agent input/output/cached tokens where host exposes them;
- whether adaptive escalated to full;
- final task outcome / owner acceptance when measurable.

Do **not** claim savings from planned call counts alone. Compare actual A/B runs.

## Evaluation design

Freeze a private, de-identified corpus of prior reviews with source revisions and owner labels.

Compare at minimum:

A. current v3.9.1 full protocol
B. current v3.9.1 budget protocol
C. adaptive deterministic only
D. adaptive + Jev

Stratify by:
- simple/routine;
- code correctness;
- security/live-state;
- architecture/trade-off;
- data/temporal;
- external-domain;
- intentionally adversarial/high-stakes.

Primary quality metrics:
- required finding recall;
- false-positive / severity-overstatement rate;
- verified P0/P1 precision;
- unresolved material disputes;
- coverage-gap rate;
- owner-rated usefulness / task success.

Efficiency:
- **orchestrator turn count**;
- **orchestrator context size at first and last turn, and cumulative cache-read tokens**;
- total model input/output/cached tokens, split orchestrator vs subagents;
- Opus vs Sonnet calls;
- Jev input usage;
- elapsed time;
- debate rounds;
- verification count;
- judge/full-escalation frequency.

The first two are not optional. The 2026-07-16 audit had to measure exactly those to find that
69% of a run sits in the main loop, and an A/B that compares only subagent tokens can show
adaptive ahead while it is behind overall, or the reverse. Reproduce them the way that audit did:
parse the main-session transcript plus every `subagents/agent-*.jsonl`, dedupe usage by message
id, and label agents from `agent-*.meta.json`.

Report efficiency against arm A's **own measured baseline**, not against the 2026-07-16 audit.
That audit describes a pre-v3.8.0 protocol (see "What this is not"), so it fixes neither the
numerator nor the denominator for a present-day run; using it as a reference would misreport the
saving by an unknown amount in an unknown direction.

Then state the saving twice: once as a share of the phases adaptive routing controls, and once as
a share of the whole run. A 20% saving on a quarter of the run is about 5% of the bill, and a
report that gives only the first number invites a reader to hear the second.

Cost regressions are failures too, not just disappointments:
- orchestrator turn count higher than the matched full/budget arm;
- total run cost higher than budget mode on the same task family.

Safety regressions are hard failures:
- manual/explicit full request silently downgraded;
- blocked reviewer treated as clean;
- P0 live-state claim without required evidence;
- half-preserved dispute;
- stale branch evidence accepted as current;
- judge-less run labeled as judge-approved;
- `[DEBATE-NOT-NEEDED]` emitted when substantive unresolved disagreement exists.

Tune Jev thresholds only on training families. Hold out entire incident/task families to avoid
paraphrase leakage.

## Shadow rollout

1. Ship no behavior change first: compute adaptive decisions beside the existing full/budget run.
2. Measure where adaptive *would* have stopped/escalated.
3. Review false-negative shadow decisions manually.
4. Enable adaptive only for explicitly opted-in runs.
5. Make adaptive default only after held-out evaluation and owner approval.
6. Preserve `--full` as a stable rollback/escalation path.

## Implementation placement

Do not create another skill.

Add an ordinary adapter/module under the existing plugin, importing the same digest-pinned
shared context-routing/Jev provider contract as companion PRs. Panel-specific bounded questions
belong in that adapter, while the authoritative review protocol remains in SKILL.md.

A future implementation PR should be split into reviewable slices:
1. structured adaptive state + deterministic gates;
2. shared-engine/Jev adapter;
3. report labels and no-debate semantic split;
4. shadow telemetry/evaluation;
5. opt-in adaptive executor;
6. only after evidence, default-mode change.

## Compatibility promise

v4 is a change in **orchestration policy**, not deletion of the accumulated review knowledge.
The current full protocol is the safety/reference implementation. If adaptive routing fails,
is unavailable, or encounters an unsupported state, the fallback is a declared deterministic
path — never a silent partial “full panel.”

