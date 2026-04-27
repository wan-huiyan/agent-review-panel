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
      /100[- ]word summary/i,
      "Phase 3 prompt must request a 100-word summary in the chat return"
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
});

// Export utilities for other test files
export { makeAssertionChecker, runAssertions };
