#!/usr/bin/env bash
#
# release-check.sh — pre-release doc-drift detector
#
# Motivation: between v2.16.2 and v2.16.5, four consecutive releases shipped
# without sweeping README / CHANGELOG / ROADMAP / HOW_WE_BUILT_THIS for stale
# version strings, stale slash commands, and stale marketplace names. A
# self-review panel on the repo (2026-04-19) surfaced 3 P0 doc contradictions
# that every one of those releases could have caught with grep.
#
# This script should be run BEFORE bumping plugin.json to the next version,
# or as a CI check on release branches. It asserts:
#   1. The current slash-command form (`/<plugin>:<skill>`) is not contradicted
#      anywhere in the user-facing docs.
#   2. The current marketplace name in `.claude-plugin/marketplace.json` is not
#      contradicted by any "marketplace name is X" callout.
#   3. The test-count claim in README matches the actual `npm test` output.
#   4. The canonical version in `plugins/*/plugin.json` matches the version
#      strings in SKILL.md h1, SKILL.md HTML footer instruction, package.json,
#      eval-suite.json, and marketplace.json entries.
#   5. The latest version row exists in ROADMAP.md version table.
#
# Exit 0 on pass, 1 on any failure. Prints every failing assertion.
#
# Usage:
#   bash scripts/release-check.sh
#   # or as CI: add to .github/workflows/test.yml

set -eo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

FAIL=0

fail() {
  echo "❌ FAIL: $*"
  FAIL=1
}

pass() {
  echo "✅ $*"
}

# --- 1. Canonical facts (single source of truth) -----------------------------

CANON_VERSION="$(grep -E '"version"' plugins/agent-review-panel/.claude-plugin/plugin.json | head -1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
PLUGIN_NAME="$(grep -E '"name"' plugins/agent-review-panel/.claude-plugin/plugin.json | head -1 | sed -E 's/.*"name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
MARKETPLACE_NAME="$(grep -E '"name"' .claude-plugin/marketplace.json | head -1 | sed -E 's/.*"name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"

echo "Canonical version:       $CANON_VERSION"
echo "Canonical plugin name:   $PLUGIN_NAME"
echo "Canonical marketplace:   $MARKETPLACE_NAME"
echo ""

# --- 2. Slash-command consistency --------------------------------------------

CORRECT_SLASH="/${PLUGIN_NAME}:agent-review-panel"
STALE_PATTERN="/agent-review-panel:agent-review-panel"

# Only flag stale pattern if the plugin has been renamed away from "agent-review-panel"
if [ "$PLUGIN_NAME" != "agent-review-panel" ]; then
  STALE_HITS=$(grep -rn "$STALE_PATTERN" README.md 2>/dev/null || true)
  if [ -n "$STALE_HITS" ]; then
    fail "Stale slash command '$STALE_PATTERN' in README.md (plugin is '$PLUGIN_NAME'; should be '$CORRECT_SLASH'):"
    echo "$STALE_HITS" | sed 's/^/    /'
  else
    pass "Slash commands in README.md consistent with plugin name '$PLUGIN_NAME'"
  fi
fi

# --- 3. Marketplace-name callout consistency ---------------------------------

# Look for "marketplace name is X" claims that disagree with actual marketplace.json name
BAD_CALLOUTS=$(grep -n "marketplace name is" README.md HOW_WE_BUILT_THIS.md 2>/dev/null \
  | grep -v "marketplace name is \`${MARKETPLACE_NAME}\`" \
  | grep -v "^$" || true)

if [ -n "$BAD_CALLOUTS" ]; then
  fail "README/HOW_WE_BUILT_THIS contains 'marketplace name is ...' callouts that disagree with marketplace.json ('${MARKETPLACE_NAME}'):"
  echo "$BAD_CALLOUTS" | sed 's/^/    /'
else
  pass "Marketplace-name callouts consistent with '$MARKETPLACE_NAME'"
fi

# --- 4. Test-count consistency -----------------------------------------------

if command -v node >/dev/null 2>&1 && [ -f package.json ]; then
  ACTUAL_TESTS=$(npm test 2>&1 | grep -E '^# tests' | awk '{print $3}' || echo "")
  if [ -n "$ACTUAL_TESTS" ]; then
    README_CLAIMS=$(grep -oE '[0-9]+ tests' README.md | sort -u || true)
    WRONG_CLAIMS=$(echo "$README_CLAIMS" | grep -v "^${ACTUAL_TESTS} tests$" || true)
    if [ -n "$WRONG_CLAIMS" ]; then
      fail "README test-count claims disagree with actual npm test ($ACTUAL_TESTS):"
      echo "$WRONG_CLAIMS" | sed 's/^/    /'
    else
      pass "README test-count claims match actual ($ACTUAL_TESTS tests)"
    fi
  fi
fi

# --- 5. Version consistency across files -------------------------------------

check_version_in() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  local found
  found=$(grep -E "$pattern" "$file" 2>/dev/null | head -1 || true)
  if [ -z "$found" ]; then
    return
  fi
  if echo "$found" | grep -q "$CANON_VERSION"; then
    pass "$label matches canonical version $CANON_VERSION"
  else
    fail "$label does NOT match canonical version $CANON_VERSION:"
    echo "    $found"
  fi
}

check_version_in "package.json" '"version"' "package.json version"
check_version_in "plugins/agent-review-panel/eval-suite.json" '"version"' "agent-review-panel eval-suite version"
check_version_in "plugins/agent-review-panel/skills/agent-review-panel/SKILL.md" '^# Agent Review Panel v' "SKILL.md h1 header"

# SKILL.md HTML footer instruction (v2.16.4+ requires full semver match)
FOOTER_LINE=$(grep 'HTML footer should read "Agent Review Panel v' plugins/agent-review-panel/skills/agent-review-panel/SKILL.md || true)
if [ -n "$FOOTER_LINE" ]; then
  if echo "$FOOTER_LINE" | grep -q "$CANON_VERSION"; then
    pass "SKILL.md HTML footer instruction matches canonical version"
  else
    fail "SKILL.md HTML footer instruction does NOT match canonical version $CANON_VERSION:"
    echo "    $FOOTER_LINE"
  fi
fi

# Marketplace entry version — match by the current plugin name (auto-detected above)
MP_ENTRY_VERSION=$(grep -A3 "\"name\": \"${PLUGIN_NAME}\"" .claude-plugin/marketplace.json | grep '"version"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/' || true)
if [ -n "$MP_ENTRY_VERSION" ] && [ "$MP_ENTRY_VERSION" != "$CANON_VERSION" ]; then
  fail "marketplace.json ${PLUGIN_NAME} entry version ($MP_ENTRY_VERSION) does NOT match canonical ($CANON_VERSION)"
elif [ -n "$MP_ENTRY_VERSION" ]; then
  pass "marketplace.json ${PLUGIN_NAME} entry version matches canonical"
fi

# --- 6. ROADMAP has a row for the canonical version --------------------------

if grep -qE "^\| v${CANON_VERSION}[[:space:]]*\|" ROADMAP.md; then
  pass "ROADMAP.md has a row for v$CANON_VERSION"
else
  fail "ROADMAP.md has NO row for v$CANON_VERSION — version table frozen"
fi

# --- 7. CHANGELOG has a section for the canonical version --------------------

if grep -qE "^## \[${CANON_VERSION}\]" CHANGELOG.md; then
  pass "CHANGELOG.md has a section for [${CANON_VERSION}]"
else
  fail "CHANGELOG.md has NO section for [${CANON_VERSION}] — changelog frozen"
fi

# --- Summary -----------------------------------------------------------------

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "🎉 All release-check assertions passed."
  exit 0
else
  echo "💥 Release-check found drift. Fix the failures above before tagging a release."
  exit 1
fi
