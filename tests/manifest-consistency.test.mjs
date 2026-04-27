/**
 * Manifest Consistency Tests — Single-Plugin Layout
 *
 * As of v3.0.0 the repo is a single Claude Code plugin (".claude-plugin/plugin.json"
 * at root) that bundles multiple skills under "skills/<name>/SKILL.md". Marketplace
 * source path is "./". This test cross-validates:
 *   - root plugin.json has required fields and valid semver
 *   - marketplace.json's single entry resolves source to repo root and matches plugin.json
 *   - every "skills/<name>/SKILL.md" has frontmatter with a name
 *   - every "skills/<name>/eval-suite.json" has well-formed top-level fields and unique IDs
 *   - the "marquee" skill that shares its name with the plugin tracks plugin.json version
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
// Discover the single root plugin and its bundled skills
// ---------------------------------------------------------------------------

const pluginJsonPath = resolve(ROOT, ".claude-plugin/plugin.json");
const pluginJson = existsSync(pluginJsonPath)
  ? JSON.parse(readFileSync(pluginJsonPath, "utf-8"))
  : null;

const marketplaceJsonPath = resolve(ROOT, ".claude-plugin/marketplace.json");
const marketplaceJson = existsSync(marketplaceJsonPath)
  ? JSON.parse(readFileSync(marketplaceJsonPath, "utf-8"))
  : null;

const packageJsonPath = resolve(ROOT, "package.json");
const packageJson = existsSync(packageJsonPath)
  ? JSON.parse(readFileSync(packageJsonPath, "utf-8"))
  : null;

function discoverSkills() {
  const skillsRoot = resolve(ROOT, "skills");
  const skills = [];
  if (!existsSync(skillsRoot)) return skills;

  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = resolve(skillsRoot, entry.name);
    const skillMdPath = resolve(dir, "SKILL.md");
    if (!existsSync(skillMdPath)) continue;
    const evalSuitePath = resolve(dir, "eval-suite.json");

    skills.push({
      dirName: entry.name,
      skillMdPath,
      skillMd: readFileSync(skillMdPath, "utf-8"),
      evalSuitePath: existsSync(evalSuitePath) ? evalSuitePath : null,
      evalSuite: existsSync(evalSuitePath)
        ? JSON.parse(readFileSync(evalSuitePath, "utf-8"))
        : null,
    });
  }
  return skills;
}

const skills = discoverSkills();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Manifest consistency", () => {
  describe("Root plugin.json", () => {
    it("exists at .claude-plugin/plugin.json", () => {
      assert.ok(pluginJson, "root .claude-plugin/plugin.json must exist");
    });

    it("has required fields", () => {
      assert.ok(pluginJson.name, "must have name");
      assert.ok(pluginJson.version, "must have version");
      assert.ok(pluginJson.description, "must have description");
    });

    it("has valid semver version", () => {
      assert.match(
        pluginJson.version,
        /^\d+\.\d+\.\d+$/,
        "version must be semver (e.g., 1.2.3)"
      );
    });
  });

  describe("Skill discovery", () => {
    it("found at least one skill under skills/", () => {
      assert.ok(skills.length > 0, "must discover at least one skill");
    });
  });

  for (const skill of skills) {
    describe(`Skill: ${skill.dirName}`, () => {
      describe("SKILL.md", () => {
        const fm = extractFrontmatter(skill.skillMd);

        it("has YAML frontmatter with name", () => {
          assert.ok(fm.name, "SKILL.md must have a name in frontmatter");
        });

        it("frontmatter name matches directory name", () => {
          assert.equal(
            fm.name,
            skill.dirName,
            `SKILL.md frontmatter name "${fm.name}" must match directory "${skill.dirName}"`
          );
        });

        // The "marquee" skill that shares its name with the plugin tracks
        // plugin.json's major.minor in any H1/footer version reference. Other
        // skills version independently.
        const isMarquee = skill.dirName === pluginJson?.name;
        const semverMatch = pluginJson?.version?.match(/^(\d+)\.(\d+)\.\d+/);

        if (isMarquee && semverMatch) {
          const [, pluginMajor, pluginMinor] = semverMatch;

          it("H1 header version matches plugin.json major.minor (if H1 carries a version)", () => {
            const headerMatch = skill.skillMd.match(
              /^#\s+.+?\sv(\d+)\.(\d+)\b/m
            );
            if (!headerMatch) return;
            const [, headerMajor, headerMinor] = headerMatch;
            assert.equal(
              `${headerMajor}.${headerMinor}`,
              `${pluginMajor}.${pluginMinor}`,
              `SKILL.md H1 header reads "v${headerMajor}.${headerMinor}" but plugin.json is "${pluginJson.version}" — expected "v${pluginMajor}.${pluginMinor}"`
            );
          });

          it("HTML footer instruction version matches plugin.json major.minor (if present)", () => {
            const footerMatch = skill.skillMd.match(
              /HTML footer should read "[^"]+?\sv(\d+)\.(\d+)/
            );
            if (!footerMatch) return;
            const [, footerMajor, footerMinor] = footerMatch;
            assert.equal(
              `${footerMajor}.${footerMinor}`,
              `${pluginMajor}.${pluginMinor}`,
              `SKILL.md HTML footer instruction reads "v${footerMajor}.${footerMinor}" but plugin.json is "${pluginJson.version}" — expected "v${pluginMajor}.${pluginMinor}"`
            );
          });
        }
      });

      if (skill.evalSuite) {
        describe("eval-suite.json", () => {
          const evalSkillName =
            skill.evalSuite.skill_name || skill.evalSuite.skill;

          it("has required top-level fields", () => {
            assert.ok(evalSkillName, "must have skill_name or skill field");
            assert.ok(skill.evalSuite.version, "must have version");
          });

          it("eval-suite skill name matches directory name", () => {
            assert.equal(
              evalSkillName,
              skill.dirName,
              `eval-suite skill_name "${evalSkillName}" must match directory "${skill.dirName}"`
            );
          });

          it("eval-suite version is valid semver", () => {
            assert.match(
              skill.evalSuite.version,
              /^\d+\.\d+\.\d+$/,
              "eval-suite version must be semver"
            );
          });

          // Marquee skill's eval-suite tracks plugin.json version
          if (skill.dirName === pluginJson?.name) {
            it("marquee skill eval-suite version matches plugin.json version", () => {
              assert.equal(
                skill.evalSuite.version,
                pluginJson.version,
                `marquee eval-suite version "${skill.evalSuite.version}" must match plugin.json version "${pluginJson.version}"`
              );
            });
          }

          if (skill.evalSuite.triggers) {
            it("trigger IDs are unique (where present)", () => {
              const ids = skill.evalSuite.triggers
                .map((t) => t.id)
                .filter(Boolean);
              if (ids.length > 0) {
                const unique = new Set(ids);
                assert.equal(ids.length, unique.size, "all trigger IDs must be unique");
              }
            });
          }

          if (skill.evalSuite.test_cases) {
            it("test_case IDs are unique", () => {
              const ids = skill.evalSuite.test_cases.map((t) => t.id).filter(Boolean);
              if (ids.length > 0) {
                const unique = new Set(ids);
                assert.equal(ids.length, unique.size, "all test_case IDs must be unique");
              }
            });
          }

          if (skill.evalSuite.edge_cases) {
            it("edge_case IDs are unique", () => {
              const ids = skill.evalSuite.edge_cases.map((t) => t.id).filter(Boolean);
              if (ids.length > 0) {
                const unique = new Set(ids);
                assert.equal(ids.length, unique.size, "all edge_case IDs must be unique");
              }
            });
          }

          it("no duplicate IDs across all sections", () => {
            const allIds = [
              ...(skill.evalSuite.triggers || []).map((t) => t.id),
              ...(skill.evalSuite.test_cases || []).map((t) => t.id),
              ...(skill.evalSuite.edge_cases || []).map((e) => e.id),
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
    });
  }

  if (marketplaceJson) {
    describe("marketplace.json", () => {
      it("has required top-level fields", () => {
        assert.ok(marketplaceJson.name, "must have name");
        assert.ok(marketplaceJson.description, "must have description");
        assert.ok(marketplaceJson.plugins, "must have plugins array");
        assert.ok(marketplaceJson.plugins.length > 0, "must have at least one plugin");
      });

      it("contains exactly one plugin entry (single-plugin layout)", () => {
        assert.equal(
          marketplaceJson.plugins.length,
          1,
          `single-plugin layout expects 1 marketplace entry, got ${marketplaceJson.plugins.length}`
        );
      });

      const entry = marketplaceJson.plugins[0];
      describe("marketplace entry", () => {
        it("has required fields", () => {
          assert.ok(entry.name, "must have name");
          assert.ok(entry.description, "must have description");
          assert.ok(entry.source, "must have source");
        });

        it("name matches root plugin.json name", () => {
          assert.equal(
            entry.name,
            pluginJson.name,
            `marketplace entry name "${entry.name}" must match plugin.json name "${pluginJson.name}"`
          );
        });

        it("version matches root plugin.json version", () => {
          assert.equal(
            entry.version,
            pluginJson.version,
            `marketplace entry version "${entry.version}" must match plugin.json version "${pluginJson.version}"`
          );
        });

        it("source resolves to repo root", () => {
          const sourceAbs = resolve(ROOT, entry.source);
          assert.equal(
            sourceAbs,
            ROOT,
            `marketplace source "${entry.source}" must resolve to repo root ${ROOT}`
          );
        });
      });
    });
  }

  if (packageJson) {
    describe("package.json", () => {
      it("has test script", () => {
        assert.ok(
          packageJson.scripts?.test,
          "package.json must have a test script"
        );
      });

      if (packageJson.name === pluginJson?.name && packageJson.version) {
        it(`version matches plugin.json version for "${packageJson.name}"`, () => {
          assert.equal(
            packageJson.version,
            pluginJson.version,
            `package.json version "${packageJson.version}" must match plugin.json version "${pluginJson.version}"`
          );
        });
      }
    });
  }
});
