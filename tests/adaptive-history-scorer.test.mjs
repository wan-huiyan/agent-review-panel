import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// Namespace import on purpose: a named import this module does not export is a load-time
// error that fails every case at once, which hides which defect a red run is about.
import * as scorer from "../scripts/adaptive-history-scorer.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const reviews = join(repo, "docs", "reviews");
const compareCli = join(repo, "scripts", "adaptive-history-compare.mjs");

function runCompare(root) {
  const r = spawnSync(process.execPath, [compareCli, root], { encoding: "utf8" });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* asserted per test */ }
  return { ...r, json };
}

// One run of the real archive, shared by the cases below. These counts are the point of
// this block: before it existed, no test in this suite read docs/reviews at all, so a
// glob that reported zero findings for a whole archive passed every test.
const archive = runCompare(reviews);
const row = name => archive.json.rows.find(r => r.run === name);
const readme = () => row("2026-05-14-readme").comparison;
const peer = () => row("2026-08-10-peer-messaging-design").comparison;

describe("compare against the real archived review rounds", () => {
  it("emits one row per archived run and counts what it compared", () => {
    assert.equal(archive.status, 0);
    assert.equal(archive.json.run_count, 2);
    assert.equal(archive.json.compared_count, 2);
    assert.equal(archive.json.skipped_count, 0);
  });

  // S1: phase(state,/_phase_5_round1\.md$/) matched round-1 filenames only, so this run,
  // whose earliest snapshot is four reviewer_*_phase_3.md files, contributed nothing.
  it("reads the phase_3 run's reviewer files and names the phase it actually read", () => {
    assert.equal(readme().historical.early_phase, "phase_3");
    assert.equal(readme().historical.early_findings, 56);
    assert.equal(readme().historical.round2_present, false);
    assert.equal(readme().historical.round2_findings, 0);
  });

  // S2a: 8558 bytes of real ruling parsed to zero findings with nothing in the output
  // saying so. The figure a reader needs is headings seen against headings matched.
  it("reports judge parser coverage, so a zero is attributable to the parser", () => {
    const cov = readme().judge_parser_coverage;
    assert.equal(cov.headings_seen, 7);
    assert.equal(cov.headings_matched, 0);
    assert.equal(cov.parsed_nothing_from_a_non_empty_file, true);
    assert.ok(cov.headings_unmatched.includes("Step 8 — Action items (severity + epistemic labels)"));
  });

  // S2b: the old output asserted "No judge-carried finding was clearly first-seen in
  // round 2" for a run whose provenance records historical_round2_present: false.
  it("withholds the interpretation when there is no round 2 and no judge coverage", () => {
    assert.equal(readme().interpretation, null);
    assert.deepEqual(readme().interpretation_withheld_reasons, [
      "judge_parser_matched_no_heading_in_a_non_empty_ruling",
      "archive_has_no_round_2_to_compare"
    ]);
  });

  // S5: a source the provenance block says is present but that parsed to nothing is a
  // parser gap, not thin evidence, and the two must not share one label.
  it("names the present source that parsed to nothing and grades it unmeasurable", () => {
    assert.deepEqual(readme().parsed_empty_for_present_source, ["phase_14_judge_ruling.md"]);
    assert.equal(readme().evidence_strength, "unmeasurable_parser_returned_nothing_for_a_present_source");
    assert.equal(row("2026-05-14-readme").provenance.historical_judge_present, true);
  });

  it("pins the peer run's parsed counts", () => {
    assert.equal(peer().historical.early_phase, "phase_5_round1");
    assert.equal(peer().historical.early_findings, 48);
    assert.equal(peer().historical.round2_findings, 26);
    assert.equal(peer().historical.judge_findings, 22);
    assert.equal(peer().judge_parser_coverage.headings_seen, 29);
    assert.equal(peer().judge_parser_coverage.headings_matched, 22);
  });

  // The extractor counts the same heading shape for provenance, so a divergence here
  // means one of the two regexes drifted.
  it("counts judge headings the same way the extractor's provenance does", () => {
    for (const name of ["2026-05-14-readme", "2026-08-10-peer-messaging-design"]) {
      assert.equal(row(name).comparison.judge_parser_coverage.headings_seen,
        row(name).provenance.historical_judge_heading_count, name);
    }
  });

  // S3: 1248 title pairs, none reaching the 0.35 novelty threshold, so 26 of 26 "novel"
  // is arithmetic rather than a measurement. The output has to say which it is.
  it("reports that the novelty threshold is unreachable on this corpus", () => {
    const cov = peer().round2_novelty_coverage;
    assert.equal(cov.pair_count, 1248);
    assert.equal(cov.pairs_at_or_above_novelty_threshold, 0);
    assert.equal(cov.score_distribution.max, 0.313);
    assert.equal(cov.novelty_threshold_reachable, false);
    assert.equal(peer().historical.round2_novel_candidate_count, 26);
    assert.equal(peer().historical.round2_novel_candidate_count_is_measured, false);
  });

  // S3/S4: the lexical judge channel clears 0.12 for most findings and still sends
  // several unrelated rulings to one reviewer title, so it is reported and not used.
  it("reports the judge matcher's degeneracy and excludes it from the interpretation", () => {
    const cov = peer().judge_match_coverage;
    assert.equal(cov.matched_at_threshold, 18);
    assert.equal(cov.matched_at_novelty_threshold, 2);
    assert.ok(cov.max_judge_findings_sharing_one_best_match >= 3, `expected a collision, got ${cov.max_judge_findings_sharing_one_best_match}`);
    assert.ok(cov.distinct_best_match_titles < cov.matched_at_threshold);
    assert.equal(cov.used_for_interpretation, false);
    assert.equal(peer().historical.judge_best_match_first_seen_is_attribution, false);
    // The formula this replaced compared a 24-361 word judge body against a 6-14 word
    // reviewer title; both distributions are emitted so the change is auditable.
    assert.equal(cov.superseded_formula.matched_at_threshold, 3);
    assert.equal(cov.superseded_formula.best_score_distribution.max, 0.175);
  });

  // S5 in the other direction: the run whose matcher failed hardest used to be labelled
  // "stronger" purely because three counts were non-zero.
  it("grades the peer run from channel coverage, not from counts being non-zero", () => {
    assert.equal(peer().evidence_strength, "weak");
    assert.match(peer().evidence_strength_basis, /18 of 26/);
  });

  // The exact channel. It is the only one on this corpus that can return either answer.
  it("measures round-2 headings by the finding IDs and announcements they state", () => {
    const cite = peer().round2_finding_id_citation;
    assert.equal(cite.cites_early_finding_id, 14);
    assert.equal(cite.cites_only_unresolved_id, 4);
    assert.equal(cite.cites_no_finding_id, 8);
    assert.deepEqual(cite.unresolved_cited_ids, ["AC-13", "DA-1", "DA-10", "DA-2", "DA-9"]);
    assert.equal(peer().historical.round2_headings_announcing_a_new_finding, 4);
    assert.deepEqual(peer().interpretation_basis, ["round2_headings_announcing_a_new_finding (4 of 26)"]);
  });

  // S6: three of this ruling's headings demote a severity, and the parser used to store
  // the grade the judge rejected.
  it("records the severity a ruling imposed, not the one it overturned", () => {
    assert.equal(peer().judge_parser_coverage.severity_corrected_from_overturned, 3);
    const judge = scorer.parseJudgeRuling(readFileSync(join(reviews, "2026-08-10-peer-messaging-design", "state", "phase_14_judge_ruling.md"), "utf8"));
    const demoted = judge.findings.find(f => f.title.startsWith("Demoted from P0 to P1 — the BLOCKED"));
    assert.equal(demoted.severity, "P1");
    assert.equal(demoted.severity_overturned, "P0");
  });

  // S4: "Rulings on every disputed finding" is a ## parent whose body is 37 characters
  // because a ### begins two lines later. It used to be a judge finding, and its match
  // to a round-2 section heading was the only positive evidence in the whole bundle.
  it("does not treat the ruling's content-free parent headings as findings", () => {
    const cov = peer().judge_parser_coverage;
    for (const parent of ["Rulings on every disputed finding", "Rejected findings", "Judge-introduced findings"]) {
      assert.ok(cov.headings_unmatched.includes(parent), parent);
    }
  });
});

describe("similarity in the band the real pairs occupy", () => {
  // Every archived pair scores between 0 and 0.313. The two fixtures this replaces sat
  // at Jaccard 0 and Jaccard 1.0, so nothing exercised the band the thresholds sit in.
  const early = { title: "AC-5 [P1] Persona name is not a unique key — Run 3 spawns three Devil's Advocates", severity: "P1", phase: "round1" };
  const round2 = { title: "AC-5 (Architecture Critic): the persona → agentId map key collides *within* a run. I was wrong.", severity: null, phase: "round2" };
  const x = () => scorer.compareArchive({ earlyFindings: [early], round2Findings: [round2], judgeFindings: [], shadow: {} });

  it("scores a real round-2 reply to a round-1 finding inside 0.12 to 0.35", () => {
    const cov = x().round2_novelty_coverage;
    assert.equal(cov.score_distribution.max, 0.158);
    assert.equal(cov.pairs_at_or_above_attribution_threshold, 1);
    assert.equal(cov.pairs_at_or_above_novelty_threshold, 0);
  });

  it("does not call that reply novel on the strength of a sub-threshold score", () => {
    assert.equal(x().historical.round2_novel_candidate_count, 1);
    assert.equal(x().historical.round2_novel_candidate_count_is_measured, false);
    assert.equal(x().interpretation_basis.length, 0);
  });

  it("resolves the round-1 ID the round-2 heading names", () => {
    assert.equal(x().round2_finding_id_citation.cites_early_finding_id, 1);
    assert.deepEqual(scorer.findingIdsIn(round2.title), ["AC-5"]);
    // A bare severity grade is not a finding ID.
    assert.deepEqual(scorer.findingIdsIn("F2 [P0] — the push channel"), ["F2"]);
  });
});

describe("judge ruling parser", () => {
  it("parses judge ruling headings conservatively", () => {
    const x = scorer.parseJudgeFindings("# Judge\n### Upheld at P1 — Missing guard\nEvidence.\n### Meta\nOther.");
    assert.equal(x.length, 1); assert.equal(x[0].severity, "P1");
  });

  // S2a: the next ruling will use a different heading style, and it must not fail silently.
  it("reports zero coverage instead of staying silent when no heading matches", () => {
    const { findings, coverage } = scorer.parseJudgeRuling(
      "# Phase 14 — Supreme Judge Ruling\n\n## Step 0 — Verification review\n\nConfirmed against the repo.\n\n## Step 9 — Meta-observation\n\nNotes.\n");
    assert.equal(findings.length, 0);
    assert.equal(coverage.headings_seen, 2);
    assert.equal(coverage.headings_matched, 0);
    assert.equal(coverage.matched_fraction, 0);
    assert.equal(coverage.parsed_nothing_from_a_non_empty_file, true);
    assert.deepEqual(coverage.headings_unmatched, ["Step 0 — Verification review", "Step 9 — Meta-observation"]);
  });

  // T2: the old admission rule matched the bare word "finding", so a section listing
  // findings became one.
  it("does not admit a section heading that merely contains the word finding", () => {
    const { findings, coverage } = scorer.parseJudgeRuling("## Rejected findings\n\nA table of seven.\n\n## Judge-introduced findings\n\nNone.\n");
    assert.equal(findings.length, 0);
    assert.equal(coverage.headings_seen, 2);
  });

  // T1: a heading with no severity token used to be stored as P2, a value that reads
  // like source data. An ID-shaped heading is still a finding; its severity is unknown.
  it("records an unstated severity as null rather than inventing P2", () => {
    const { findings, coverage } = scorer.parseJudgeRuling("## A13 — Part 4 has no acceptance criteria\n\nThe section names places, not text.\n");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, null);
    assert.equal(coverage.severity_unstated, 1);
    assert.equal(coverage.severity_stated, 0);
  });

  // S6, including the plural: "the P0s I am keeping" points at other findings rather
  // than grading this heading, so it must not read as a severity either way.
  it("reads the resulting severity from a demotion or upgrade heading", () => {
    assert.deepEqual(scorer.judgeSeverityFromHeading("Demoted from P0 to P1 — the BLOCKED state file"), { severity: "P1", overturned: "P0" });
    assert.deepEqual(scorer.judgeSeverityFromHeading("Demoted from P0 to P2 — the claim is false"), { severity: "P2", overturned: "P0" });
    assert.deepEqual(scorer.judgeSeverityFromHeading("Upgraded from P2 to P0 — the silent data loss"), { severity: "P0", overturned: "P2" });
    assert.deepEqual(scorer.judgeSeverityFromHeading("Upheld at P0 — one finding"), { severity: "P0", overturned: null });
    assert.deepEqual(scorer.judgeSeverityFromHeading("Demoted from the P0s to P1 — the nested routing set"), { severity: "P1", overturned: null });
    assert.deepEqual(scorer.judgeSeverityFromHeading("Falsification check on the P0s I am keeping"), { severity: null, overturned: null });
  });
});

describe("adaptive historical comparison scorer", () => {
  it("does not read a sub-threshold pair as candidate round-2 novelty", () => {
    const x = scorer.compareArchive({
      earlyFindings: [{ title: "Missing guard", severity: "P1", phase: "round1" }],
      round2Findings: [{ title: "New routing failure", severity: "P1", phase: "round2" }],
      judgeFindings: [{ title: "Upheld P1 routing failure", severity: "P1", text: "new routing failure" }],
      shadow: { debate_decision: "DEBATE_ONE_ROUND" }
    });
    assert.equal(x.counterfactual_claim, false);
    // The count still reports, but it is flagged as unmeasured and carries no verdict.
    assert.equal(x.historical.round2_novel_candidate_count, 1);
    assert.equal(x.historical.round2_novel_candidate_count_is_measured, false);
    assert.deepEqual(x.interpretation_basis, []);
    assert.match(x.interpretation, /not a proof/);
  });

  it("reaches the positive interpretation only from a stated new finding", () => {
    const x = scorer.compareArchive({
      earlyFindings: [{ title: "AC-1 [P1] Missing guard", severity: "P1", phase: "round1" }],
      round2Findings: [{ title: "4. New finding — the fallback has no detector", severity: null, phase: "round2" }],
      judgeFindings: [{ title: "Upheld at P1 — the fallback has no detector", severity: "P1", text: "" }],
      shadow: { debate_decision: "DEBATE_ONE_ROUND" }
    });
    assert.equal(x.historical.round2_headings_announcing_a_new_finding, 1);
    assert.match(x.interpretation, /do not treat it as redundant/);
    assert.deepEqual(x.interpretation_basis, ["round2_headings_announcing_a_new_finding (1 of 1)"]);
  });

  it("does not call a quiet second round proof of redundancy", () => {
    const x = scorer.compareArchive({
      earlyFindings: [{ title: "Missing guard", severity: "P1", phase: "round1" }],
      round2Findings: [{ title: "Missing guard", severity: "P1", phase: "round2" }],
      judgeFindings: [{ title: "Missing guard", severity: "P1", text: "Missing guard" }],
      shadow: { debate_decision: "DEBATE_ONE_ROUND" }
    });
    assert.equal(x.historical.round2_novel_candidate_count, 0);
    assert.match(x.interpretation, /not a proof/);
  });

  it("reports severity changes as information candidates", () => {
    const x = scorer.compareArchive({
      earlyFindings: [{ title: "Routing issue", severity: "P0", phase: "round1" }],
      round2Findings: [{ title: "Routing issue", severity: "P1", phase: "round2" }],
      judgeFindings: [], shadow: {}
    });
    assert.equal(x.historical.round2_severity_change_candidate_count, 1);
    assert.equal(x.historical.round2_severity_indeterminate_count, 0);
  });

  // 13 of the 26 archived round-2 findings carry severity: null. A grade the archive
  // never stated has not changed; counting it as a change inflates the figure, and
  // counting it as agreement hides that nothing was compared.
  it("excludes an unstated severity from the change count and reports it separately", () => {
    const x = scorer.compareArchive({
      earlyFindings: [{ title: "Routing issue", severity: "P0", phase: "round1" }],
      round2Findings: [{ title: "Routing issue", severity: null, phase: "round2" }],
      judgeFindings: [], shadow: {}
    });
    assert.equal(x.historical.round2_severity_change_candidate_count, 0);
    assert.equal(x.historical.round2_severity_unchanged_candidate_count, 0);
    assert.equal(x.historical.round2_severity_indeterminate_count, 1);
  });

  // The engine's judge_needed is tri-state. A deferred question and an absent shadow
  // record both used to serialise as null.
  it("tells the engine's three judge_needed states apart from having no shadow record", () => {
    const state = shadow => scorer.compareArchive({ shadow });
    assert.equal(state(undefined).shadow_record_present, false);
    assert.equal(state(undefined).shadow, null);
    assert.equal(state({}).shadow.judge_needed_state, "not_recorded");
    assert.equal(state({ judge_needed: true }).shadow.judge_needed_state, "required");
    assert.equal(state({ judge_needed: false }).shadow.judge_needed_state, "not_needed");
    const deferred = state({ judge_needed: null });
    assert.equal(deferred.shadow.judge_needed_state, "deferred_pending_unresolved_work");
    assert.equal(deferred.shadow.judge_needed, null);
  });
});

describe("compare CLI on an unreadable archive root", () => {
  // S7: the directory walk sat outside the per-run try/catch, so a mistyped path printed
  // an ENOENT stack trace and left the runbook's redirected stdout file empty.
  const missing = runCompare(join(repo, "definitely-not-here"));

  it("emits the unavailable envelope on stdout and exits non-zero", () => {
    assert.notEqual(missing.status, 0);
    assert.ok(missing.json, `stdout was not JSON: ${JSON.stringify(missing.stdout)}`);
    assert.equal(missing.json.root_status, "unavailable");
    assert.equal(missing.json.error_type, "Error");
    assert.equal(missing.json.run_count, 0);
    assert.equal(missing.json.compared_count, 0);
    assert.deepEqual(missing.json.rows, []);
  });

  it("does not print a stack trace", () => {
    assert.doesNotMatch(missing.stderr, /^\s+at /m);
    assert.match(missing.stderr, /cannot read archive root/);
  });
});
