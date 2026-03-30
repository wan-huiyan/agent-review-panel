import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FIXTURES = resolve(__dirname, "fixtures");

// ---------------------------------------------------------------------------
// Report parser — extracts structured data from a review panel report
// ---------------------------------------------------------------------------

/**
 * Parse a review panel report markdown into structured sections.
 * This is the core validator: any report the skill generates should parse
 * without errors when passed through this function.
 */
function parseReport(markdown) {
  const report = {
    raw: markdown,
    header: {},
    sections: {},
    errors: [],
  };

  // --- Header fields ---
  const headerPatterns = {
    workReviewed: /\*\*Work reviewed:\*\*\s*(.+?)(?:\s*\||\s*$)/m,
    date: /\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/m,
    panel: /\*\*Panel:\*\*\s*(.+?)(?:\s*\||\s*$)/m,
    verdict: /\*\*Verdict:\*\*\s*(.+?)(?:\s*\||\s*$)/m,
    confidence: /\*\*Confidence:\*\*\s*(High|Medium|Low)/m,
    signals: /\*\*Auto-detected signals:\*\*\s*(.+?)$/m,
    reviewMode: /\*\*Review mode:\*\*\s*(Precise|Exhaustive|Mixed)(?:\s*\(|$)/m,
  };

  for (const [key, pattern] of Object.entries(headerPatterns)) {
    const match = markdown.match(pattern);
    if (match) {
      report.header[key] = match[1].trim();
    } else {
      report.errors.push(`Missing header field: ${key}`);
    }
  }

  // --- Required sections ---
  const requiredSections = [
    "Executive Summary",
    "Scope & Limitations",
    "Score Summary",
    "Consensus Points",
    "Disagreement Points",
    "Action Items",
    "Detailed Reviews",
  ];

  // Split markdown by ## headings for reliable section extraction
  const sectionBlocks = markdown.split(/\n(?=## [^#])/).reduce((acc, block) => {
    const headerMatch = block.match(/^## ([^\n]+)/);
    if (headerMatch) {
      const name = headerMatch[1].trim();
      const content = block.slice(headerMatch[0].length).trim();
      acc.push({ name, content });
    }
    return acc;
  }, []);

  for (const section of requiredSections) {
    const found = sectionBlocks.find((b) => b.name.startsWith(section));
    if (found) {
      report.sections[section] = found.content;
    } else {
      report.errors.push(`Missing required section: ## ${section}`);
    }
  }

  // --- Optional sections (tracked but not required) ---
  const optionalSections = [
    "Completeness Audit Findings",
    "Coverage Gaps",
  ];
  for (const section of optionalSections) {
    const found = sectionBlocks.find((b) => b.name.startsWith(section));
    if (found) {
      report.sections[section] = found.content;
    }
  }

  // --- Score Summary table parsing ---
  const scoreBlock = sectionBlocks.find((b) => b.name.startsWith("Score Summary"));
  const scoreTableMatch = scoreBlock ? [null, scoreBlock.content] : null;
  if (scoreTableMatch) {
    const tableLines = scoreTableMatch[1]
      .split("\n")
      .filter((l) => l.startsWith("|") && !l.includes("---"));
    report.scoreTable = {
      headerRow: tableLines[0] || "",
      dataRows: tableLines.slice(1),
      reviewerCount: tableLines.slice(1).length,
    };
  }

  // --- Epistemic labels ---
  report.epistemicLabels = {
    verified: (markdown.match(/\[VERIFIED\]/g) || []).length,
    consensus: (markdown.match(/\[CONSENSUS\]/g) || []).length,
    singleSource: (markdown.match(/\[SINGLE-SOURCE\]/g) || []).length,
    unverified: (markdown.match(/\[UNVERIFIED\]/g) || []).length,
    disputed: (markdown.match(/\[DISPUTED\]/g) || []).length,
  };

  // --- Defect type labels ---
  report.defectLabels = {
    existingDefect: (markdown.match(/\[EXISTING_DEFECT\]/g) || []).length,
    planRisk: (markdown.match(/\[PLAN_RISK\]/g) || []).length,
  };

  // --- Conditional content ---
  report.hasCorrelationNotice = /Correlation Notice/i.test(markdown);
  report.hasHumanReviewWarning = /HUMAN REVIEW RECOMMENDED/i.test(markdown);
  report.hasCollapsibleDetails = /<details>/i.test(markdown);

  // --- Action items parsing ---
  const actionSection = report.sections["Action Items"] || "";
  report.actionItems = (actionSection.match(/^\d+\.\s+\*\*/gm) || []).length;

  // --- Verdict parsing ---
  const validVerdicts = [
    "Accept as-is",
    "Accept with minor changes",
    "Needs significant revision",
    "Reject",
  ];
  report.validVerdict = validVerdicts.some((v) =>
    (report.header.verdict || "").includes(v)
  );

  return report;
}

// ---------------------------------------------------------------------------
// Load fixtures
// ---------------------------------------------------------------------------

const fixtureFiles = readdirSync(FIXTURES).filter((f) => f.endsWith(".md"));
const fixtures = {};
for (const file of fixtureFiles) {
  fixtures[file] = readFileSync(resolve(FIXTURES, file), "utf-8");
}

// Also test the real archived report
const archivedReport = readFileSync(
  resolve(ROOT, "docs/archive/review_panel_report.md"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// Phase 2: Report Structure Validation Tests
// ---------------------------------------------------------------------------

describe("Report structure validation", () => {
  describe("Parser handles all fixture reports", () => {
    for (const [file, content] of Object.entries(fixtures)) {
      it(`parses ${file} without errors`, () => {
        const report = parseReport(content);
        assert.equal(
          report.errors.length,
          0,
          `Parse errors in ${file}: ${report.errors.join("; ")}`
        );
      });
    }
  });

  describe("Required header fields", () => {
    for (const [file, content] of Object.entries(fixtures)) {
      const report = parseReport(content);

      it(`${file}: has Work reviewed`, () => {
        assert.ok(report.header.workReviewed, "must have Work reviewed");
      });

      it(`${file}: has Date in YYYY-MM-DD format`, () => {
        assert.match(report.header.date || "", /^\d{4}-\d{2}-\d{2}$/);
      });

      it(`${file}: has Panel description`, () => {
        assert.ok(report.header.panel, "must have Panel");
        assert.match(report.header.panel, /\d+\s*reviewers/i);
      });

      it(`${file}: has valid Verdict`, () => {
        assert.ok(report.validVerdict, `Verdict "${report.header.verdict}" must be one of the valid options`);
      });

      it(`${file}: has Confidence level`, () => {
        assert.ok(
          ["High", "Medium", "Low"].includes(report.header.confidence),
          `Confidence must be High/Medium/Low, got: ${report.header.confidence}`
        );
      });

      it(`${file}: has Review mode`, () => {
        assert.ok(
          ["Precise", "Exhaustive", "Mixed"].includes(report.header.reviewMode),
          `Review mode must be Precise/Exhaustive/Mixed, got: ${report.header.reviewMode}`
        );
      });
    }
  });

  describe("Required sections present", () => {
    const requiredSections = [
      "Executive Summary",
      "Scope & Limitations",
      "Score Summary",
      "Consensus Points",
      "Disagreement Points",
      "Action Items",
      "Detailed Reviews",
    ];

    for (const [file, content] of Object.entries(fixtures)) {
      const report = parseReport(content);
      for (const section of requiredSections) {
        it(`${file}: has ## ${section}`, () => {
          assert.ok(
            report.sections[section] !== undefined,
            `Missing section: ${section}`
          );
        });
      }
    }
  });

  describe("Score Summary table structure", () => {
    for (const [file, content] of Object.entries(fixtures)) {
      const report = parseReport(content);

      it(`${file}: Score Summary has table with reviewers`, () => {
        assert.ok(report.scoreTable, "must have score table");
        assert.ok(
          report.scoreTable.reviewerCount >= 2,
          `Must have at least 2 reviewers, got ${report.scoreTable.reviewerCount}`
        );
      });

      it(`${file}: Score table header has required columns`, () => {
        const header = (report.scoreTable?.headerRow || "").toLowerCase();
        assert.ok(header.includes("reviewer"), "table must have Reviewer column");
        assert.ok(header.includes("persona"), "table must have Persona column");
      });
    }
  });

  describe("Epistemic labels in Scope & Limitations", () => {
    for (const [file, content] of Object.entries(fixtures)) {
      const report = parseReport(content);
      const scope = report.sections["Scope & Limitations"] || "";

      it(`${file}: documents epistemic labels`, () => {
        assert.ok(
          scope.includes("[VERIFIED]") && scope.includes("[CONSENSUS]"),
          "Scope section must document epistemic labels"
        );
      });

      it(`${file}: documents defect type labels`, () => {
        assert.ok(
          scope.includes("[EXISTING_DEFECT]") && scope.includes("[PLAN_RISK]"),
          "Scope section must document defect type labels"
        );
      });
    }
  });

  describe("Action items have severity and epistemic labels", () => {
    for (const [file, content] of Object.entries(fixtures)) {
      const report = parseReport(content);
      const actionSection = report.sections["Action Items"] || "";
      const actionLines = actionSection
        .split("\n")
        .filter((l) => /^\d+\.\s+\*\*/.test(l));

      for (const [i, line] of actionLines.entries()) {
        it(`${file}: action item ${i + 1} has severity`, () => {
          assert.match(
            line,
            /\[P[0-3]\]/,
            `Action item must have severity [P0]-[P3]: "${line.slice(0, 80)}"`
          );
        });

        it(`${file}: action item ${i + 1} has epistemic label`, () => {
          assert.match(
            line,
            /\[(VERIFIED|CONSENSUS|SINGLE-SOURCE|UNVERIFIED|DISPUTED)\]/,
            `Action item must have epistemic label: "${line.slice(0, 80)}"`
          );
        });
      }
    }
  });

  describe("Conditional content rules", () => {
    it("low-confidence report has HUMAN REVIEW RECOMMENDED", () => {
      const report = parseReport(fixtures["sample-report-low-confidence.md"]);
      assert.ok(
        report.hasHumanReviewWarning,
        "Low confidence report must include HUMAN REVIEW RECOMMENDED"
      );
    });

    it("narrow score spread report has Correlation Notice", () => {
      const report = parseReport(fixtures["sample-report-minimal.md"]);
      assert.ok(
        report.hasCorrelationNotice,
        "Report with score spread < 2 must include Correlation Notice"
      );
    });

    it("valid report has collapsible detailed reviews", () => {
      const report = parseReport(fixtures["sample-report-valid.md"]);
      assert.ok(
        report.hasCollapsibleDetails,
        "Detailed Reviews should use <details> collapsible sections"
      );
    });

    it("high-confidence report does NOT have HUMAN REVIEW RECOMMENDED", () => {
      const report = parseReport(fixtures["sample-report-valid.md"]);
      assert.equal(
        report.hasHumanReviewWarning,
        false,
        "High confidence report should not include HUMAN REVIEW RECOMMENDED"
      );
    });
  });

  describe("Archived real report validates against spec", () => {
    // The archived report from docs/archive/ is a real output — test it
    // against a relaxed version of the spec (it predates some v2.8 fields)
    const report = parseReport(archivedReport);

    it("has Executive Summary", () => {
      assert.ok(report.sections["Executive Summary"]);
    });

    it("has Score Summary table", () => {
      assert.ok(report.scoreTable, "must have score table");
      assert.ok(
        report.scoreTable.dataRows.length >= 2,
        `Must have at least 2 data rows, got ${report.scoreTable.dataRows.length}`
      );
    });

    it("has Consensus Points with content", () => {
      assert.ok(
        report.sections["Consensus Points"]?.length > 0,
        "Consensus Points section must have content"
      );
    });

    it("has Disagreement Points with content", () => {
      assert.ok(
        report.sections["Disagreement Points"]?.length > 0,
        "Disagreement Points section must have content"
      );
    });

    it("has Action Items with content", () => {
      assert.ok(
        report.sections["Action Items"]?.length > 0,
        "Action Items section must have content"
      );
    });
  });
});

// Export parser for use in other test files
export { parseReport };
