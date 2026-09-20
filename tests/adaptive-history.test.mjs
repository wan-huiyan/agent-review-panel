import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractFindingsFromMarkdown, extractHistoricalState, inferClaimType, inferPersona } from "../scripts/adaptive-history-extractor.mjs";

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
    const root = mkdtempSync(join(tmpdir(), "arp-history-"));
    const state = join(root, "state"); mkdirSync(state);
    writeFileSync(join(state, "reviewer_a_phase_3.md"), "## F1 [P1] Missing constant at line 4\nFinding.");
    writeFileSync(join(state, "reviewer_a_phase_5_round1.md"), "## F2 [P0] Debate-only issue\nFinding.");
    const x = extractHistoricalState(state);
    assert.equal(x.provenance.earliest_available_phase, "phase_3");
    assert.equal(x.findings.length, 1);
    assert.match(x.findings[0].title, /F1/);
  });

  it("falls back to round 1 for archived runs missing independent state", () => {
    const root = mkdtempSync(join(tmpdir(), "arp-history-"));
    const state = join(root, "state"); mkdirSync(state);
    writeFileSync(join(state, "reviewer_architecture_phase_5_round1.md"), "## AC-1 [P1] Architecture trade-off\nDisagree with reviewer B.");
    writeFileSync(join(state, "reviewer_architecture_phase_5_round2.md"), "## AC-1 [P1] Architecture trade-off\nStill disagree.");
    writeFileSync(join(state, "phase_14_judge_ruling.md"), "# Judge");
    const x = extractHistoricalState(state);
    assert.equal(x.provenance.earliest_available_phase, "phase_5_round1");
    assert.equal(x.provenance.historical_round2_present, true);
    assert.equal(x.provenance.historical_judge_present, true);
    assert.equal(x.findings[0].claim_type, "judgment");
  });
});
