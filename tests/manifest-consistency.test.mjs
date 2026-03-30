import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Load all manifest/config files
// ---------------------------------------------------------------------------

const pluginJson = JSON.parse(
  readFileSync(resolve(ROOT, ".claude-plugin/plugin.json"), "utf-8")
);

const marketplaceJson = JSON.parse(
  readFileSync(resolve(ROOT, ".claude-plugin/marketplace.json"), "utf-8")
);

const evalSuite = JSON.parse(
  readFileSync(resolve(ROOT, "eval-suite.json"), "utf-8")
);

const packageJson = JSON.parse(
  readFileSync(resolve(ROOT, "package.json"), "utf-8")
);

const rootSkillMd = readFileSync(resolve(ROOT, "SKILL.md"), "utf-8");
const skillSkillMd = readFileSync(
  resolve(ROOT, "skills/agent-review-panel/SKILL.md"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// Helper: extract YAML frontmatter field
// ---------------------------------------------------------------------------

function extractFrontmatter(md) {
  const match = md.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const fields = {};
  for (const line of yaml.split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)/);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Manifest consistency", () => {
  describe("plugin.json", () => {
    it("has required fields", () => {
      assert.ok(pluginJson.name, "must have name");
      assert.ok(pluginJson.version, "must have version");
      assert.ok(pluginJson.description, "must have description");
    });

    it("name matches across manifests", () => {
      assert.equal(pluginJson.name, "agent-review-panel");
      assert.equal(marketplaceJson.name, "agent-review-panel");
      assert.equal(evalSuite.skill_name, "agent-review-panel");
      assert.equal(packageJson.name, "agent-review-panel");
    });

    it("has valid semver version", () => {
      assert.match(
        pluginJson.version,
        /^\d+\.\d+\.\d+$/,
        "version must be semver"
      );
    });
  });

  describe("marketplace.json", () => {
    it("has required fields", () => {
      assert.ok(marketplaceJson.name, "must have name");
      assert.ok(marketplaceJson.description, "must have description");
      assert.ok(marketplaceJson.plugins, "must have plugins array");
      assert.ok(marketplaceJson.plugins.length > 0, "must have at least one plugin");
    });

    it("plugin entry has required fields", () => {
      const plugin = marketplaceJson.plugins[0];
      assert.ok(plugin.name, "plugin must have name");
      assert.ok(plugin.description, "plugin must have description");
      assert.ok(plugin.source, "plugin must have source");
      assert.ok(plugin.version, "plugin must have version");
      assert.ok(plugin.skills, "plugin must have skills array");
    });

    it("plugin version matches plugin.json version", () => {
      assert.equal(
        marketplaceJson.plugins[0].version,
        pluginJson.version,
        "marketplace plugin version must match plugin.json version"
      );
    });

    it("skills paths resolve to existing directories", () => {
      for (const skillPath of marketplaceJson.plugins[0].skills) {
        const fullPath = resolve(ROOT, skillPath);
        assert.ok(
          existsSync(fullPath),
          `skill path "${skillPath}" must exist at ${fullPath}`
        );
      }
    });

    it("source path resolves to existing directory", () => {
      const sourcePath = resolve(ROOT, marketplaceJson.plugins[0].source);
      assert.ok(
        existsSync(sourcePath),
        `source path must exist at ${sourcePath}`
      );
    });
  });

  describe("eval-suite.json", () => {
    it("has required top-level fields", () => {
      assert.ok(evalSuite.skill_name, "must have skill_name");
      assert.ok(evalSuite.version, "must have version");
      assert.ok(evalSuite.triggers, "must have triggers array");
      assert.ok(evalSuite.test_cases, "must have test_cases array");
      assert.ok(evalSuite.edge_cases, "must have edge_cases array");
    });

    it("trigger IDs are unique", () => {
      const ids = evalSuite.triggers.map((t) => t.id);
      const unique = new Set(ids);
      assert.equal(ids.length, unique.size, "all trigger IDs must be unique");
    });

    it("test_case IDs are unique", () => {
      const ids = evalSuite.test_cases.map((t) => t.id);
      const unique = new Set(ids);
      assert.equal(ids.length, unique.size, "all test_case IDs must be unique");
    });

    it("edge_case IDs are unique", () => {
      const ids = evalSuite.edge_cases.map((t) => t.id);
      const unique = new Set(ids);
      assert.equal(ids.length, unique.size, "all edge_case IDs must be unique");
    });

    it("all test_case assertions have valid types", () => {
      const validTypes = ["pattern", "excludes", "contains"];
      for (const tc of evalSuite.test_cases) {
        for (const assertion of tc.assertions) {
          assert.ok(
            validTypes.includes(assertion.type),
            `test case ${tc.id}: assertion type "${assertion.type}" must be one of: ${validTypes.join(", ")}`
          );
        }
      }
    });

    it("all test_case pattern assertions are valid regexes", () => {
      for (const tc of evalSuite.test_cases) {
        for (const assertion of tc.assertions) {
          if (assertion.type === "pattern") {
            assert.doesNotThrow(
              () => new RegExp(assertion.value.replace(/^\(\?i\)/, ""), "i"),
              `test case ${tc.id}: pattern "${assertion.value}" must be a valid regex`
            );
          }
        }
      }
    });

    it("all edge_case assertions are valid regexes", () => {
      for (const ec of evalSuite.edge_cases) {
        for (const assertion of ec.assertions) {
          if (assertion.type === "pattern") {
            assert.doesNotThrow(
              () => new RegExp(assertion.value.replace(/^\(\?i\)/, ""), "i"),
              `edge case ${ec.id}: pattern "${assertion.value}" must be a valid regex`
            );
          }
        }
      }
    });
  });

  describe("SKILL.md files", () => {
    it("root SKILL.md exists and has frontmatter", () => {
      const fm = extractFrontmatter(rootSkillMd);
      assert.ok(fm.name, "root SKILL.md must have a name in frontmatter");
      assert.equal(fm.name, "agent-review-panel");
    });

    it("skills/ SKILL.md exists and has frontmatter", () => {
      const fm = extractFrontmatter(skillSkillMd);
      assert.ok(fm.name, "skills/ SKILL.md must have a name in frontmatter");
      assert.equal(fm.name, "agent-review-panel");
    });

    it("both SKILL.md files have the same frontmatter name", () => {
      const rootFm = extractFrontmatter(rootSkillMd);
      const skillFm = extractFrontmatter(skillSkillMd);
      assert.equal(rootFm.name, skillFm.name);
    });

    it("both SKILL.md files have the same description (trigger logic)", () => {
      // Extract description block — it's multiline in YAML
      const extractDescription = (md) => {
        const match = md.match(/^---\n([\s\S]*?)\n---/);
        if (!match) return "";
        // Get everything between "description:" and the next top-level field or "---"
        const descMatch = match[1].match(
          /description:\s*>\n([\s\S]*?)(?=\n\w[\w-]*:|$)/
        );
        return descMatch ? descMatch[1].trim() : "";
      };
      const rootDesc = extractDescription(rootSkillMd);
      const skillDesc = extractDescription(skillSkillMd);
      assert.equal(
        rootDesc,
        skillDesc,
        "Both SKILL.md files must have identical trigger descriptions"
      );
    });

    it("root SKILL.md contains all 6 phases", () => {
      const phases = [
        "## Phase 1",
        "## Phase 2:",
        "## Phase 2.5",
        "## Phase 3:",
        "## Phase 4:",
        "## Phase 4.5",
        "## Phase 4.6",
        "## Phase 4.7",
        "## Phase 5:",
        "## Phase 6:",
      ];
      for (const phase of phases) {
        assert.ok(
          rootSkillMd.includes(phase),
          `SKILL.md must contain "${phase}"`
        );
      }
    });

    it("SKILL.md documents all content types for persona selection", () => {
      const contentTypes = [
        "For code/implementation",
        "For plans/designs",
        "For mixed content",
        "For documentation",
      ];
      for (const ct of contentTypes) {
        assert.ok(
          rootSkillMd.includes(ct),
          `SKILL.md must document persona selection for: "${ct}"`
        );
      }
    });
  });
});
