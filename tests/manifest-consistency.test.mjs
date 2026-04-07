/**
 * Manifest Consistency Tests — Generalized Template
 *
 * Cross-validates version, name, and description across all manifest files.
 * Dynamically discovers which files exist and only tests those present.
 *
 * Works for any Claude Code skill repo with at minimum a .claude-plugin/plugin.json.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Helper: extract YAML frontmatter fields from SKILL.md
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
// Discover available manifest files
// ---------------------------------------------------------------------------

const files = {};

// The canonical Claude Code plugin layout nests each plugin inside a
// plugins/<name>/ subdirectory, with its manifest at
// plugins/<name>/.claude-plugin/plugin.json. We discover the first plugin
// manifest anywhere under plugins/ and fall back to the legacy
// .claude-plugin/plugin.json location for backwards compatibility.
function findPluginJson() {
  // Prefer the canonical plugins/<name>/.claude-plugin/plugin.json layout
  const pluginsRoot = resolve(ROOT, "plugins");
  if (existsSync(pluginsRoot)) {
    for (const entry of readdirSync(pluginsRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const candidate = resolve(pluginsRoot, entry.name, ".claude-plugin/plugin.json");
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  // Legacy fallback: plugin.json at marketplace root
  const legacy = resolve(ROOT, ".claude-plugin/plugin.json");
  return existsSync(legacy) ? legacy : null;
}

const pluginJsonPath = findPluginJson();
if (pluginJsonPath && existsSync(pluginJsonPath)) {
  files.pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
}

const marketplaceJsonPath = resolve(ROOT, ".claude-plugin/marketplace.json");
if (existsSync(marketplaceJsonPath)) {
  files.marketplaceJson = JSON.parse(readFileSync(marketplaceJsonPath, "utf-8"));
}

const evalSuitePath = resolve(ROOT, "eval-suite.json");
if (existsSync(evalSuitePath)) {
  files.evalSuite = JSON.parse(readFileSync(evalSuitePath, "utf-8"));
}

const packageJsonPath = resolve(ROOT, "package.json");
if (existsSync(packageJsonPath)) {
  files.packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
}

// Discover the plugin's SKILL.md. In the canonical layout it lives at
// plugins/<name>/SKILL.md (next to the plugin's .claude-plugin/plugin.json).
// Fall back to a root SKILL.md for repos using the legacy flat layout.
function findRootSkillMd() {
  // Canonical: plugins/<name>/SKILL.md
  const pluginsRoot = resolve(ROOT, "plugins");
  if (existsSync(pluginsRoot)) {
    for (const entry of readdirSync(pluginsRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const candidate = resolve(pluginsRoot, entry.name, "SKILL.md");
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  // Legacy: SKILL.md at the repo root
  const legacy = resolve(ROOT, "SKILL.md");
  return existsSync(legacy) ? legacy : null;
}

const rootSkillMdPath = findRootSkillMd();
if (rootSkillMdPath && existsSync(rootSkillMdPath)) {
  files.rootSkillMd = readFileSync(rootSkillMdPath, "utf-8");
}

// Optional secondary SKILL.md: some plugins also expose a nested
// plugins/<name>/skills/<skill>/SKILL.md. Skip if the layout doesn't use it.
let nestedSkillMdPath = null;
const pluginsRootForSkills = resolve(ROOT, "plugins");
if (existsSync(pluginsRootForSkills)) {
  for (const pluginEntry of readdirSync(pluginsRootForSkills, { withFileTypes: true })) {
    if (!pluginEntry.isDirectory()) continue;
    const skillsDir = resolve(pluginsRootForSkills, pluginEntry.name, "skills");
    if (!existsSync(skillsDir)) continue;
    try {
      const subdirs = readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory());
      for (const subdir of subdirs) {
        const candidate = resolve(skillsDir, subdir.name, "SKILL.md");
        if (existsSync(candidate)) {
          nestedSkillMdPath = candidate;
          files.nestedSkillMd = readFileSync(candidate, "utf-8");
          break;
        }
      }
    } catch { /* ignore */ }
    if (nestedSkillMdPath) break;
  }
}

// Derive the canonical skill name from plugin.json (authoritative source)
const SKILL_NAME = files.pluginJson?.name;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Manifest consistency", () => {
  describe("plugin.json", () => {
    it("exists and has required fields", () => {
      assert.ok(files.pluginJson, ".claude-plugin/plugin.json must exist");
      assert.ok(files.pluginJson.name, "must have name");
      assert.ok(files.pluginJson.version, "must have version");
      assert.ok(files.pluginJson.description, "must have description");
    });

    it("has valid semver version", () => {
      assert.match(
        files.pluginJson.version,
        /^\d+\.\d+\.\d+$/,
        "version must be semver (e.g., 1.2.3)"
      );
    });
  });

  if (files.marketplaceJson) {
    describe("marketplace.json", () => {
      it("has required fields", () => {
        assert.ok(files.marketplaceJson.name, "must have name");
        assert.ok(files.marketplaceJson.description, "must have description");
        assert.ok(files.marketplaceJson.plugins, "must have plugins array");
        assert.ok(files.marketplaceJson.plugins.length > 0, "must have at least one plugin");
      });

      it("plugin entry has required fields", () => {
        const plugin = files.marketplaceJson.plugins[0];
        assert.ok(plugin.name, "plugin must have name");
        assert.ok(plugin.description, "plugin must have description");
        assert.ok(plugin.source, "plugin must have source");
      });

      it("first plugin entry name matches plugin.json", () => {
        // The marketplace's own `name` can be anything (e.g. owner-prefixed
        // "wan-huiyan-causal-impact-campaign"). The real invariant is that the
        // first plugin entry must match the plugin.json name, because that's
        // what users type in `claude plugin install <plugin-name>@<marketplace>`.
        assert.equal(files.marketplaceJson.plugins[0].name, SKILL_NAME);
      });

      if (files.marketplaceJson.plugins[0]?.version) {
        it("plugin version matches plugin.json version", () => {
          assert.equal(
            files.marketplaceJson.plugins[0].version,
            files.pluginJson.version,
            "marketplace plugin version must match plugin.json version"
          );
        });
      }

      it("skills paths resolve to existing locations", () => {
        const plugin = files.marketplaceJson.plugins[0];
        if (plugin.skills) {
          for (const skillPath of plugin.skills) {
            const fullPath = resolve(ROOT, skillPath);
            assert.ok(
              existsSync(fullPath),
              `skill path "${skillPath}" must exist at ${fullPath}`
            );
          }
        }
      });
    });
  }

  if (files.evalSuite) {
    describe("eval-suite.json", () => {
      // Handle both "skill_name" and "skill" field names
      const evalSkillName = files.evalSuite.skill_name || files.evalSuite.skill;

      it("has required top-level fields", () => {
        assert.ok(evalSkillName, "must have skill_name or skill field");
        assert.ok(files.evalSuite.version, "must have version");
      });

      it("skill name matches plugin.json", () => {
        assert.equal(
          evalSkillName,
          SKILL_NAME,
          `eval-suite skill name "${evalSkillName}" must match plugin.json name "${SKILL_NAME}"`
        );
      });

      if (files.evalSuite.triggers) {
        it("has triggers array with entries", () => {
          assert.ok(files.evalSuite.triggers.length > 0, "triggers must not be empty");
        });

        it("trigger IDs are unique", () => {
          const ids = files.evalSuite.triggers.map((t) => t.id).filter(Boolean);
          if (ids.length > 0) {
            const unique = new Set(ids);
            assert.equal(ids.length, unique.size, "all trigger IDs must be unique");
          }
        });
      }

      if (files.evalSuite.test_cases) {
        it("test_case IDs are unique", () => {
          const ids = files.evalSuite.test_cases.map((t) => t.id).filter(Boolean);
          if (ids.length > 0) {
            const unique = new Set(ids);
            assert.equal(ids.length, unique.size, "all test_case IDs must be unique");
          }
        });
      }

      if (files.evalSuite.edge_cases) {
        it("edge_case IDs are unique", () => {
          const ids = files.evalSuite.edge_cases.map((t) => t.id).filter(Boolean);
          if (ids.length > 0) {
            const unique = new Set(ids);
            assert.equal(ids.length, unique.size, "all edge_case IDs must be unique");
          }
        });
      }

      it("no duplicate IDs across all sections", () => {
        const allIds = [
          ...(files.evalSuite.triggers || []).map((t) => t.id),
          ...(files.evalSuite.test_cases || []).map((t) => t.id),
          ...(files.evalSuite.edge_cases || []).map((e) => e.id),
        ].filter(Boolean);
        if (allIds.length > 0) {
          const seen = new Set();
          const dupes = [];
          for (const id of allIds) {
            if (seen.has(id)) dupes.push(id);
            seen.add(id);
          }
          assert.equal(
            dupes.length, 0,
            `Found duplicate IDs across sections: ${dupes.join(", ")}`
          );
        }
      });
    });
  }

  if (files.packageJson) {
    describe("package.json", () => {
      it("name matches plugin.json", () => {
        assert.equal(files.packageJson.name, SKILL_NAME);
      });

      it("has test script", () => {
        assert.ok(
          files.packageJson.scripts?.test,
          "package.json must have a test script"
        );
      });
    });
  }

  if (files.rootSkillMd) {
    describe("SKILL.md", () => {
      it("has YAML frontmatter with name", () => {
        const fm = extractFrontmatter(files.rootSkillMd);
        assert.ok(fm.name, "root SKILL.md must have a name in frontmatter");
      });

      it("frontmatter name matches plugin.json", () => {
        const fm = extractFrontmatter(files.rootSkillMd);
        assert.equal(fm.name, SKILL_NAME);
      });

      if (files.nestedSkillMd) {
        it("nested skills/ SKILL.md has matching frontmatter name", () => {
          const nestedFm = extractFrontmatter(files.nestedSkillMd);
          assert.ok(nestedFm.name, "nested SKILL.md must have a name in frontmatter");
          assert.equal(nestedFm.name, SKILL_NAME);
        });
      }
    });
  }
});
