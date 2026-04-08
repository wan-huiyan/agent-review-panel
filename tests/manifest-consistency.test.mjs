/**
 * Manifest Consistency Tests — Multi-Plugin Marketplace
 *
 * Cross-validates version, name, and description across all manifest files
 * for ALL plugins in this marketplace. Iterates over plugins/<name>/ entries
 * and validates each plugin's manifests independently against the marketplace
 * entry, plus shared root files (package.json) where applicable.
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
// Discover ALL plugins under plugins/<name>/.claude-plugin/plugin.json
// ---------------------------------------------------------------------------

function discoverPlugins() {
  const pluginsRoot = resolve(ROOT, "plugins");
  const plugins = [];

  if (existsSync(pluginsRoot)) {
    for (const entry of readdirSync(pluginsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = resolve(pluginsRoot, entry.name);
      const pluginJsonPath = resolve(dir, ".claude-plugin/plugin.json");
      if (!existsSync(pluginJsonPath)) continue;

      const skillMdPath = resolve(dir, "SKILL.md");
      const evalSuitePath = resolve(dir, "eval-suite.json");

      // Optional secondary nested SKILL.md at plugins/<name>/skills/<sub>/SKILL.md
      let nestedSkillMdPath = null;
      const skillsSubdir = resolve(dir, "skills");
      if (existsSync(skillsSubdir)) {
        try {
          for (const sub of readdirSync(skillsSubdir, { withFileTypes: true })) {
            if (!sub.isDirectory()) continue;
            const candidate = resolve(skillsSubdir, sub.name, "SKILL.md");
            if (existsSync(candidate)) {
              nestedSkillMdPath = candidate;
              break;
            }
          }
        } catch { /* ignore */ }
      }

      plugins.push({
        dirName: entry.name,
        pluginJsonPath,
        pluginJson: JSON.parse(readFileSync(pluginJsonPath, "utf-8")),
        skillMdPath: existsSync(skillMdPath) ? skillMdPath : null,
        skillMd: existsSync(skillMdPath) ? readFileSync(skillMdPath, "utf-8") : null,
        evalSuitePath: existsSync(evalSuitePath) ? evalSuitePath : null,
        evalSuite: existsSync(evalSuitePath)
          ? JSON.parse(readFileSync(evalSuitePath, "utf-8"))
          : null,
        nestedSkillMdPath,
        nestedSkillMd: nestedSkillMdPath ? readFileSync(nestedSkillMdPath, "utf-8") : null,
      });
    }
  }

  // Legacy fallback: a single plugin.json at the marketplace root
  if (plugins.length === 0) {
    const legacyPluginJson = resolve(ROOT, ".claude-plugin/plugin.json");
    if (existsSync(legacyPluginJson)) {
      const legacySkillMd = resolve(ROOT, "SKILL.md");
      const legacyEvalSuite = resolve(ROOT, "eval-suite.json");
      plugins.push({
        dirName: "(legacy-root)",
        pluginJsonPath: legacyPluginJson,
        pluginJson: JSON.parse(readFileSync(legacyPluginJson, "utf-8")),
        skillMdPath: existsSync(legacySkillMd) ? legacySkillMd : null,
        skillMd: existsSync(legacySkillMd) ? readFileSync(legacySkillMd, "utf-8") : null,
        evalSuitePath: existsSync(legacyEvalSuite) ? legacyEvalSuite : null,
        evalSuite: existsSync(legacyEvalSuite)
          ? JSON.parse(readFileSync(legacyEvalSuite, "utf-8"))
          : null,
        nestedSkillMdPath: null,
        nestedSkillMd: null,
      });
    }
  }

  return plugins;
}

const plugins = discoverPlugins();

// Shared root files
const marketplaceJsonPath = resolve(ROOT, ".claude-plugin/marketplace.json");
const marketplaceJson = existsSync(marketplaceJsonPath)
  ? JSON.parse(readFileSync(marketplaceJsonPath, "utf-8"))
  : null;

const packageJsonPath = resolve(ROOT, "package.json");
const packageJson = existsSync(packageJsonPath)
  ? JSON.parse(readFileSync(packageJsonPath, "utf-8"))
  : null;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Manifest consistency", () => {
  describe("Plugin discovery", () => {
    it("found at least one plugin", () => {
      assert.ok(plugins.length > 0, "must discover at least one plugin");
    });
  });

  // ---------------------------------------------------------------------------
  // Per-plugin assertions: every plugin's manifests are internally consistent
  // ---------------------------------------------------------------------------
  for (const plugin of plugins) {
    describe(`Plugin: ${plugin.dirName}`, () => {
      describe("plugin.json", () => {
        it("has required fields", () => {
          assert.ok(plugin.pluginJson.name, "must have name");
          assert.ok(plugin.pluginJson.version, "must have version");
          assert.ok(plugin.pluginJson.description, "must have description");
        });

        it("has valid semver version", () => {
          assert.match(
            plugin.pluginJson.version,
            /^\d+\.\d+\.\d+$/,
            "version must be semver (e.g., 1.2.3)"
          );
        });
      });

      if (plugin.evalSuite) {
        describe("eval-suite.json", () => {
          const evalSkillName =
            plugin.evalSuite.skill_name || plugin.evalSuite.skill;

          it("has required top-level fields", () => {
            assert.ok(evalSkillName, "must have skill_name or skill field");
            assert.ok(plugin.evalSuite.version, "must have version");
          });

          it("skill name matches plugin.json", () => {
            assert.equal(
              evalSkillName,
              plugin.pluginJson.name,
              `eval-suite skill name "${evalSkillName}" must match plugin.json name "${plugin.pluginJson.name}"`
            );
          });

          it("eval-suite version matches plugin.json version", () => {
            assert.equal(
              plugin.evalSuite.version,
              plugin.pluginJson.version,
              `eval-suite version "${plugin.evalSuite.version}" must match plugin.json version "${plugin.pluginJson.version}"`
            );
          });

          if (plugin.evalSuite.triggers) {
            it("has triggers array with entries", () => {
              assert.ok(
                plugin.evalSuite.triggers.length > 0,
                "triggers must not be empty"
              );
            });

            it("trigger IDs are unique (where present)", () => {
              const ids = plugin.evalSuite.triggers
                .map((t) => t.id)
                .filter(Boolean);
              if (ids.length > 0) {
                const unique = new Set(ids);
                assert.equal(ids.length, unique.size, "all trigger IDs must be unique");
              }
            });
          }

          if (plugin.evalSuite.test_cases) {
            it("test_case IDs are unique", () => {
              const ids = plugin.evalSuite.test_cases.map((t) => t.id).filter(Boolean);
              if (ids.length > 0) {
                const unique = new Set(ids);
                assert.equal(ids.length, unique.size, "all test_case IDs must be unique");
              }
            });
          }

          if (plugin.evalSuite.edge_cases) {
            it("edge_case IDs are unique", () => {
              const ids = plugin.evalSuite.edge_cases.map((t) => t.id).filter(Boolean);
              if (ids.length > 0) {
                const unique = new Set(ids);
                assert.equal(ids.length, unique.size, "all edge_case IDs must be unique");
              }
            });
          }

          it("no duplicate IDs across all sections", () => {
            const allIds = [
              ...(plugin.evalSuite.triggers || []).map((t) => t.id),
              ...(plugin.evalSuite.test_cases || []).map((t) => t.id),
              ...(plugin.evalSuite.edge_cases || []).map((e) => e.id),
            ].filter(Boolean);
            if (allIds.length > 0) {
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
            }
          });
        });
      }

      if (plugin.skillMd) {
        describe("SKILL.md", () => {
          it("has YAML frontmatter with name", () => {
            const fm = extractFrontmatter(plugin.skillMd);
            assert.ok(fm.name, "SKILL.md must have a name in frontmatter");
          });

          it("frontmatter name matches plugin.json", () => {
            const fm = extractFrontmatter(plugin.skillMd);
            assert.equal(fm.name, plugin.pluginJson.name);
          });

          // Cross-version consistency: SKILL.md body version references must
          // match plugin.json version. Catches the silent drift documented in
          // PR #20 where PR #18 bumped plugin.json but SKILL.md still read
          // the previous major.minor in its H1 and footer instruction.
          //
          // Convention: version references in SKILL.md body use v<major>.<minor>
          // (no patch segment). The H1 check is generic — any "# <title> v<X>.<Y>"
          // pattern. The HTML footer check fires only if the SKILL.md actually
          // contains a Phase-15-style 'HTML footer should read "<title> v<X>.<Y>"'
          // instruction (so plugins without HTML output skip cleanly).
          const semverMatch = plugin.pluginJson.version?.match(/^(\d+)\.(\d+)\.\d+/);
          if (semverMatch) {
            const [, pluginMajor, pluginMinor] = semverMatch;

            it("H1 header version matches plugin.json major.minor (if H1 carries a version)", () => {
              // Extract the first H1 with a v<major>.<minor> suffix.
              const headerMatch = plugin.skillMd.match(
                /^#\s+.+?\sv(\d+)\.(\d+)\b/m
              );
              if (!headerMatch) {
                // SKILL.md H1 has no version suffix — nothing to drift.
                return;
              }
              const [, headerMajor, headerMinor] = headerMatch;
              assert.equal(
                `${headerMajor}.${headerMinor}`,
                `${pluginMajor}.${pluginMinor}`,
                `SKILL.md H1 header reads "v${headerMajor}.${headerMinor}" but plugin.json is "${plugin.pluginJson.version}" — expected "v${pluginMajor}.${pluginMinor}"`
              );
            });

            it("HTML footer instruction version matches plugin.json major.minor (if present)", () => {
              const footerMatch = plugin.skillMd.match(
                /HTML footer should read "[^"]+?\sv(\d+)\.(\d+)/
              );
              if (!footerMatch) {
                // No HTML footer instruction — plugin doesn't render HTML reports.
                return;
              }
              const [, footerMajor, footerMinor] = footerMatch;
              assert.equal(
                `${footerMajor}.${footerMinor}`,
                `${pluginMajor}.${pluginMinor}`,
                `SKILL.md HTML footer instruction reads "v${footerMajor}.${footerMinor}" but plugin.json is "${plugin.pluginJson.version}" — expected "v${pluginMajor}.${pluginMinor}"`
              );
            });
          }

          if (plugin.nestedSkillMd) {
            it("nested skills/ SKILL.md has matching frontmatter name", () => {
              const nestedFm = extractFrontmatter(plugin.nestedSkillMd);
              assert.ok(nestedFm.name, "nested SKILL.md must have a name in frontmatter");
              assert.equal(nestedFm.name, plugin.pluginJson.name);
            });
          }
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // marketplace.json must reference every plugin and match versions
  // ---------------------------------------------------------------------------
  if (marketplaceJson) {
    describe("marketplace.json", () => {
      it("has required top-level fields", () => {
        assert.ok(marketplaceJson.name, "must have name");
        assert.ok(marketplaceJson.description, "must have description");
        assert.ok(marketplaceJson.plugins, "must have plugins array");
        assert.ok(marketplaceJson.plugins.length > 0, "must have at least one plugin");
      });

      it("each marketplace entry has required fields", () => {
        for (const entry of marketplaceJson.plugins) {
          assert.ok(entry.name, `plugin entry must have name (got ${JSON.stringify(entry)})`);
          assert.ok(entry.description, `plugin entry "${entry.name}" must have description`);
          assert.ok(entry.source, `plugin entry "${entry.name}" must have source`);
        }
      });

      it("marketplace plugin count matches discovered plugins", () => {
        assert.equal(
          marketplaceJson.plugins.length,
          plugins.length,
          `marketplace lists ${marketplaceJson.plugins.length} plugins but discovered ${plugins.length} on disk`
        );
      });

      // Per-entry version + source path validation
      for (const entry of marketplaceJson.plugins) {
        describe(`marketplace entry: ${entry.name}`, () => {
          const matchedPlugin = plugins.find(
            (p) => p.pluginJson.name === entry.name
          );

          it("matches a discovered plugin by name", () => {
            assert.ok(
              matchedPlugin,
              `marketplace entry "${entry.name}" has no matching plugin on disk`
            );
          });

          if (matchedPlugin && entry.version) {
            it("version matches plugin.json version", () => {
              assert.equal(
                entry.version,
                matchedPlugin.pluginJson.version,
                `marketplace entry version "${entry.version}" must match plugin.json version "${matchedPlugin.pluginJson.version}"`
              );
            });
          }

          if (matchedPlugin && entry.source) {
            it("source path resolves to the plugin directory", () => {
              const sourceAbs = resolve(ROOT, entry.source);
              const expected = resolve(ROOT, "plugins", matchedPlugin.dirName);
              assert.equal(
                sourceAbs,
                expected,
                `marketplace source "${entry.source}" must resolve to ${expected}`
              );
            });
          }

          if (entry.skills) {
            it("skills paths resolve to existing locations", () => {
              for (const skillPath of entry.skills) {
                const fullPath = resolve(ROOT, skillPath);
                assert.ok(
                  existsSync(fullPath),
                  `skill path "${skillPath}" must exist at ${fullPath}`
                );
              }
            });
          }
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // package.json: a workspace-level test runner. We only verify it has a test
  // script and (where the workspace package name matches a plugin) that the
  // version stays in lockstep with that plugin.
  // ---------------------------------------------------------------------------
  if (packageJson) {
    describe("package.json", () => {
      it("has test script", () => {
        assert.ok(
          packageJson.scripts?.test,
          "package.json must have a test script"
        );
      });

      const matchingPlugin = plugins.find(
        (p) => p.pluginJson.name === packageJson.name
      );
      if (matchingPlugin && packageJson.version) {
        it(`version matches plugin.json version for "${packageJson.name}"`, () => {
          assert.equal(
            packageJson.version,
            matchingPlugin.pluginJson.version,
            `package.json version "${packageJson.version}" must match plugin.json version "${matchingPlugin.pluginJson.version}"`
          );
        });
      }
    });
  }
});
