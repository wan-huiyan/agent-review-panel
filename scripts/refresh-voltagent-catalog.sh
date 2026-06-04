#!/usr/bin/env bash
#
# refresh-voltagent-catalog.sh — regenerate the vendored VoltAgent catalog snapshot.
#
# The skill's persona/signal mapping tables reference VoltAgent agents by their
# `voltagent-<family>:<slug>` subagent_type id. Those ids are hand-maintained
# editorial choices (which specialist reviews which signal) — but whether a
# referenced agent still EXISTS upstream is a fact that can drift when VoltAgent
# renames/removes/adds agents. We vendor a point-in-time snapshot of the catalog
# so `voltagent-catalog-check.sh` (and the node test) can detect dangling refs in
# CI, where the VoltAgent marketplace is NOT installed.
#
# This script reads the LOCALLY INSTALLED voltagent-subagents marketplace and
# rewrites references/voltagent-catalog.json. Run it when you suspect upstream
# drift (e.g. quarterly, or when the catalog-check reports unmapped agents you
# want to map). README.md files are excluded — they are docs, not agents.
#
# Usage:
#   bash scripts/refresh-voltagent-catalog.sh
#   VOLTAGENT_MARKETPLACE=/path/to/voltagent-subagents bash scripts/refresh-voltagent-catalog.sh
#
# Requires the marketplace to be installed (claude plugin marketplace add
# VoltAgent/awesome-claude-code-subagents). Exits non-zero if not found.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO_ROOT/skills/agent-review-panel/references/voltagent-catalog.json"
MKT="${VOLTAGENT_MARKETPLACE:-$HOME/.claude/plugins/marketplaces/voltagent-subagents}"

if [[ ! -f "$MKT/.claude-plugin/marketplace.json" ]]; then
  echo "ERROR: voltagent-subagents marketplace not found at: $MKT" >&2
  echo "Install it with: claude plugin marketplace add VoltAgent/awesome-claude-code-subagents" >&2
  echo "Or point VOLTAGENT_MARKETPLACE at a checkout." >&2
  exit 1
fi

SNAPSHOT_DATE="$(date +%F)"

python3 - "$MKT" "$OUT" "$SNAPSHOT_DATE" <<'PY'
import json, os, sys
mkt, out, snap_date = sys.argv[1], sys.argv[2], sys.argv[3]
meta = json.load(open(os.path.join(mkt, ".claude-plugin", "marketplace.json")))
mkt_version = meta.get("metadata", {}).get("version", "unknown")

families = {}
total = 0
for p in meta["plugins"]:
    ns = p["name"]                       # e.g. voltagent-core-dev
    src = os.path.join(mkt, p["source"]) # e.g. .../categories/01-core-development
    slugs = sorted(
        os.path.splitext(f)[0]
        for f in os.listdir(src)
        if f.endswith(".md") and f != "README.md"
    )
    families[ns] = slugs
    total += len(slugs)

doc = {
    "_provenance": {
        "source_repo": "github.com/VoltAgent/awesome-claude-code-subagents",
        "source_marketplace": "voltagent-subagents",
        "marketplace_version": mkt_version,
        "snapshot_date": snap_date,
        "method": "scripts/refresh-voltagent-catalog.sh — lists *.md (README excluded) under each plugin's source dir in the locally installed marketplace",
        "total_agents": total,
        "families": len(families),
        "note": "README.md is excluded (docs, not agents). This is a drift-detection reference only; runtime availability is still detected live per the skill's Step 1.",
    },
    "families": families,
}
with open(out, "w") as fh:
    json.dump(doc, fh, indent=2)
    fh.write("\n")
print(f"Wrote {out}")
print(f"  marketplace version: {mkt_version}")
print(f"  families: {len(families)}   total agents (README excluded): {total}")
PY
