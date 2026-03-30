import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const evalSuite = JSON.parse(
  readFileSync(resolve(ROOT, "eval-suite.json"), "utf-8")
);
const skillMd = readFileSync(
  resolve(ROOT, "skills/agent-review-panel/SKILL.md"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// Test case assertion validation
// ---------------------------------------------------------------------------

describe("Eval suite test_cases assertions", () => {
  describe("Pattern assertions compile and are non-trivial", () => {
    for (const tc of evalSuite.test_cases) {
      for (const assertion of tc.assertions) {
        if (assertion.type === "pattern") {
          it(`${tc.id} — ${assertion.description}`, () => {
            // eval-suite uses Python-style (?i) inline flags; strip and use JS 'i' flag
            const cleaned = assertion.value.replace(/^\(\?i\)/, "");
            const regex = new RegExp(cleaned, "i");
            // Verify the pattern isn't trivially matching everything
            assert.equal(
              regex.test(""),
              false,
              `Pattern "${assertion.value}" should not match empty string`
            );
            assert.ok(
              assertion.description,
              "assertion must have a description"
            );
          });
        }
      }
    }
  });

  describe("Excludes assertions are non-empty", () => {
    for (const tc of evalSuite.test_cases) {
      for (const assertion of tc.assertions) {
        if (assertion.type === "excludes") {
          it(`${tc.id} — ${assertion.description}`, () => {
            assert.ok(
              assertion.value.length > 0,
              "excludes value must be non-empty"
            );
          });
        }
      }
    }
  });
});

describe("Eval suite edge_cases assertions", () => {
  describe("All edge cases have expected_behavior", () => {
    for (const ec of evalSuite.edge_cases) {
      it(`${ec.id} (${ec.category}) has expected_behavior`, () => {
        assert.ok(
          ec.expected_behavior,
          "edge case must have expected_behavior"
        );
        assert.ok(
          ec.expected_behavior.length > 10,
          "expected_behavior should be descriptive"
        );
      });
    }
  });

  describe("All edge cases have at least one assertion", () => {
    for (const ec of evalSuite.edge_cases) {
      it(`${ec.id} (${ec.category}) has assertions`, () => {
        assert.ok(
          ec.assertions && ec.assertions.length > 0,
          "edge case must have at least one assertion"
        );
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-reference: test cases cover documented features
// ---------------------------------------------------------------------------

describe("Eval suite coverage of SKILL.md features", () => {
  const allPrompts = [
    ...evalSuite.triggers.map((t) => t.prompt),
    ...evalSuite.test_cases.map((t) => t.prompt),
    ...evalSuite.edge_cases.map((e) => e.prompt),
  ].map((p) => p.toLowerCase());

  const allCategories = [
    ...evalSuite.edge_cases.map((e) => e.category),
  ];

  it("has test coverage for 'deep review' / research mode", () => {
    const hasDeep = allPrompts.some(
      (p) => p.includes("deep review") || p.includes("research")
    );
    assert.ok(hasDeep, "eval suite should cover deep/research review mode");
  });

  it("has test coverage for red team / security review", () => {
    const hasSecurity = allPrompts.some(
      (p) => p.includes("red team") || p.includes("security")
    );
    assert.ok(hasSecurity, "eval suite should cover red team / security");
  });

  it("has test coverage for stress-test requests", () => {
    const hasStress = allPrompts.some((p) => p.includes("stress-test"));
    assert.ok(hasStress, "eval suite should cover stress-test");
  });

  it("has test coverage for slash command invocation", () => {
    const hasSlash = allPrompts.some((p) =>
      p.includes("/agent-review-panel")
    );
    assert.ok(hasSlash, "eval suite should cover /agent-review-panel");
  });

  it("has test coverage for minimal input edge case", () => {
    assert.ok(
      allCategories.includes("minimal_input"),
      "eval suite should have a minimal_input edge case"
    );
  });

  it("has test coverage for scale/extreme input edge case", () => {
    assert.ok(
      allCategories.includes("scale_extreme"),
      "eval suite should have a scale_extreme edge case"
    );
  });

  it("has test coverage for custom config edge case", () => {
    assert.ok(
      allCategories.includes("custom_config"),
      "eval suite should have a custom_config edge case"
    );
  });

  it("has test coverage for trivial input edge case", () => {
    assert.ok(
      allCategories.includes("trivial_input"),
      "eval suite should have a trivial_input edge case"
    );
  });

  it("covers all content-type keywords from SKILL.md", () => {
    // Ensure the eval suite touches multiple content domains
    const domains = {
      authentication: false,
      sql: false,
      infrastructure: false,
      api: false,
      ml: false,
    };
    for (const p of allPrompts) {
      if (p.includes("auth") || p.includes("middleware")) domains.authentication = true;
      if (p.includes("sql") || p.includes("migration")) domains.sql = true;
      if (p.includes("terraform") || p.includes("kubernetes") || p.includes("infrastructure")) domains.infrastructure = true;
      if (p.includes("api")) domains.api = true;
      if (p.includes("ml") || p.includes("data science") || p.includes("pipeline")) domains.ml = true;
    }
    for (const [domain, covered] of Object.entries(domains)) {
      assert.ok(covered, `eval suite should have prompts covering ${domain} domain`);
    }
  });

  it("has balanced positive vs negative trigger examples", () => {
    const positives = evalSuite.triggers.filter((t) => t.should_trigger).length;
    const negatives = evalSuite.triggers.filter((t) => !t.should_trigger).length;
    // At least 30% of each
    const total = positives + negatives;
    assert.ok(
      positives / total >= 0.3,
      `Should have at least 30% positive triggers (got ${((positives / total) * 100).toFixed(0)}%)`
    );
    assert.ok(
      negatives / total >= 0.2,
      `Should have at least 20% negative triggers (got ${((negatives / total) * 100).toFixed(0)}%)`
    );
  });

  describe("v2.9 VoltAgent coverage", () => {
    const v29Triggers = evalSuite.triggers.filter((t) =>
      t.category.includes("v29")
    );
    const v29TestCases = evalSuite.test_cases.filter((t) =>
      t.id.includes("v29")
    );
    const v29EdgeCases = evalSuite.edge_cases.filter((e) =>
      e.category.includes("v29")
    );

    it("has v2.9 positive triggers", () => {
      const positives = v29Triggers.filter((t) => t.should_trigger);
      assert.ok(
        positives.length >= 2,
        `Should have at least 2 v2.9 positive triggers (got ${positives.length})`
      );
    });

    it("has v2.9 negative triggers", () => {
      const negatives = v29Triggers.filter((t) => !t.should_trigger);
      assert.ok(
        negatives.length >= 1,
        `Should have at least 1 v2.9 negative trigger (got ${negatives.length})`
      );
    });

    it("has v2.9 test cases with VoltAgent assertions", () => {
      assert.ok(
        v29TestCases.length >= 1,
        `Should have at least 1 v2.9 test case (got ${v29TestCases.length})`
      );
      // Check that at least one v2.9 test case asserts on VoltAgent
      const hasVoltAssert = v29TestCases.some((tc) =>
        tc.assertions.some((a) =>
          a.value.toLowerCase().includes("voltagent") ||
          a.description.toLowerCase().includes("voltagent")
        )
      );
      assert.ok(hasVoltAssert, "v2.9 test cases should assert on VoltAgent behavior");
    });

    it("has v2.9 edge cases for partial installs and fallback", () => {
      assert.ok(
        v29EdgeCases.length >= 2,
        `Should have at least 2 v2.9 edge cases (got ${v29EdgeCases.length})`
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Structural validation of the eval suite
// ---------------------------------------------------------------------------

describe("Eval suite structural integrity", () => {
  it("no duplicate IDs across all sections", () => {
    const allIds = [
      ...evalSuite.triggers.map((t) => t.id),
      ...evalSuite.test_cases.map((t) => t.id),
      ...evalSuite.edge_cases.map((e) => e.id),
    ];
    const seen = new Set();
    const dupes = [];
    for (const id of allIds) {
      if (seen.has(id)) dupes.push(id);
      seen.add(id);
    }
    assert.equal(
      dupes.length,
      0,
      `Found duplicate IDs across sections: ${dupes.join(", ")}`
    );
  });

  it("all triggers have notes explaining the classification", () => {
    for (const trigger of evalSuite.triggers) {
      assert.ok(
        trigger.notes && trigger.notes.length > 5,
        `Trigger ${trigger.id} must have descriptive notes`
      );
    }
  });

  it("test case assertions have descriptions", () => {
    for (const tc of evalSuite.test_cases) {
      for (const assertion of tc.assertions) {
        assert.ok(
          assertion.description,
          `Test case ${tc.id}: assertion for "${assertion.value}" needs a description`
        );
      }
    }
  });

  it("category naming is consistent", () => {
    const validCategories = [
      "positive",
      "negative",
      "edge",
      "positive-v29",
      "negative-v29",
      "edge-v29",
    ];
    for (const trigger of evalSuite.triggers) {
      assert.ok(
        validCategories.includes(trigger.category),
        `Trigger ${trigger.id} has unexpected category: "${trigger.category}"`
      );
    }
  });
});
