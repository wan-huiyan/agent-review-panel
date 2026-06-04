#!/usr/bin/env bash
#
# voltagent-catalog-check.sh — detect VoltAgent mapping drift against the
# vendored catalog snapshot (references/voltagent-catalog.json).
#
# WHAT IT CHECKS
#   1. DANGLING (fails, exit 1): every `voltagent-<family>:<slug>` referenced in
#      the LIVE skill files resolves to a real family + agent in the snapshot.
#      A failure means upstream renamed/removed an agent the skill still names —
#      fix the mapping (or refresh the snapshot if the agent legitimately moved).
#   2. UNMAPPED (informational, never fails): agents present in the snapshot that
#      no live skill file references — candidates you *could* add a signal rule
#      for. Pure FYI; most are non-content-signal agents (meta/research/biz).
#
# Runtime availability is detected live by the skill at launch (Step 1) and
# degrades gracefully to generic personas — so a stale mapping never breaks a
# run. This check only keeps the documented catalog honest.
#
# Frozen-history files (changelog.md, references/changelog.md, docs/) are NOT
# scanned: they intentionally preserve old ids that may since have been renamed.
#
# Usage:
#   bash scripts/voltagent-catalog-check.sh            # human-readable
#   bash scripts/voltagent-catalog-check.sh --quiet    # only print on drift
#
# To regenerate the snapshot after legitimate upstream changes:
#   bash scripts/refresh-voltagent-catalog.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QUIET="${1:-}"

python3 - "$REPO_ROOT" "$QUIET" <<'PY'
import json, os, re, sys

repo, quiet = sys.argv[1], (sys.argv[2] == "--quiet")
snap_path = os.path.join(repo, "skills/agent-review-panel/references/voltagent-catalog.json")

with open(snap_path) as fh:
    snap = json.load(fh)
fam = snap["families"]
real = {f"{ns}:{slug}" for ns, slugs in fam.items() for slug in slugs}

# LIVE files only — frozen history (changelogs, docs/) intentionally excluded.
live_files = [
    "skills/agent-review-panel/SKILL.md",
    "skills/plan-review-integrator/SKILL.md",
    "skills/agent-review-panel/eval-suite.json",
    "skills/agent-review-panel/references/prompt-templates.md",
]

ref_re = re.compile(r"voltagent-[a-z-]+:[a-z0-9.][a-z0-9.\-]*")
refs = {}  # ref -> set(files)
for rel in live_files:
    p = os.path.join(repo, rel)
    if not os.path.exists(p):
        continue
    text = open(p, encoding="utf-8").read()
    for m in ref_re.findall(text):
        refs.setdefault(m, set()).add(rel)

dangling = sorted(r for r in refs if r not in real)
referenced = set(refs)
unmapped = sorted(a for a in real if a not in referenced)

def out(*a):
    if not quiet:
        print(*a)

out("VoltAgent catalog drift check")
out(f"  snapshot:   {snap['_provenance']['snapshot_date']} "
    f"(marketplace v{snap['_provenance']['marketplace_version']}, "
    f"{snap['_provenance']['total_agents']} agents / {snap['_provenance']['families']} families)")
out(f"  live refs:  {len(referenced)} distinct across {len(live_files)} files")
out("")

if dangling:
    print("❌ DANGLING references (referenced in skill, absent from snapshot):")
    for d in dangling:
        files = ", ".join(sorted(refs[d]))
        print(f"   {d}   <- {files}")
    print("")
    print("   Fix the mapping, or run refresh-voltagent-catalog.sh if the agent")
    print("   legitimately moved/renamed upstream.")
    sys.exit(1)

out("✅ No dangling references — every voltagent id in the live skill files exists in the snapshot.")

if not quiet:
    by_fam = {}
    for a in unmapped:
        ns, slug = a.split(":", 1)
        by_fam.setdefault(ns, []).append(slug)
    print("")
    print(f"ℹ️  Unmapped agents (in catalog, not referenced) — {len(unmapped)} of {len(real)}:")
    print("   (informational — candidates for new signal rules; many are non-signal agents)")
    for ns in sorted(by_fam):
        print(f"   {ns}: {', '.join(by_fam[ns])}")
PY
