import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const evalSuite = JSON.parse(
  readFileSync(resolve(ROOT, "skills/agent-review-panel/eval-suite.json"), "utf-8")
);

// Discover SKILL.md in canonical (skills/<name>/) or legacy layouts.
function findSkillMd() {
  const candidates = [
    resolve(ROOT, "skills/agent-review-panel/SKILL.md"),
    resolve(ROOT, "plugins/agent-review-panel/skills/agent-review-panel/SKILL.md"),
    resolve(ROOT, "plugins/agent-review-panel/SKILL.md"),
    resolve(ROOT, "SKILL.md"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error("SKILL.md not found in any canonical or legacy location");
}
const skillMd = readFileSync(findSkillMd(), "utf-8");

// ---------------------------------------------------------------------------
// Assertion runner — validates output text against eval-suite assertions
// ---------------------------------------------------------------------------

/**
 * Convert an eval-suite assertion into a test function.
 * Handles Python-style (?i) inline flags by stripping them and using JS 'i' flag.
 */
function makeAssertionChecker(assertion) {
  switch (assertion.type) {
    case "pattern": {
      const cleaned = assertion.value.replace(/^\(\?i\)/, "");
      const regex = new RegExp(cleaned, "i");
      return (output) => ({
        pass: regex.test(output),
        message: `Pattern /${assertion.value}/ should match output`,
      });
    }
    case "excludes":
      return (output) => ({
        pass: !output.includes(assertion.value),
        message: `Output should NOT contain "${assertion.value}"`,
      });
    case "contains":
      return (output) => ({
        pass: output.includes(assertion.value),
        message: `Output should contain "${assertion.value}"`,
      });
    default:
      return () => ({ pass: false, message: `Unknown assertion type: ${assertion.type}` });
  }
}

/**
 * Run all assertions for a test case against sample output.
 * Returns { passed: number, failed: number, results: Array }.
 */
function runAssertions(assertions, output) {
  const results = assertions.map((assertion) => {
    const checker = makeAssertionChecker(assertion);
    const result = checker(output);
    return { ...result, assertion };
  });
  return {
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    results,
  };
}

// ---------------------------------------------------------------------------
// Phase 3: Integration test framework validation
// ---------------------------------------------------------------------------

describe("Behavioral assertion framework", () => {
  describe("Assertion checker handles all types correctly", () => {
    it("pattern assertion matches case-insensitively", () => {
      const checker = makeAssertionChecker({
        type: "pattern",
        value: "(?i)(reviewer|persona)",
      });
      assert.ok(checker("The Reviewer assigned...").pass);
      assert.ok(checker("Each persona evaluates...").pass);
      assert.ok(!checker("Nothing relevant here").pass);
    });

    it("excludes assertion rejects matching text", () => {
      const checker = makeAssertionChecker({
        type: "excludes",
        value: "I can't",
      });
      assert.ok(checker("I will review this").pass);
      assert.ok(!checker("I can't do that").pass);
    });

    it("contains assertion requires exact text", () => {
      const checker = makeAssertionChecker({
        type: "contains",
        value: "[VERIFIED]",
      });
      assert.ok(checker("This is [VERIFIED] by the judge").pass);
      assert.ok(!checker("This is verified by the judge").pass);
    });
  });

  describe("All eval-suite test_case assertions are runnable", () => {
    for (const tc of evalSuite.test_cases) {
      it(`${tc.id}: all ${tc.assertions.length} assertions create valid checkers`, () => {
        for (const assertion of tc.assertions) {
          const checker = makeAssertionChecker(assertion);
          // Verify the checker is callable and returns expected shape
          const result = checker("test input");
          assert.ok(typeof result.pass === "boolean");
          assert.ok(typeof result.message === "string");
        }
      });
    }
  });

  describe("All eval-suite edge_case assertions are runnable", () => {
    for (const ec of evalSuite.edge_cases) {
      it(`${ec.id}: all ${ec.assertions.length} assertions create valid checkers`, () => {
        for (const assertion of ec.assertions) {
          const checker = makeAssertionChecker(assertion);
          const result = checker("test input");
          assert.ok(typeof result.pass === "boolean");
          assert.ok(typeof result.message === "string");
        }
      });
    }
  });

  describe("Assertions validate against sample fixture report", () => {
    const sampleReport = readFileSync(
      resolve(__dirname, "fixtures/sample-report-valid.md"),
      "utf-8"
    );

    // tc-1: "Do a review panel on this authentication middleware"
    const tc1 = evalSuite.test_cases.find((tc) => tc.id === "tc-1");
    if (tc1) {
      it("tc-1 assertions pass against valid fixture report", () => {
        const results = runAssertions(tc1.assertions, sampleReport);
        for (const r of results.results) {
          assert.ok(
            r.pass,
            `Assertion failed: ${r.assertion.description} — ${r.message}`
          );
        }
      });
    }

    // tc-4: "Red team this payment processing module"
    const tc4 = evalSuite.test_cases.find((tc) => tc.id === "tc-4");
    if (tc4) {
      it("tc-4 'excludes' assertion passes (no refusal)", () => {
        const excludeAssertions = tc4.assertions.filter(
          (a) => a.type === "excludes"
        );
        for (const a of excludeAssertions) {
          const checker = makeAssertionChecker(a);
          assert.ok(
            checker(sampleReport).pass,
            `Valid report should not contain "${a.value}"`
          );
        }
      });
    }
  });

  describe("Assertion runner produces correct aggregate counts", () => {
    it("counts passes and failures correctly", () => {
      const assertions = [
        { type: "pattern", value: "(?i)(hello)" },
        { type: "pattern", value: "(?i)(goodbye)" },
        { type: "excludes", value: "error" },
      ];
      const results = runAssertions(assertions, "Hello world");
      assert.equal(results.passed, 2); // hello matches, no "error"
      assert.equal(results.failed, 1); // goodbye doesn't match
    });
  });
});

// ---------------------------------------------------------------------------
// Behavioral tests: validate SKILL.md promises against fixture content
// ---------------------------------------------------------------------------

describe("SKILL.md behavioral contract validation", () => {
  const validReport = readFileSync(
    resolve(__dirname, "fixtures/sample-report-valid.md"),
    "utf-8"
  );
  const lowConfReport = readFileSync(
    resolve(__dirname, "fixtures/sample-report-low-confidence.md"),
    "utf-8"
  );
  const minimalReport = readFileSync(
    resolve(__dirname, "fixtures/sample-report-minimal.md"),
    "utf-8"
  );

  describe("Reviewer output format (Phase 3 template, renumbered in v2.11)", () => {
    // Verify the fixture's detailed reviews follow the prompt template format
    it("includes Perspective header for each reviewer", () => {
      const perspectives = validReport.match(/### Perspective: .+/g);
      assert.ok(perspectives, "must have Perspective headers");
      assert.ok(perspectives.length >= 2, "must have at least 2 perspectives");
    });

    it("includes Score X/10 for each reviewer", () => {
      const scores = validReport.match(/\*\*Score: \d+\/10\*\*/g);
      assert.ok(scores, "must have scores");
      assert.ok(scores.length >= 2, "must have at least 2 scores");
    });

    it("includes Key Concern for each reviewer", () => {
      const concerns = validReport.match(/#### Key Concern/g);
      assert.ok(concerns, "must have Key Concern sections");
    });

    it("includes Verification Commands for P0/P1 findings", () => {
      assert.ok(
        validReport.includes("#### Verification Commands"),
        "P0/P1 findings should have verification commands"
      );
    });
  });

  describe("Debate format (Phase 5 template, renumbered in v2.11)", () => {
    it("includes debate round summaries", () => {
      assert.ok(
        validReport.includes("Round 1 Summary") || validReport.includes("### Round 1"),
        "must have debate round summaries"
      );
    });

    it("round summaries have Resolved/Still in dispute/New discoveries", () => {
      assert.ok(validReport.includes("Resolved"), "must have Resolved");
      assert.ok(
        validReport.includes("Still in dispute"),
        "must have Still in dispute"
      );
    });
  });

  describe("Blind Final Assessment format (Phase 7 template, renumbered in v2.11)", () => {
    it("includes Final Score", () => {
      assert.ok(
        validReport.includes("Final Score:"),
        "must have Final Score in blind assessment"
      );
    });

    it("includes Final Recommendation", () => {
      assert.ok(
        validReport.includes("Recommendation:"),
        "must have Recommendation in blind assessment"
      );
    });
  });

  describe("Completeness Audit format (Phase 8 template, renumbered in v2.11)", () => {
    it("includes New Findings section", () => {
      assert.ok(
        validReport.includes("New Findings"),
        "audit must have New Findings"
      );
    });

    it("includes Coverage Assessment", () => {
      assert.ok(
        validReport.includes("Coverage Assessment"),
        "audit must have Coverage Assessment"
      );
    });
  });

  describe("Claim Verification format (Phase 10 template, renumbered in v2.11)", () => {
    it("includes verification table", () => {
      assert.ok(
        validReport.includes("Claim") && validReport.includes("Verdict"),
        "must have claim verification table"
      );
    });

    it("uses standard verdict labels", () => {
      const verdictLabels = ["[VERIFIED]", "[INACCURATE]", "[MISATTRIBUTED]", "[HALLUCINATED]", "[UNVERIFIABLE]"];
      const hasAtLeastOne = verdictLabels.some((l) => validReport.includes(l));
      assert.ok(hasAtLeastOne, "must use standard claim verification verdicts");
    });
  });

  describe("Supreme Judge format (Phase 12 template, renumbered in v2.11)", () => {
    it("includes judge analysis in detailed reviews", () => {
      assert.ok(
        validReport.includes("Supreme Judge") || validReport.includes("Judge"),
        "must include judge analysis"
      );
    });
  });

  describe("Edge case: small file uses reduced panel", () => {
    it("minimal report uses 2 reviewers", () => {
      const match = minimalReport.match(/\*\*Panel:\*\*\s*(\d+)\s*reviewers/);
      assert.ok(match, "must state reviewer count");
      assert.equal(parseInt(match[1]), 2, "small file should use 2 reviewers");
    });
  });

  describe("Edge case: low confidence triggers human review warning", () => {
    it("low-confidence report warns about human review", () => {
      assert.ok(
        lowConfReport.includes("HUMAN REVIEW RECOMMENDED"),
        "Low confidence must trigger human review warning"
      );
    });

    it("low-confidence report explains why confidence is low", () => {
      assert.ok(
        lowConfReport.includes("insufficient evidence") ||
        lowConfReport.includes("unresolved") ||
        lowConfReport.includes("novel"),
        "Must explain reasons for low confidence"
      );
    });
  });

  describe("Edge case: plan content uses Exhaustive mode", () => {
    it("plan report uses Exhaustive review mode", () => {
      assert.ok(
        lowConfReport.includes("Exhaustive"),
        "Plan content should use Exhaustive review mode"
      );
    });

    it("plan report uses PLAN_RISK labels", () => {
      assert.ok(
        lowConfReport.includes("[PLAN_RISK]"),
        "Plan findings should use [PLAN_RISK] label"
      );
    });
  });

  describe("Edge case: code content uses Precise mode", () => {
    it("code report uses Precise review mode", () => {
      assert.ok(
        validReport.includes("Precise"),
        "Code content should use Precise review mode"
      );
    });

    it("code report uses EXISTING_DEFECT labels where appropriate", () => {
      assert.ok(
        validReport.includes("[EXISTING_DEFECT]"),
        "Code findings should use [EXISTING_DEFECT] label where applicable"
      );
    });
  });
});

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
      /≤50[- ]word summary/i,
      "Phase 3 prompt must request a ≤50-word summary in the chat return (v3.8.0)"
    );
  });

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

  it("Phase 15.3 documents COMPRESSED RUN HTML banner", () => {
    assert.match(
      skillMd,
      /## Phase 15[\s\S]+?### Phase 15\.3[\s\S]+?COMPRESSED RUN[\s\S]+?banner/i,
      "Phase 15.3 must document the red HTML banner for compressed runs"
    );
  });
});

describe("v3.2.0 post-judge verification gate (Phase 14.5)", () => {
  it("SKILL.md documents Phase 14.5 between Phase 14 and Phase 15", () => {
    assert.match(
      skillMd,
      /## Phase 14\.5: Post-Judge Verification Gate/,
      "SKILL.md must declare Phase 14.5: Post-Judge Verification Gate"
    );
    assert.match(
      skillMd,
      /Phase 14\.5: Post-Judge Verification[\s\S]+?Phase 15: Output Generation/,
      "Phase 14.5 must appear between Phase 14 and Phase 15 in SKILL.md"
    );
  });

  it("SKILL.md orchestration list includes Phase 14.5", () => {
    assert.match(
      skillMd,
      /Phase 14\.5: Post-Judge Verification[\s\S]+?judge-introduced/,
      "SKILL.md orchestration block must list Phase 14.5 with its purpose"
    );
  });

  it("SKILL.md adds [JUDGE-HALLUCINATED] to epistemic labels", () => {
    assert.match(
      skillMd,
      /Epistemic labels:[\s\S]+?\[JUDGE-HALLUCINATED\]/,
      "Epistemic-labels list in Phase 15.1 schema must include [JUDGE-HALLUCINATED]"
    );
  });

  it("SKILL.md state-file inventory mentions phase_14_5_judge_verification.md", () => {
    assert.match(
      skillMd,
      /phase_14_5_judge_verification\.md/,
      "SKILL.md state directory documentation must list phase_14_5_judge_verification.md"
    );
  });

  it("prompt-templates.md defines the Phase 14.5 agent prompt", () => {
    const promptTemplates = readFileSync(
      resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
      "utf-8"
    );
    assert.match(
      promptTemplates,
      /## Phase 14\.5: Post-Judge Verification Gate/,
      "prompt-templates.md must define a Phase 14.5 prompt block"
    );
    const phase14_5 = promptTemplates
      .split(/^## Phase 14\.5/m)[1]
      .split(/^## Phase 15\.2/m)[0];
    assert.match(
      phase14_5,
      /\[PANEL-RAISED\][\s\S]+?\[JUDGE-INTRODUCED\]/,
      "Phase 14.5 prompt must distinguish [PANEL-RAISED] from [JUDGE-INTRODUCED]"
    );
    assert.match(
      phase14_5,
      /\[JUDGE-CONFIRMED\][\s\S]+?\[JUDGE-HALLUCINATED\][\s\S]+?\[JUDGE-PARTIAL\]/,
      "Phase 14.5 prompt must define all three verdict labels"
    );
    assert.match(
      phase14_5,
      /Score Recomputation|panel mean/i,
      "Phase 14.5 prompt must mandate score recomputation against panel mean"
    );
    assert.match(
      phase14_5,
      /phase_14_5_judge_verification\.md/,
      "Phase 14.5 prompt must direct disk-write to state/phase_14_5_judge_verification.md"
    );
  });
});

describe("v3.2.0 Chart.js wrapper-div mandate (Phase 15.3)", () => {
  it("prompt-templates.md mandates wrapper-div around every <canvas>", () => {
    const promptTemplates = readFileSync(
      resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
      "utf-8"
    );
    const phase15_3 = promptTemplates.split(/^## Phase 15\.3/m)[1] || "";
    assert.match(
      phase15_3,
      /Chart\.js canvas wrapping/i,
      "Phase 15.3 spec must include a Chart.js canvas wrapping section"
    );
    assert.match(
      phase15_3,
      /position:\s*relative[\s\S]+?height:\s*\d+px/i,
      "Phase 15.3 spec must mandate position: relative + explicit pixel height on the canvas wrapper"
    );
    assert.match(
      phase15_3,
      /infinite[\s\S]+?growth|grows? .*on every layout/i,
      "Phase 15.3 spec must explain WHY (infinite growth) so future edits don't drop the wrapper"
    );
  });

  it("SKILL.md surfaces the Chart.js mandate in its Phase 15.3 section", () => {
    assert.match(
      skillMd,
      /Chart\.js wrapper-div mandate/i,
      "SKILL.md must reference the Chart.js wrapper-div mandate"
    );
    assert.match(
      skillMd,
      /position:\s*relative[\s\S]{0,80}?height:\s*\d+px/i,
      "SKILL.md mandate must show the position: relative + explicit pixel height pattern"
    );
  });
});

describe("v3.3.0 Live-State Claim Discipline (#40)", () => {
  const promptTemplates = readFileSync(
    resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
    "utf-8"
  );
  const signals = readFileSync(
    resolve(ROOT, "skills/agent-review-panel/references/signals-and-checklists.md"),
    "utf-8"
  );

  it("SKILL.md declares the Live-State Claim Discipline section", () => {
    assert.match(
      skillMd,
      /## Live-State Claim Discipline \(v3\.3\.0\)/,
      "SKILL.md must declare a Live-State Claim Discipline section"
    );
  });

  it("SKILL.md documents all four discipline rules", () => {
    const section = skillMd
      .split(/## Live-State Claim Discipline/)[1]
      .split(/\n## Phase 2/)[0];
    assert.match(section, /Rule 1 — Declarative vs\. imperative vs\. documentation/);
    assert.match(section, /Rule 2 — Live-state claims need live evidence/);
    assert.match(section, /Rule 3 — Consensus does not compound on a shared artifact/);
    assert.match(section, /Rule 4 — Pre-promotion falsification check/);
  });

  it("SKILL.md adds the three new epistemic labels to the Phase 15.1 list", () => {
    assert.match(
      skillMd,
      /Epistemic labels:[\s\S]*?\[LIVE-VERIFIED\][\s\S]*?\[STATIC-INFERENCE\][\s\S]*?\[STATIC-INFERENCE-CONSENSUS\]/,
      "Phase 15.1 epistemic-labels list must include the three v3.3.0 labels"
    );
  });

  it("SKILL.md wires the discipline into Phases 3, 5, 6, 11, and 14", () => {
    const sectionAfter = (heading) =>
      skillMd.split(new RegExp(`^${heading}`, "m"))[1]?.split(/^#{2,3} /m)[0] ?? "";

    // Phase 3 reviewer launch references the discipline
    assert.match(
      sectionAfter("## Phase 3: Independent Review"),
      /Live-State Claim Discipline/,
      "Phase 3 section must reference the Live-State Claim Discipline"
    );
    // Phase 5 carries the pre-promotion falsification check
    assert.match(
      sectionAfter("## Phase 5: Debate"),
      /[Pp]re-promotion falsification check/,
      "Phase 5 section must carry the pre-promotion falsification check"
    );
    // Phase 6 Sycophancy Detection flags shared-artifact consensus
    assert.match(
      sectionAfter("### Sycophancy Detection"),
      /STATIC-INFERENCE-CONSENSUS/,
      "Phase 6 Sycophancy Detection must flag shared-artifact consensus"
    );
    // Phase 11 caps static-inference live-state claims at P1
    assert.match(
      sectionAfter("## Phase 11: Severity Verification"),
      /Live-state claim classification[\s\S]*?capped at \*\*P1\*\*/,
      "Phase 11 section must classify live-state claims and cap them at P1"
    );
    // Phase 14 judge severity dampening references the discipline
    assert.match(
      sectionAfter("## Phase 14: Supreme Judge"),
      /Live-State Claim Discipline[\s\S]*?STATIC-INFERENCE/,
      "Phase 14 judge section must reference the discipline and [STATIC-INFERENCE]"
    );
  });

  it("prompt-templates.md carries the discipline in the Phase 3 reviewer prompt", () => {
    assert.match(
      promptTemplates,
      /## Live-State Claim Discipline \(v3\.3\.0\)/,
      "Phase 3 prompt must include a Live-State Claim Discipline block"
    );
    assert.match(
      promptTemplates,
      /\[LIVE-VERIFIED\][\s\S]{0,400}?\[STATIC-INFERENCE\]/,
      "Phase 3 prompt must define [LIVE-VERIFIED] and [STATIC-INFERENCE] tags"
    );
  });

  it("prompt-templates.md adds the falsification check to the Phase 5 debate prompt", () => {
    const phase5 = promptTemplates
      .split(/^## Phase 5: Debate Round Prompt/m)[1]
      .split(/^## Phase 7/m)[0];
    assert.match(
      phase5,
      /[Ff]alsification check/,
      "Phase 5 prompt must add a falsification check task"
    );
    assert.match(
      phase5,
      /STATIC-INFERENCE-CONSENSUS/,
      "Phase 5 prompt must flag shared-artifact consensus"
    );
  });

  it("prompt-templates.md adds live-state classification to the Phase 11 prompt", () => {
    const phase11 = promptTemplates
      .split(/^## Phase 11: Severity Verification Prompt/m)[1]
      .split(/^## Phase 12a/m)[0];
    assert.match(
      phase11,
      /Live-state claim classification/,
      "Phase 11 prompt must classify live-state claims"
    );
    assert.match(
      phase11,
      /capped at \*\*P1\*\*|capped at P1/,
      "Phase 11 prompt must cap [STATIC-INFERENCE] live-state claims at P1"
    );
  });

  it("prompt-templates.md wires the discipline into the Phase 14 judge prompt", () => {
    const phase14 = promptTemplates
      .split(/^## Phase 14: Supreme Judge Prompt/m)[1]
      .split(/^## Sycophancy Alert Injection/m)[0];
    assert.match(
      phase14,
      /Live-State Claim Discipline/,
      "Phase 14 judge severity dampening must reference the discipline"
    );
    assert.match(
      phase14,
      /\[LIVE-VERIFIED\][\s\S]*?\[STATIC-INFERENCE\][\s\S]*?\[STATIC-INFERENCE-CONSENSUS\]/,
      "Phase 14 judge classification step must list the three new labels"
    );
  });

  it("signals-and-checklists.md documents a Live-State Claims checklist", () => {
    assert.match(
      signals,
      /### Live-State Claims \(v3\.3\.0/,
      "signals-and-checklists.md must include a Live-State Claims checklist"
    );
  });

  it("eval-suite includes the v3.3.0 deploy-script-echo test case", () => {
    const tc = evalSuite.test_cases.find((t) => t.id === "tc-v33-1");
    assert.ok(tc, "eval-suite must include test case tc-v33-1");
    assert.ok(
      tc.assertions.length >= 3,
      "tc-v33-1 must have at least 3 assertions"
    );
  });
});

describe("v3.5.0 loud debate-skip ([NO-DEBATE])", () => {
  it("Phase 13.5 documents the panel-level debate-presence assertion", () => {
    assert.match(
      skillMd,
      /## Phase 13\.5[\s\S]+?Debate-presence assertion[\s\S]+?reviewer_\*_phase_5_round1\.md/i,
      "Phase 13.5 must count reviewer_*_phase_5_round1.md files panel-wide"
    );
    assert.match(
      skillMd,
      /## Phase 13\.5[\s\S]+?NO-DEBATE[\s\S]+?do not proceed to phase 14 silently/i,
      "Phase 13.5 must forbid proceeding to the judge silently when debate is absent"
    );
  });

  it("Phase 15.1 anchors NO-DEBATE detection at the report-write chokepoint", () => {
    // The load-bearing fix: detection must NOT live only in Phase 13.5
    // (which doesn't fire on inline/workflow shapes). Phase 15.1 re-checks.
    assert.match(
      skillMd,
      /No-debate warning \(v3\.5\.0\)[\s\S]+?independently check whether any `reviewer_\*_phase_5_round1\.md`/i,
      "Phase 15.1 must independently re-check for Phase-5 state files at report-write time"
    );
    assert.match(
      skillMd,
      /No-debate warning[\s\S]+?terminal step every completed run passes through/i,
      "Phase 15.1 must justify itself as the terminal chokepoint anchoring detection"
    );
  });

  it("Phase 15.1 defines the [NO-DEBATE] markdown banner and action-item suffix", () => {
    assert.match(
      skillMd,
      /⚠️ \*\*\[NO-DEBATE\] — adversarial debate \(Phase 5\) did not run\.\*\*/,
      "SKILL.md must define the [NO-DEBATE] markdown banner block"
    );
    assert.match(
      skillMd,
      /`\[NO-DEBATE\]` appended to its epistemic label/i,
      "SKILL.md must require the [NO-DEBATE] suffix on every action item"
    );
  });

  it("Phase 15.1 caps no-debate confidence at Medium (testable wiring)", () => {
    assert.match(
      skillMd,
      /`\*\*Confidence:\*\*` header field MUST be capped at \*\*Medium\*\*/,
      "SKILL.md must wire the confidence cap to the actual Confidence header field"
    );
    assert.match(
      skillMd,
      /no-debate\s+run can never report High confidence/i,
      "SKILL.md must state a no-debate run can never report High confidence"
    );
  });

  it("documents the COMPRESSED / NO-DEBATE stacking interaction explicitly", () => {
    assert.match(
      skillMd,
      /Banner stacking[\s\S]+?COMPRESSED[\s\S]+?NO-DEBATE[\s\S]+?stack/i,
      "SKILL.md must explicitly resolve the COMPRESSED/NO-DEBATE overlap (banners stack)"
    );
  });

  it("Phase 15.3 documents the [NO-DEBATE] HTML banner (SKILL.md)", () => {
    assert.match(
      skillMd,
      /No-debate banner \(v3\.5\.0\)[\s\S]+?amber[\s\S]+?\[NO-DEBATE\]/i,
      "Phase 15.3 must document the amber [NO-DEBATE] HTML banner"
    );
  });

  it("prompt-templates.md Phase 15.3 INSTRUCTS the HTML agent to render the run-integrity banners", () => {
    // The HTML agent reads prompt-templates.md, NOT SKILL.md — so the
    // banner-rendering instruction must live HERE to actually fire.
    // Mirrors the v3.2.0 Chart.js phase15_3 gold-standard test.
    const promptTemplates = readFileSync(
      resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
      "utf-8"
    );
    const phase15_3 = promptTemplates.split(/^## Phase 15\.3/m)[1] || "";
    assert.match(
      phase15_3,
      /Run-Integrity Banners/i,
      "Phase 15.3 prompt must include a Run-Integrity Banners instruction"
    );
    assert.match(
      phase15_3,
      /role="alert"/,
      "Phase 15.3 prompt must instruct an alert div for the banners"
    );
    assert.match(
      phase15_3,
      /\[NO-DEBATE\][\s\S]+?amber/i,
      "Phase 15.3 prompt must instruct the amber [NO-DEBATE] banner specifically"
    );
    assert.match(
      phase15_3,
      /COMPRESSED RUN[\s\S]+?red/i,
      "Phase 15.3 prompt must also cover the red COMPRESSED banner (same machinery)"
    );
    assert.match(
      phase15_3,
      /NO-DEBATE first[\s\S]+?COMPRESSED/i,
      "Phase 15.3 prompt must define the stacking order when both banners apply"
    );
  });

  it("documents the review-mode spectrum (full-debate vs streamlined)", () => {
    assert.match(
      skillMd,
      /## Review-Mode Spectrum & Debate-in-Workflow \(v3\.5\.0\)/,
      "SKILL.md must contain a Review-Mode Spectrum section"
    );
    assert.match(
      skillMd,
      /parallel-panel-streamlined-no-debate[\s\S]+?full panel/i,
      "Review-Mode Spectrum must contrast the streamlined panel with the full-debate panel"
    );
  });

  it("documents the debate-in-Workflow recipe for ultracode runs", () => {
    assert.match(
      skillMd,
      /Debate-in-Workflow recipe/i,
      "SKILL.md must contain a debate-in-Workflow recipe"
    );
    assert.match(
      skillMd,
      /Debate-in-Workflow recipe[\s\S]+?round-1[\s\S]+?peers['’][\s\S]+?judge/i,
      "the recipe must describe round 1 → peers-injected round 2 → judge"
    );
  });

  it("the [NO-DEBATE] fixture parses and is detected by the report parser", () => {
    const fixture = readFileSync(
      resolve(ROOT, "tests/fixtures/sample-report-no-debate.md"),
      "utf-8"
    );
    assert.match(
      fixture,
      /^>\s*⚠️\s*\*\*\[NO-DEBATE\]/m,
      "the no-debate fixture must carry the [NO-DEBATE] banner as its first block"
    );
    assert.match(
      fixture,
      /\*\*Confidence:\*\*\s*Medium/,
      "the no-debate fixture must demonstrate the Medium-confidence cap"
    );
  });
});

describe("v3.7.0 budget mode", () => {
  const promptTemplates = readFileSync(
    resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
    "utf-8"
  );

  it("budget mode is explicit opt-in, never auto-selected", () => {
    assert.match(
      skillMd,
      /## Budget Mode \(v3\.7\.0\)[\s\S]{0,300}Explicit opt-in only — never auto-selected/,
      "SKILL.md must declare budget mode as explicit opt-in"
    );
  });

  it("frontmatter description carries the budget-mode trigger phrases", () => {
    const frontmatter = skillMd.slice(0, skillMd.indexOf("\n---", 4));
    for (const phrase of ['"budget', 'review"', '"cheap review"']) {
      assert.ok(
        frontmatter.includes(phrase),
        `frontmatter must include trigger phrase ${phrase}`
      );
    }
  });

  it("budget mode uses 3 sonnet reviewers and keeps the judge on opus", () => {
    const budget = skillMd.slice(skillMd.indexOf("## Budget Mode (v3.7.0)"));
    assert.match(
      budget,
      /\*\*Exactly 3 reviewers\*\*[\s\S]{0,200}`model: "sonnet"` explicit/,
      "budget mode must pin exactly 3 reviewers on explicit sonnet"
    );
    assert.match(
      budget,
      /\*\*`model: "opus"`, exactly one pass\*\*/,
      "budget mode must keep the Supreme Judge on opus, single pass"
    );
    assert.match(
      budget,
      /The judge is opus, domain-neutral, and singular|never downgraded to sonnet/,
      "budget mode must state the judge is never downgraded"
    );
  });

  it("Phases 8+10+11 collapse into ONE consolidated verifier", () => {
    assert.match(
      skillMd,
      /\*\*ONE consolidated verifier\*\*[\s\S]{0,300}phase_8_10_11_verification\.md/,
      "SKILL.md must define the consolidated verification agent + its state file"
    );
    assert.match(
      promptTemplates,
      /## Budget Mode: Consolidated Verification Prompt \(Phases 8\+10\+11, v3\.7\.0\)/,
      "prompt-templates.md must carry the consolidated verifier prompt template"
    );
  });

  it("budget mode runs exactly one debate round so NO-DEBATE stays honest", () => {
    assert.match(
      skillMd,
      /\*\*Exactly 1 round\*\*[\s\S]{0,200}reviewer_<name>_phase_5_round1\.md/,
      "budget mode must run a single real debate round with round-1 state files"
    );
    assert.match(
      skillMd,
      /must never trip the `\[NO-DEBATE\]` banner\s+unless the round genuinely failed/,
      "budget mode must document the NO-DEBATE interaction"
    );
  });

  it("defines the [BUDGET-MODE] banner and its stacking order", () => {
    assert.match(
      skillMd,
      /> 💸 \*\*\[BUDGET-MODE\] — reduced-cost protocol\.\*\*/,
      "SKILL.md must define the [BUDGET-MODE] markdown banner block"
    );
    assert.match(
      skillMd,
      /`\[NO-DEBATE\]` first[\s\S]{0,80}`COMPRESSED RUN`[\s\S]{0,80}`\[BUDGET-MODE\]`/,
      "SKILL.md must define the three-banner stacking order"
    );
    assert.match(
      promptTemplates,
      /\[BUDGET-MODE\][\s\S]{0,200}blue\*\* banner/,
      "prompt-templates.md must define the blue HTML banner for post-hoc HTML reports"
    );
  });

  it("Phase 14.5 downgrades to an orchestrator check in budget mode (no agent)", () => {
    assert.match(
      skillMd,
      /\*\*Budget mode \(v3\.7\.0\):\*\* no agent is spawned\.[\s\S]{0,400}\[JUDGE-UNVERIFIED\]/,
      "Phase 14.5 must keep judge-hallucination protection without an agent spawn"
    );
  });

  it("targets the measured cost drivers: orchestrator turn diet", () => {
    assert.match(
      skillMd,
      /### Orchestrator turn diet \(targets the measured 69%\)/,
      "budget mode must carry the orchestrator turn-diet section"
    );
    assert.match(
      skillMd,
      /Turn budget ≤25/,
      "turn diet must set the ≤25 orchestrator-turn target"
    );
    assert.match(
      skillMd,
      /\*\*Fresh-session recommendation\*\*/,
      "fresh-session guidance must exist (global efficiency discipline since v3.8.0)"
    );
  });

  it("markdown-only output: 15.2/15.3 deferred, not lost", () => {
    assert.match(
      skillMd,
      /\*\*15\.1 markdown only\.\*\* Offer 15\.2\/15\.3 as a follow-up/,
      "budget mode must produce 15.1 only and offer the rest post-hoc"
    );
  });

  it("declares incompatibilities: multi-run, deep research, assessment mode", () => {
    const budget = skillMd.slice(skillMd.indexOf("## Budget Mode (v3.7.0)"));
    assert.match(budget, /\*\*Multi-run \(`--runs N > 1`\)\*\*: refuse/);
    assert.match(budget, /\*\*Deep research mode\*\*: if both are requested, budget wins/);
    assert.match(budget, /\*\*Assessment mode \(v3\.6\.0\)\*\*: incompatible/);
  });

  it("the explicit-model rule survives: budget mode never omits model:", () => {
    assert.match(
      skillMd,
      /Budget mode never omits `model:`/,
      "budget mode must preserve the v2.14 anti-fallthrough rule"
    );
    assert.match(
      skillMd,
      /\*\*Explicit model, always \(v2\.14, amended v3\.7\.0\):\*\*/,
      "the Implementation Notes force-opus rule must be reworded to explicit-model"
    );
  });

  it("the [BUDGET-MODE] fixture carries the banner and Medium confidence", () => {
    const fixture = readFileSync(
      resolve(ROOT, "tests/fixtures/sample-report-budget-mode.md"),
      "utf-8"
    );
    assert.match(
      fixture,
      /^>\s*💸\s*\*\*\[BUDGET-MODE\]/m,
      "the budget-mode fixture must carry the banner as its first block"
    );
    assert.match(
      fixture,
      /\*\*Confidence:\*\*\s*Medium/,
      "the budget-mode fixture must demonstrate the Medium-confidence cap"
    );
  });
});

// Export utilities for other test files
export { makeAssertionChecker, runAssertions };

describe("v3.8.0 orchestrator efficiency discipline", () => {
  const promptTemplates38 = readFileSync(
    resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
    "utf-8"
  );
  const discipline = skillMd.slice(
    skillMd.indexOf("## Orchestrator Efficiency Discipline (v3.8.0 — all modes)")
  );

  it("SKILL.md has the efficiency-discipline section and declares it default for every mode", () => {
    assert.ok(
      skillMd.includes("## Orchestrator Efficiency Discipline (v3.8.0 — all modes)"),
      "efficiency-discipline section must exist"
    );
    assert.match(
      discipline,
      /\*\*Default for every mode — full panel, deep, multi-run, assessment, and\s*\nbudget alike\.\*\*/,
      "section must declare itself the default for all modes"
    );
  });

  it("mandates persistent reviewers with a fresh-spawn fallback", () => {
    assert.match(
      discipline,
      /\*\*Persistent reviewers\*\* — spawn each persona ONCE in Phase 3/,
      "persistent-reviewer rule must exist"
    );
    assert.match(
      discipline,
      /Fallback: if SendMessage fails or is unavailable, fresh-spawn/,
      "fresh-spawn fallback must be documented"
    );
  });

  it("Phases 4, 5, and 7 drive persistent reviewers via SendMessage", () => {
    for (const anchor of [
      "## Phase 4: Private Reflection",
      "## Phase 5: Debate (Rounds 1-3, adaptive)",
      "## Phase 7: Blind Final Assessment",
    ]) {
      const idx = skillMd.indexOf(anchor);
      assert.ok(idx >= 0, `${anchor} must exist`);
      const section = skillMd.slice(idx, idx + 800);
      assert.match(
        section,
        /\*\*persistent reviewer agent/,
        `${anchor} must drive persistent reviewer agents`
      );
      assert.ok(
        section.includes("SendMessage"),
        `${anchor} must mention SendMessage`
      );
    }
  });

  it("sets a ≤40-turn full-panel target against the measured 157-turn baseline", () => {
    assert.match(
      discipline,
      /\*\*≤40 orchestrator turns\*\*[\s\S]{0,120}157/,
      "≤40-turn target with 157 baseline must be stated"
    );
  });

  it("no 100-word return protocol survives anywhere (tightened to ≤50 words)", () => {
    assert.ok(
      !skillMd.includes("100-word"),
      "SKILL.md must not still promise 100-word summaries"
    );
    assert.ok(
      !promptTemplates38.includes("100-word"),
      "prompt-templates.md must not still promise 100-word summaries"
    );
    assert.ok(
      promptTemplates38.includes("≤50-word summary"),
      "prompt-templates.md must carry the ≤50-word return protocol"
    );
  });

  it("forbids inter-phase narration", () => {
    assert.match(
      discipline,
      /\*\*No inter-phase narration\*\* — at most one line per phase transition/,
      "no-narration rule must exist"
    );
  });

  it("recommends a fresh session when prior context is heavy", () => {
    assert.match(
      discipline,
      /\*\*Fresh-session recommendation\*\*[\s\S]{0,300}270k-token baseline/,
      "fresh-session rule with the measured 270k baseline must exist"
    );
  });

  it("budget mode's turn-diet section defers to the global discipline and keeps ≤25 turns", () => {
    const diet = skillMd.slice(
      skillMd.indexOf("### Orchestrator turn diet (targets the measured 69%)")
    );
    assert.match(
      diet,
      /Since v3\.8\.0 the turn diet is NOT budget-specific/,
      "budget turn diet must reference the global discipline"
    );
    assert.match(
      diet,
      /\*\*Turn budget ≤25\*\*/,
      "budget mode must keep the stricter ≤25-turn target"
    );
  });
});

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

  it("the Edge Cases entry points at Phase 3 instead of restating the rule", () => {
    const idx = skillMd.indexOf("- **Reviewer cannot see the work under review");
    assert.ok(idx >= 0, "the blocked-reviewer edge case must exist");
    const entry = skillMd.slice(idx, skillMd.indexOf("\n", idx));
    assert.match(
      entry,
      /\*\*Blocked reviewers\*\* in Phase 3/,
      "the edge case must defer to the single Phase 3 statement of the rule"
    );
    assert.ok(
      !/COMPRESSED RUN/.test(entry),
      "the edge case must not re-state the Phase 3 handling (duplication)"
    );
  });
});

describe("v3.9.0 a blocked reviewer stops voting, and BLOCKED has two anchors", () => {
  it("Phase 3 drops a still-blocked reviewer from the persistent-reviewer set", () => {
    const idx = skillMd.indexOf("**Blocked reviewers (v3.9.0).**");
    assert.ok(idx >= 0, "the Phase 3 blocked-reviewers paragraph must exist");
    const para = skillMd.slice(idx, idx + 1200);
    assert.match(
      para,
      /drop it from the\s+persistent-reviewer set/,
      "a still-blocked reviewer must leave the persistent-reviewer set"
    );
    assert.match(
      para,
      /persona → agentId map/,
      "dropping it must be concrete: remove it from the persona → agentId map"
    );
    assert.match(
      para,
      /no Phase 4, 5 or 7 prompt/,
      "a dropped reviewer must receive no further phase prompts, so it never votes"
    );
  });

  it("Phase 13.5 re-dispatch is BLOCKED-aware and stays unrecoverable on success", () => {
    const start = skillMd.indexOf("**On gate failure for any file:**");
    assert.ok(start >= 0, "the Phase 13.5 gate-failure list must exist");
    const section = skillMd.slice(start, start + 1600);
    assert.match(
      section,
      /`reviewer_<slug>_BLOCKED\.md` exists for that persona/,
      "the re-dispatch step must branch on an existing BLOCKED file"
    );
    assert.match(
      section,
      /re-dispatch MUST\s+supply explicit materialized paths/,
      "a BLOCKED re-dispatch must carry explicit materialized paths"
    );
    assert.match(
      section,
      /unrecoverable\s+for banner purposes \*\*even if the retry succeeds\*\*/,
      "a late successful retry must not buy a green light"
    );
    assert.match(
      section,
      /green light\) — unless step 2 found a\s+`reviewer_\*_BLOCKED\.md`/,
      "a passing gate must still force the COMPRESSED header when a BLOCKED file was found"
    );
  });

  it("Phase 15.1 second-anchors BLOCKED by globbing the state directory", () => {
    const start = skillMd.indexOf("**No-debate warning (v3.5.0)");
    assert.ok(start >= 0, "the Phase 15.1 no-debate check must exist");
    const section = skillMd.slice(start, start + 1400);
    assert.match(
      section,
      /in the same pass, whether any `reviewer_\*_BLOCKED\.md` exists there/,
      "Phase 15.1 must glob for BLOCKED files alongside the round-1 files"
    );
    assert.match(
      section,
      /BLOCKED file forces the COMPRESSED RUN block/,
      "a BLOCKED file found at Phase 15.1 must emit the COMPRESSED RUN block"
    );
    assert.match(
      section,
      /never reaches the Phase 13\.5 gate/,
      "the second anchor must state why Phase 13.5 alone is not enough"
    );
  });

  it("a failed send is fresh-spawned, never re-sent or silently dropped", () => {
    const idx = skillMd.indexOf("- **Check the result.**");
    assert.ok(idx >= 0, "the check-the-result bullet must exist");
    const bullet = skillMd.slice(idx, idx + 700);
    assert.match(
      bullet,
      /fresh spawn, not a second send/,
      "the retry for an unreachable agent must be a fresh spawn, not another send"
    );
    assert.match(
      bullet,
      /"minimum 2 reviewers" is not the fallback/,
      "the retry-once rule's drop-to-2-reviewers tail must be excluded here"
    );
  });

  it("budget mode is scoped to both Phase 5 and Phase 7 persistent sends", () => {
    assert.match(
      skillMd,
      /\*\*Applies to budget mode too\*\* — its Phase 5 and Phase 7 drive the same/,
      "budget mode runs a debate round through the same agents, not just Phase 7"
    );
  });
});

describe("v3.9.0 Phase 3 template orders BLOCKED before the write instruction", () => {
  const templates = readFileSync(
    resolve(ROOT, "skills/agent-review-panel/references/prompt-templates.md"),
    "utf-8"
  );
  const phase3 = templates.slice(
    templates.indexOf("## Phase 3"),
    templates.indexOf("## Phase 4")
  );

  it("the BLOCKED clause is the first branch of the Output protocol", () => {
    const protocol = phase3.indexOf("**Output protocol (v3.1.0+):**");
    const blocked = phase3.indexOf("_BLOCKED.md");
    const write = phase3.indexOf("_phase_3.md`");
    assert.ok(protocol >= 0, "Phase 3 must carry the output protocol");
    assert.ok(
      protocol < blocked && blocked < write,
      "BLOCKED must sit inside the Output protocol and BEFORE the write-your-review instruction"
    );
    assert.match(
      phase3,
      /take the FIRST branch that applies/,
      "the protocol must be explicitly first-match, not a list of unconditional steps"
    );
    assert.match(
      phase3,
      /\*\*Otherwise,\*\* write your full review/,
      "the normal write must be conditional on not being blocked"
    );
  });

  it("BLOCKED triggers on unreadable work, not on a missing Bash tool alone", () => {
    assert.match(
      phase3,
      /work content above was not\s+provided to you and you cannot fetch it/,
      "the operative trigger must be that the work is unreachable"
    );
    assert.match(
      phase3,
      /\*verification\s+commands\* is NOT blocked/,
      "losing only the verification commands must not qualify as BLOCKED"
    );
  });

  it("a blocked reviewer returns the BLOCKED file's path", () => {
    assert.match(
      phase3,
      /The absolute path you wrote to — the BLOCKED file if you wrote one/,
      "the return must name the BLOCKED path when that branch was taken"
    );
  });
});

describe("v3.9.1 debate-in-Workflow recipe cannot produce a silent skip", () => {
  const recipe = skillMd.slice(
    skillMd.indexOf("### Debate-in-Workflow recipe (ultracode-mode)"),
    skillMd.indexOf("## Orchestrator Efficiency Discipline")
  );

  it("the recipe section was located (guards the slice above)", () => {
    assert.ok(
      recipe.length > 500,
      "the Debate-in-Workflow recipe section must exist and be non-trivial"
    );
  });

  it("the recipe declares itself a compressed run and names the phases it runs", () => {
    assert.match(
      recipe,
      /This recipe is a compressed run and MUST declare itself one/i,
      "the recipe must declare itself a compressed run"
    );
    assert.match(
      recipe,
      /reproduces\s+Phases 1, 3, 5, 8, 10, 11, 14 and 15\.1 and skips everything else/i,
      "the recipe must state exactly which phases it reproduces"
    );
  });

  it("the recipe no longer advertises satisfying the NO-DEBATE check as sufficient", () => {
    // The v3.8.3 text read: "...is what makes the round-1 state files exist —
    // which in turn satisfies the NO-DEBATE check." That taught the reader to
    // satisfy the debate detector while skipping the verification machinery.
    assert.doesNotMatch(
      recipe,
      /which in turn satisfies the NO-DEBATE check/i,
      "the recipe must not present satisfying the NO-DEBATE check as the goal"
    );
    assert.match(
      recipe,
      /satisfies the\s+NO-DEBATE check \*\*and nothing else\*\*/i,
      "the recipe must state that the debate phase buys nothing toward verification"
    );
    assert.match(
      recipe,
      /passes the debate detector while skipping every verification pass/i,
      "the recipe must name the silent-degradation failure mode it prevents"
    );
  });

  it("the recipe mandates five stages, including consolidated verification", () => {
    assert.match(
      recipe,
      /\*\*five mandatory stages, not three\*\*/,
      "the recipe must require five stages, not the original three"
    );
    assert.match(
      recipe,
      /MANDATORY — consolidated verification \(Phases 8 \+ 10 \+ 11 in one agent\)/,
      "the recipe's code must carry a mandatory consolidated-verification stage"
    );
    assert.match(
      recipe,
      /state\/phase_8_10_11_verification\.md/,
      "the verification stage must write the budget-mode consolidated verifier state file"
    );
  });

  it("the mandatory verifier covers the two defect classes the 2026-08-10 run shipped", () => {
    assert.match(
      recipe,
      /check every\s+P0\/P1 citation against the cited source/i,
      "the consolidated verifier must do the Phase 10 citation check"
    );
    assert.match(
      recipe,
      /re-read ground truth for every P0\/P1 and downgrade any severity/i,
      "the consolidated verifier must do the Phase 11 severity re-read"
    );
    assert.match(
      recipe,
      /Do NOT restore a severity the verifier downgraded/,
      "the judge stage must be forbidden from undoing the verifier's downgrades"
    );
  });

  it("the recipe requires a terminal Report stage that IS Phase 15.1", () => {
    assert.match(
      recipe,
      /MANDATORY — report stage\. This stage IS Phase 15\.1/,
      "the recipe must require a terminal report stage bound to Phase 15.1"
    );
    assert.match(
      recipe,
      /A Workflow with no report\s+\/\/\s+stage never reaches the Phase 15\.1 chokepoint/,
      "the recipe must explain why the report stage is what makes the chokepoint fire"
    );
  });

  it("the recipe mandates a COMPRESSED RUN banner with a fixed phases-skipped list", () => {
    assert.match(
      recipe,
      /\*\*Mandatory banner\.\*\*[\s\S]{0,400}MUST open its report/i,
      "the recipe must mandate the banner"
    );
    const banner =
      recipe.match(/> ⚠️ \*\*COMPRESSED RUN — Phases skipped: ([^*]+)\*\*/) || [];
    assert.ok(banner[1], "the recipe must spell out a COMPRESSED RUN banner");
    // Every phase the recipe omits must be named in the banner it stamps.
    for (const phase of [
      "2 (data flow trace)",
      "4 (private reflection)",
      "6 (round summarization)",
      "7 (blind final)",
      "9 (verification commands)",
      "12 (tier assignment)",
      "13 (targeted verification)",
      "13.5 (pre-judge gate)",
      "14.5 (post-judge gate)",
      "15.2/15.3 (process + HTML reports)",
    ]) {
      assert.ok(
        banner[1].includes(phase),
        `the COMPRESSED RUN banner must enumerate Phase ${phase}`
      );
    }
    assert.match(
      recipe,
      /\[COMPRESSED\]`\s+on its epistemic label/,
      "the recipe must carry the [COMPRESSED] action-item suffix through to Phase 15.1"
    );
  });

  it("Phase 15.1 documents that its chokepoint cannot see a report-less Workflow run", () => {
    assert.match(
      skillMd,
      /Chokepoint limit — a Workflow run reaches Phase 15\.1 only if its script\s+authors a report stage/i,
      "Phase 15.1 must document the workflow-shape hole in its own detection"
    );
    assert.match(
      skillMd,
      /A script that ends at `Judge`\s+never executes Phase 15\.1/,
      "Phase 15.1 must state that a judge-terminated script never fires the banner checks"
    );
    assert.match(
      skillMd,
      /has not run this panel, and its output MUST NOT be presented as a panel\s+report/,
      "Phase 15.1 must forbid presenting a report-less Workflow run as a panel report"
    );
  });
});
