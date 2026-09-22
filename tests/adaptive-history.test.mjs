import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractFindingsFromMarkdown, extractHistoricalState, inferClaimType, inferPersona, severityFromHeading, verificationMethodFromText } from "../scripts/adaptive-history-extractor.mjs";
import { decideAdaptiveShadow } from "../scripts/adaptive-orchestrator.mjs";

// Resolved from this file, not the cwd, so the suite pins the real corpus wherever it runs.
const ARCHIVES = fileURLToPath(new URL("../docs/reviews", import.meta.url));
const REPLAY = fileURLToPath(new URL("../scripts/adaptive-history-replay.mjs", import.meta.url));
const README = join(ARCHIVES, "2026-05-14-readme", "state");
const PEER = join(ARCHIVES, "2026-08-10-peer-messaging-design", "state");
const PEER_ROUND2 = join(PEER, "reviewer_architecture_phase_5_round2.md");

const replay = root => spawnSync(process.execPath, [REPLAY, root], { encoding: "utf8" });
const tempRoot = () => mkdtempSync(join(tmpdir(), "arp-history-"));

function runDir(root, name, files) {
  const state = join(root, name, "state");
  mkdirSync(state, { recursive: true });
  for (const [file, body] of Object.entries(files)) writeFileSync(join(state, file), body);
  return state;
}

describe("adaptive historical state extractor", () => {
  it("infers persona from state filename", () => {
    assert.equal(inferPersona("reviewer_devils-advocate_phase_5_round1.md"), "Devils Advocate");
  });

  it("uses conservative claim types", () => {
    assert.equal(inferClaimType("P0 live IAM state is wrong"), "runtime");
    assert.equal(inferClaimType("P1 architecture trade-off"), "judgment");
    assert.equal(inferClaimType("P1 class does not exist at line 42"), "local-fact");
  });

  it("extracts finding headings without treating prose as verified truth", () => {
    const md = "# Reviewer\n## F1 [P0] Class does not exist\nI think it is missing at line 42.\n## Strengths\nFine.";
    const rows = extractFindingsFromMarkdown(md, "Correctness Hawk", "reviewer.md");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].severity, "P0");
    assert.equal(rows[0].verified, false);
  });

  it("prefers phase 3 over debate output when both exist", () => {
    const state = runDir(tempRoot(), "run", {
      "reviewer_a_phase_3.md": "## F1 [P1] Missing constant at line 4\nFinding.",
      "reviewer_a_phase_5_round1.md": "## F2 [P0] Debate-only issue\nFinding."
    });
    const x = extractHistoricalState(state);
    assert.equal(x.provenance.earliest_available_phase, "phase_3");
    assert.equal(x.findings.length, 1);
    assert.match(x.findings[0].title, /F1/);
  });

  it("falls back to round 1 for archived runs missing independent state", () => {
    const state = runDir(tempRoot(), "run", {
      "reviewer_architecture_phase_5_round1.md": "## AC-1 [P1] Architecture trade-off\nDisagree with reviewer B.",
      "reviewer_architecture_phase_5_round2.md": "## AC-1 [P1] Architecture trade-off\nStill disagree.",
      "phase_14_judge_ruling.md": "# Judge"
    });
    const x = extractHistoricalState(state);
    assert.equal(x.provenance.earliest_available_phase, "phase_5_round1");
    assert.equal(x.provenance.historical_round2_present, true);
    assert.equal(x.provenance.historical_judge_present, true);
    // A judge file present but carrying no finding headings parses to zero findings
    // downstream. The zero is reported here rather than read as "no disagreement".
    assert.equal(x.provenance.historical_judge_heading_count, 0);
    assert.equal(x.findings[0].claim_type, "judgment");
  });
});

// E3 / E4: counts are pinned against the two real archives, which is the only place
// a regression in a heading glob or a severity pattern actually shows up.
describe("real archived runs: finding extraction", () => {
  it("does not count the section heading that lists the findings", () => {
    assert.equal(extractHistoricalState(README).findings.length, 56);
    assert.equal(extractHistoricalState(PEER).findings.length, 48);
  });

  it("admits no bare section heading as a finding", () => {
    for (const state of [README, PEER]) {
      for (const f of extractHistoricalState(state).findings) {
        assert.doesNotMatch(f.title, /^(findings|\d+\.\s*(other\s+)?findings|top \d+ .*findings|least defensible finding)/i,
          `section heading admitted as a finding: ${f.title}`);
      }
    }
  });

  it("never invents a severity: every archived severity is a heading token", () => {
    for (const state of [README, PEER]) {
      for (const f of extractHistoricalState(state).findings) {
        assert.ok(["P0", "P1", "P2", "P3"].includes(f.severity), `${f.severity} for ${f.title}`);
        assert.equal(f.severity, severityFromHeading(f.title));
      }
    }
  });

  it("records severity as null when the real archive's heading carries no token", () => {
    const rows = extractFindingsFromMarkdown(readFileSync(PEER_ROUND2, "utf8"), "Architecture", "round2.md");
    const untokened = rows.filter(f => f.severity === null);
    assert.ok(untokened.length > 0, "expected at least one round-2 heading with no severity token");
    for (const f of untokened) assert.doesNotMatch(f.title, /\[P[0-3]\]|\bP[0-3]\b/);
  });

  it("reads severity from the heading only, never from the section body", () => {
    const md = "## 4. New finding — cross-session push is unmodelled\nThe P0 I am quoting here belongs to another reviewer.\n";
    assert.equal(extractFindingsFromMarkdown(md, "R", "r.md")[0].severity, null);
  });

  it("treats a plural P-token as a reference to other findings, not a severity", () => {
    assert.equal(severityFromHeading("5. Falsification check on the P0s I am keeping"), null);
    const md = "## 5. Falsification check on the P0s I am keeping\nStill keeping them.\n";
    assert.deepEqual(extractFindingsFromMarkdown(md, "R", "r.md"), []);
  });

  it("keeps a finding whose heading has no token but announces itself", () => {
    const md = "## 4. New finding — ListAgents exists and works\nProbed end to end.\n";
    const rows = extractFindingsFromMarkdown(md, "R", "r.md");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].severity, null);
  });
});

// E1: content_type and signals are recovered from what the archive states, and the run
// that states neither is recorded as unknown rather than replayed as a design review.
describe("real archived runs: recovered content type", () => {
  it("recovers documentation from the run that states its own type", () => {
    const x = extractHistoricalState(README);
    assert.equal(x.content_type, "documentation");
    assert.equal(x.provenance.content_type_source, "parsed");
    assert.equal(x.provenance.report_file, "review_panel_report.md");
    assert.deepEqual(x.signals, []);
    assert.equal(x.provenance.signals_source, "parsed");
    assert.equal(x.provenance.persona_selection_meaningful, true);
  });

  it("records the archived review mode without mapping it onto explicit_mode", () => {
    const x = extractHistoricalState(README);
    assert.equal(x.provenance.historical_review_mode, "Exhaustive");
    assert.ok(!("explicit_mode" in x), "explicit_mode must stay unasserted");
    assert.equal(decideAdaptiveShadow(x).full_escalation, false);
  });

  it("records unknown for the run whose archive states no type", () => {
    const x = extractHistoricalState(PEER);
    assert.ok(!("content_type" in x), "content_type must be absent, not defaulted");
    assert.ok(!("signals" in x), "signals must be absent, not defaulted");
    assert.equal(x.provenance.content_type_source, "unknown");
    assert.equal(x.provenance.signals_source, "unknown");
    assert.equal(x.provenance.persona_selection_meaningful, false);
    assert.match(x.provenance.persona_selection_note, /Do not read it as the panel/);
  });

  it("selects the documentation panel once content_type is recovered", () => {
    const selected = decideAdaptiveShadow(extractHistoricalState(README)).selected_personas;
    assert.deepEqual(selected, ["Clarity Editor", "Technical Accuracy", "Devils Advocate"]);
  });

  it("honours a caller-supplied content type and says it was supplied", () => {
    const x = extractHistoricalState(README, { content_type: "design" });
    assert.equal(x.content_type, "design");
    assert.equal(x.provenance.content_type_source, "provided");
  });

  it("names the file it actually read the type from", () => {
    const readme = extractHistoricalState(README).provenance;
    assert.equal(readme.content_type_source_file, "review_panel_report.md");
    assert.equal(readme.historical_review_mode_source_file, "review_panel_report.md");

    // No run-level report, so the type can only have come from the ruling in state/.
    const state = runDir(tempRoot(), "run", {
      "reviewer_a_phase_3.md": "## F1 [P1] Missing constant at line 4\nFinding.",
      "phase_14_judge_ruling.md": "# Ruling\n**Review mode:** Exhaustive (pure documentation)\n"
    });
    const p = extractHistoricalState(state).provenance;
    assert.equal(p.report_file, null);
    assert.equal(p.content_type_source, "parsed");
    assert.equal(p.content_type_source_file, "phase_14_judge_ruling.md");
  });
});

// E2: the fields that gate full escalation cannot be recovered, so the record has to
// name them and say which decisions and labels were therefore unreachable.
describe("real archived runs: unreachable decisions", () => {
  it("names every engine input the archive does not record", () => {
    // Includes each explicit floor the engine can escalate through, so a new floor
    // surfaces as an unrecoverable input instead of a quietly dead branch.
    const expected = ["high_stakes", "uncertainty_high", "explicit_mode", "user_requested_full",
      "debate_unavailable", "explicit_full_panel", "explicit_exhaustive_trace",
      "explicit_deep_research", "explicit_multi_run", "explicit_personas"];
    for (const state of [README, PEER]) {
      const { unrecoverable_inputs, unreachable_blocked_by } = extractHistoricalState(state).provenance;
      for (const field of expected) assert.ok(unrecoverable_inputs.includes(field), `${field} missing from unrecoverable_inputs`);
      for (const field of ["explicit_full_panel", "explicit_multi_run"]) {
        assert.ok(unreachable_blocked_by.includes(field), `${field} missing from unreachable_blocked_by`);
      }
    }
  });

  it("treats any one explicit floor as enough to reopen full escalation", () => {
    const p = extractHistoricalState(README, { explicit_multi_run: false, debate_unavailable: false }).provenance;
    assert.deepEqual(p.unreachable_debate_decisions, []);
  });

  // The signals leg must use the engine's own high-impact predicate, not "any signal the
  // engine recognises". `reliability` is recognised and is NOT high impact, so treating
  // recognition as enough would drop the escalation warning from a run that still cannot
  // escalate — under-warning, which is the direction this whole bundle closes.
  it("asks the engine which signals are high impact rather than which are recognised", () => {
    const reachableWith = signals => extractHistoricalState(README, { signals, uncertainty_high: true })
      .provenance.unreachable_debate_decisions.includes("ESCALATE_FULL") === false;

    assert.equal(reachableWith(["security"]), true, "a high-impact signal must reopen ESCALATE_FULL");
    assert.equal(reachableWith(["auth"]), true, "the engine's aliases must resolve");
    assert.equal(reachableWith(["reliability"]), false, "recognised but low impact must stay unreachable");
    assert.equal(reachableWith(["data"]), false, "recognised but low impact must stay unreachable");
    assert.equal(reachableWith(["documentation-authoring"]), false, "an unrecognised signal is not high impact");
    assert.equal(reachableWith([]), false, "no signals cannot reopen the branch");
  });

  it("states which debate decisions and report labels cannot fire", () => {
    for (const state of [README, PEER]) {
      const p = extractHistoricalState(state).provenance;
      assert.deepEqual(p.unreachable_debate_decisions, ["ESCALATE_FULL", "UNAVAILABLE"]);
      assert.deepEqual(p.unreachable_report_labels, ["[ESCALATED-FULL]", "[NO-DEBATE]"]);
      assert.match(p.unreachable_note, /missing input, not a measured decision not to escalate/);
    }
  });

  it("shrinks the unreachable list when the inputs are actually supplied", () => {
    const p = extractHistoricalState(README, {
      high_stakes: true, uncertainty_high: true, debate_unavailable: false,
      explicit_mode: "adaptive", user_requested_full: false
    }).provenance;
    assert.deepEqual(p.unreachable_debate_decisions, []);
    assert.deepEqual(p.unreachable_report_labels, []);
  });

  it("surfaces the unreachable decisions on the replay row itself", () => {
    const out = JSON.parse(replay(ARCHIVES).stdout);
    for (const row of out.rows) {
      assert.deepEqual(row.unreachable_debate_decisions, ["ESCALATE_FULL", "UNAVAILABLE"]);
      assert.deepEqual(row.unreachable_report_labels, ["[ESCALATED-FULL]", "[NO-DEBATE]"]);
      assert.ok(row.caveats.some(c => /not a measured decision not to escalate/.test(c)));
    }
  });
});

// E5: "judge" is this panel's own Phase 14 role name, so the substring cannot stand in
// for the concept. The order below is the deliberate part and is pinned here.
describe("claim type classification", () => {
  it("does not read the panel's own role name as a judgment claim", () => {
    assert.notEqual(inferClaimType("The judge adjudicates this at Phase 14"), "judgment");
    assert.notEqual(inferClaimType("Trust-or-Escalate then judge confidence"), "judgment");
  });

  it("still classifies the judgment concept", () => {
    assert.equal(inferClaimType("This is a judgment call"), "judgment");
    assert.equal(inferClaimType("A judgement about maintainability"), "judgment");
  });

  it("keeps judgment ahead of local-fact so the debate class cannot be emptied", () => {
    assert.equal(inferClaimType("The architecture trade-off leaves a constant missing"), "judgment");
    assert.equal(inferClaimType("Cross-file import is missing"), "cross-file");
  });

  it("pins the archived claim-type distribution", () => {
    const count = state => extractHistoricalState(state).findings
      .reduce((acc, f) => ({ ...acc, [f.claim_type]: (acc[f.claim_type] ?? 0) + 1 }), {});
    assert.deepEqual(count(README), { "local-fact": 36, judgment: 5, runtime: 3, unknown: 8, external: 3, "cross-file": 1 });
    assert.deepEqual(count(PEER), { "local-fact": 32, unknown: 13, runtime: 2, external: 1 });
  });
});

// E6: findings are not clustered across reviewers, so independent_evidence is 1 for
// every row. That has to be declared, not left looking like a corroboration count.
describe("independent evidence is declared uninformative", () => {
  it("reports one evidence source per finding as uninformative", () => {
    for (const state of [README, PEER]) {
      const x = extractHistoricalState(state);
      assert.equal(x.provenance.independent_evidence_informative, false);
      assert.match(x.provenance.independent_evidence_note, /not a count of how many reviewers/);
      const values = new Set(decideAdaptiveShadow(x).finding_decisions.map(f => f.independent_evidence));
      assert.deepEqual([...values], [1]);
    }
  });

  it("carries the declaration onto the replay row", () => {
    const out = JSON.parse(replay(ARCHIVES).stdout);
    for (const row of out.rows) {
      assert.ok(row.caveats.some(c => /independent_evidence is 1 by construction/.test(c)));
    }
  });
});

// The engine's discharge rules need a verification method. It is recovered from the
// panel's own epistemic labels, and an unstated mechanism stays "unknown" so that a
// zero resolved count is readable from the archive instead of built into the shape.
describe("verification method recovery", () => {
  it("recovers only a mechanism the archive states", () => {
    assert.equal(verificationMethodFromText("Confirmed [LIVE-VERIFIED] against the running service"), "live");
    assert.equal(verificationMethodFromText("[WEB-VERIFIED] against the vendor changelog"), "authoritative-source");
    assert.equal(verificationMethodFromText("I ran grep -rn 'foo' src/ and it is absent"), "grep");
    assert.equal(verificationMethodFromText("[STATIC-INFERENCE-CONSENSUS] all four reviewers read it the same way"), "static-inference");
  });

  it("does not treat a line citation as a record of having checked it", () => {
    assert.equal(verificationMethodFromText("The tagline at line 7 tries to do too much"), "unknown");
  });

  it("does not let a quoted probe upgrade a section that calls itself an inference", () => {
    assert.equal(verificationMethodFromText("[STATIC-INFERENCE] though grep -rn would confirm it"), "static-inference");
  });

  it("pins what the real archives support, so zero resolutions stays explainable", () => {
    const readme = extractHistoricalState(README).provenance;
    assert.deepEqual(readme.verification_method_counts, { unknown: 53, "static-inference": 3 });
    assert.equal(readme.verified_claim_count, 2);
    const peer = extractHistoricalState(PEER).provenance;
    assert.deepEqual(peer.verification_method_counts, { unknown: 46, grep: 2 });
    assert.equal(peer.verified_claim_count, 0);
  });

  it("declares that only a LIGHT floor can ever be discharged in replay", () => {
    for (const state of [README, PEER]) {
      const p = extractHistoricalState(state).provenance;
      assert.deepEqual(p.dischargeable_floors, ["LIGHT"]);
      assert.match(p.discharge_note, /never be discharged in replay/);
    }
  });

  it("emits a verification method the engine accepts for every finding", () => {
    const allowed = new Set(["grep", "read", "live", "authoritative-source", "static-inference", "unknown"]);
    for (const state of [README, PEER]) {
      for (const f of extractHistoricalState(state).findings) assert.ok(allowed.has(f.verification_method), f.verification_method);
    }
  });
});

// E10: the output is meant to be kept and shared, so no row may carry the operator's
// absolute paths. The archive root stays as one field.
describe("replay output carries no absolute archive paths", () => {
  it("records the state directory relative to the archive root", () => {
    assert.equal(extractHistoricalState(README).provenance.state_dir, "2026-05-14-readme/state");
    assert.equal(extractHistoricalState(PEER).provenance.state_dir, "2026-08-10-peer-messaging-design/state");
  });

  it("mentions the absolute root exactly once in the whole document", () => {
    const out = replay(ARCHIVES).stdout;
    // The raw path, not the quoted field: a per-row absolute path embeds the root as a
    // prefix, which a whole-field comparison would miss.
    assert.equal(out.split(JSON.parse(out).root).length - 1, 1);
  });
});

// E7 / E8 / E9: the CLI's failure shapes.
describe("replay CLI failure shapes", () => {
  it("reports a missing archive root as JSON without a stack trace", () => {
    const r = replay(join(tmpdir(), "arp-history-definitely-not-here"));
    assert.notEqual(r.status, 0);
    assert.doesNotMatch(r.stderr, /\n\s+at /, "stderr must not carry a stack trace");
    assert.equal(r.stderr.trim().split("\n").length, 1);
    const out = JSON.parse(r.stdout);
    assert.equal(out.root_status, "unavailable");
    assert.equal(out.run_count, 0);
  });

  it("distinguishes an unreadable run from an empty corpus", () => {
    const partial = tempRoot();
    runDir(partial, "2026-09-01-odd-run", {
      "phase_14_judge_ruling.md": "# Judge\n## Upheld at P1 — a real ruling\nEvidence.",
      "reviewer_a_phase_9.md": "## F1 [P0] Wrong phase name\nBody."
    });
    const skipped = JSON.parse(replay(partial).stdout);
    assert.equal(skipped.run_count, 1);
    assert.equal(skipped.replayed_count, 0);
    assert.equal(skipped.skipped_count, 1);
    assert.equal(skipped.rows[0].status, "skipped");
    assert.match(skipped.rows[0].reason, /no_reviewer_state_file_matched/);
    assert.ok(skipped.rows[0].state_files_present.includes("reviewer_a_phase_9.md"));

    const empty = JSON.parse(replay(tempRoot()).stdout);
    assert.equal(empty.run_count, 0);
    assert.equal(empty.skipped_count, 0);
    assert.notDeepEqual(skipped.rows, empty.rows);
  });

  it("emits rows in sorted run order", () => {
    const root = tempRoot();
    for (const name of ["c-run", "a-run", "b-run"]) {
      runDir(root, name, { "reviewer_a_phase_3.md": "## F1 [P1] Missing constant at line 4\nFinding." });
    }
    const rows = JSON.parse(replay(root).stdout).rows.map(r => r.run);
    assert.deepEqual(rows, ["a-run", "b-run", "c-run"]);
  });
});

describe("replay of the real corpus", () => {
  it("replays both archived runs and reports the engine's own policy version", () => {
    const out = JSON.parse(replay(ARCHIVES).stdout);
    assert.equal(out.run_count, 2);
    assert.equal(out.replayed_count, 2);
    assert.equal(out.skipped_count, 0);
    assert.deepEqual(out.rows.map(r => r.run), ["2026-05-14-readme", "2026-08-10-peer-messaging-design"]);
    assert.deepEqual(out.rows.map(r => r.extracted_finding_count), [56, 48]);
    assert.equal(out.policy_version, out.rows[0].shadow.policy_version);
  });

  it("hands the engine an input it accepts without re-guessing a field", () => {
    for (const state of [README, PEER]) {
      const decision = decideAdaptiveShadow(extractHistoricalState(state));
      assert.equal(decision.debate_decision, "DEBATE_ONE_ROUND");
      assert.equal(decision.judge_needed, true);
    }
  });

  it("counts the judge ruling headings it found", () => {
    assert.equal(extractHistoricalState(README).provenance.historical_judge_heading_count, 7);
    assert.equal(extractHistoricalState(PEER).provenance.historical_judge_heading_count, 29);
  });
});
