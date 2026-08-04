#!/usr/bin/env python3
"""Gate SKILL.md frontmatter descriptions against Claude Code's skill-listing cap.

    Vendored from wan-huiyan/context-police (scripts/check_skill_descriptions.py).
    Keep in sync with upstream rather than editing locally.

WHY THIS EXISTS
    Claude Code injects every model-invocable skill's name + description into
    context on EVERY turn (and into every subagent). Two limits govern it, both
    read out of the v2.1.221 binary:

      skillListingMaxDescChars   default 1536   per-skill description cap
      skillListingBudgetFraction default 0.01   listing budget = ctx * 4 * 0.01 chars

    A description over the per-skill cap is TRUNCATED mid-sentence -- the model
    reads a half-sentence about when to use the skill. Worse, oversized entries
    are charged against a shared budget: the harness walks skills by priority and
    collapses whichever no longer fit down to bare names. So one bloated
    description does not just hurt its own skill, it silently strips the
    descriptions off OTHER skills that would have fit.

    Nothing warns you. The skill still works, still shows up, still fires when
    named -- the model just stops being able to see what it is for.

    This is NOT the same thing as SKILL.md body size (what `schliff score`
    measures). The body lazy-loads only when the skill fires. The description is
    resident on every turn. A file can pass one check and fail the other.

WHAT IT CHECKS
    Per skill:  len(name) + len(description [+ " - " + whenToUse])  vs the cap.
    Overall:    total listing size vs the budget for a given context window.
    Triggers:   which quoted trigger phrases fall past the cut and are therefore
                INVISIBLE to the model right now.

    Skills carrying `disable-model-invocation: true` are skipped -- they never
    enter the listing, so their description costs nothing.

THE TRIGGER CHECK IS THE POINT
    A description is trigger text: it is how the model decides to reach for the
    skill at all. When the harness truncates at the cap it does not truncate
    intelligently -- it cuts mid-word at char 1535 and drops everything after.
    Any "use when the user says ..." phrase living past that point is already
    dead: the skill will not fire on it, and nothing reports the loss.

    So the safety question for trimming a description is inverted. The
    descriptions are ALREADY cut. The only choice is whether YOU decide what
    survives, or the harness decides by character position. `--triggers` shows
    exactly which phrases are being lost, so a deliberate trim can be verified
    to preserve every one of them.

USAGE
    python3 check_skill_descriptions.py PATH [PATH...]
    python3 check_skill_descriptions.py . --triggers
    python3 check_skill_descriptions.py . --context 1000000
    python3 check_skill_descriptions.py . --json

    Exit 0 = clean, 1 = at least one skill over the cap (use as a CI gate),
    2 = a path argument does not exist.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, asdict

# --- Claude Code constants, read from the v2.1.221 binary --------------------
# i7_ = 1536 -- skillListingMaxDescChars default
MAX_DESC_CHARS = 1536
# Jud = 4 -- bytesPerToken used to size the listing budget
CHARS_PER_TOKEN = 4
# n7_ = 0.01 -- skillListingBudgetFraction default
BUDGET_FRACTION = 0.01
# o7_ = 200000 -- the default context window the budget is sized against
DEFAULT_CONTEXT = 200_000

# Entry overhead in the listing: name + 4 chars with a description, name + 2 bare.
ENTRY_OVERHEAD = 4
BARE_OVERHEAD = 2

# Warn before the cliff, so a description that is one edit from truncating
# gets flagged while it is still cheap to fix.
WARN_FRACTION = 0.75


@dataclass
class Skill:
    path: str
    name: str
    desc_chars: int      # description [+ " - " + whenToUse], uncapped
    entry_chars: int     # what the listing actually spends, after the cap
    disabled: bool
    triggers: list       # quoted phrases -- the skill's explicit trigger vocabulary
    lost_triggers: list  # those falling past the cut, invisible to the model

    @property
    def over(self) -> bool:
        return not self.disabled and self.desc_chars > MAX_DESC_CHARS

    @property
    def warn(self) -> bool:
        return (not self.disabled and not self.over
                and self.desc_chars > MAX_DESC_CHARS * WARN_FRACTION)

    @property
    def truncated_chars(self) -> int:
        return max(0, self.desc_chars - MAX_DESC_CHARS)


def _split_frontmatter(text: str) -> str | None:
    """Return the raw YAML frontmatter block, or None if absent."""
    if not text.startswith("---"):
        return None
    # The opening --- must be its own line.
    first_nl = text.find("\n")
    if first_nl == -1 or text[3:first_nl].strip():
        return None
    end = re.search(r"^---\s*$", text[first_nl + 1:], re.M)
    if not end:
        return None
    return text[first_nl + 1: first_nl + 1 + end.start()]


def _scalar(fm: str, key: str) -> str:
    """Read one YAML scalar, handling plain, quoted, block (|) and folded (>).

    Deliberately hand-rolled: a CI gate that needs `pip install pyyaml` gets
    skipped, and this only has to read three known keys.
    """
    m = re.search(rf"^{re.escape(key)}:[ \t]*(.*)$", fm, re.M)
    if not m:
        return ""
    head = m.group(1).strip()

    # Block/folded scalar: value is the indented lines that follow.
    if head[:1] in ("|", ">"):
        lines = fm[m.end():].splitlines()
        body: list[str] = []
        for line in lines[1:] if lines and not lines[0].strip() else lines:
            if line.strip() and not line[:1].isspace():
                break                      # dedented -> next key
            body.append(line.strip())
        joined = " ".join(p for p in body if p)
        return re.sub(r"\s+", " ", joined).strip()

    if not head:
        return ""

    # Quoted scalar -- strip the matching pair only.
    if len(head) >= 2 and head[0] == head[-1] and head[0] in ("'", '"'):
        head = head[1:-1]

    # Plain multi-line scalar: continuation lines are indented.
    tail = []
    for line in fm[m.end():].splitlines()[1:]:
        if not line.strip() or not line[:1].isspace():
            break
        tail.append(line.strip())
    if tail:
        head = head + " " + " ".join(tail)

    return re.sub(r"\s+", " ", head).strip()


def extract_triggers(text: str) -> list[str]:
    """Pull the explicit trigger vocabulary out of a description.

    Skill authors write triggers as quoted phrases -- `when the user says "run
    twice"`. Those quoted spans are the highest-signal, lowest-ambiguity part of
    a description: they are the literal words a user types. Straight and curly
    quotes both occur in the wild.
    """
    found = re.findall(r'"([^"\n]{3,80})"|“([^”\n]{3,80})”', text)
    out, seen = [], set()
    for a, b in found:
        phrase = (a or b).strip()
        # A quoted span containing a sentence break is prose, not a trigger.
        if not phrase or "." in phrase[:-1]:
            continue
        if phrase.lower() not in seen:
            seen.add(phrase.lower())
            out.append(phrase)
    return out


def parse_skill(path: str) -> Skill | None:
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    except OSError:
        return None

    fm = _split_frontmatter(text)
    if fm is None:
        return None

    name = _scalar(fm, "name") or os.path.basename(os.path.dirname(path))
    desc = _scalar(fm, "description")
    when = _scalar(fm, "whenToUse") or _scalar(fm, "when_to_use")

    # Mirrors the harness's own fBt(): whenToUse is appended to the description
    # with " - " and the pair shares one cap.
    full = f"{desc} - {when}" if when else desc

    disabled = re.search(r"^disable-model-invocation:\s*true\s*$", fm,
                         re.M | re.I) is not None

    entry = (len(name) + BARE_OVERHEAD if disabled
             else len(name) + ENTRY_OVERHEAD + min(len(full), MAX_DESC_CHARS))

    triggers = extract_triggers(full)
    # The harness keeps full[:cap-1] and appends an ellipsis (l7_ in the binary).
    kept = full[:MAX_DESC_CHARS - 1]
    lost = [] if disabled else [t for t in triggers if t not in kept]

    return Skill(path=path, name=name, desc_chars=len(full),
                 entry_chars=entry, disabled=disabled,
                 triggers=triggers, lost_triggers=lost)


def collect(roots: list[str]) -> list[Skill]:
    skills: list[Skill] = []
    seen: set[str] = set()
    for root in roots:
        if os.path.isfile(root):
            paths = [root]
        else:
            paths = []
            for dirpath, dirnames, filenames in os.walk(root):
                dirnames[:] = [d for d in dirnames
                               if d not in {".git", "node_modules", "__pycache__"}]
                if "SKILL.md" in filenames:
                    paths.append(os.path.join(dirpath, "SKILL.md"))
        for p in sorted(paths):
            real = os.path.realpath(p)
            if real in seen:
                continue
            seen.add(real)
            s = parse_skill(p)
            if s:
                skills.append(s)
    return skills


def report(skills: list[Skill], context: int, use_color: bool,
           show_triggers: bool = False) -> int:
    def paint(s: str, code: str) -> str:
        return f"\033[{code}m{s}\033[0m" if use_color else s

    red, yellow, green, dim = "31", "33", "32", "2"

    live = [s for s in skills if not s.disabled]
    over = sorted((s for s in live if s.over), key=lambda s: -s.desc_chars)
    warn = sorted((s for s in live if s.warn), key=lambda s: -s.desc_chars)

    print(f"skill-desc-gate  ·  cap {MAX_DESC_CHARS:,} chars/skill  ·  "
          f"{len(skills)} SKILL.md ({len(live)} model-invocable, "
          f"{len(skills) - len(live)} disabled)\n")

    if over:
        print(paint(f"  OVER CAP ({len(over)}) — description is truncated "
                    f"mid-sentence in the listing", red))
        for s in over:
            trig = ""
            if s.lost_triggers:
                trig = "  " + paint(
                    f"{len(s.lost_triggers)}/{len(s.triggers)} triggers LOST", red)
            print(f"    {s.desc_chars:>6,} chars  "
                  f"({paint(f'+{s.truncated_chars:,} cut', red)})  {s.name}{trig}")
            print(f"    {'':>6}         {paint(s.path, dim)}")
            if show_triggers and s.lost_triggers:
                for t in s.lost_triggers:
                    print(f"    {'':>6}         {paint('· invisible: ' + t, yellow)}")
        print()

    lost_total = sum(len(s.lost_triggers) for s in over)
    if lost_total:
        print(paint(f"  {lost_total} trigger phrase"
                    f"{'s are' if lost_total != 1 else ' is'} past the cut and "
                    f"invisible to the model right now.", red))
        if not show_triggers:
            print(f"  {paint('Re-run with --triggers to list them.', dim)}")
        print()

    if warn:
        print(paint(f"  APPROACHING CAP ({len(warn)}) — over "
                    f"{int(WARN_FRACTION * 100)}% of the limit", yellow))
        for s in warn:
            print(f"    {s.desc_chars:>6,} chars  {s.name}")
        print()

    total = sum(s.entry_chars for s in live) + max(0, len(live) - 1)
    budget = int(context * CHARS_PER_TOKEN * BUDGET_FRACTION)
    bare = sum(len(s.name) + BARE_OVERHEAD for s in live) + max(0, len(live) - 1)

    print(f"  Listing budget @ {context:,} ctx")
    print(f"    needed   {total:>8,} chars  (~{total // CHARS_PER_TOKEN:,} tok)")
    print(f"    budget   {budget:>8,} chars  (~{budget // CHARS_PER_TOKEN:,} tok)")

    if total <= budget:
        print(paint(f"    fits, {budget - total:,} chars to spare", green))
    else:
        room = max(0, budget - bare)
        pct = (room / (total - bare) * 100) if total > bare else 0.0
        print(paint(f"    OVER by {total - budget:,} chars — the harness will "
                    f"collapse descriptions to bare names", red))
        print(f"    {paint(f'~{pct:.0f}% of descriptions survive', yellow)}"
              f"; the rest of your skills show as names only")

    if over:
        reclaim = sum(s.truncated_chars for s in over)
        print(f"\n  Trimming the {len(over)} over-cap description"
              f"{'s' if len(over) != 1 else ''} removes {reclaim:,} wasted chars "
              f"that are being written and then thrown away.")
        if lost_total:
            print(f"  A trim that keeps every trigger phrase inside the cap "
                  f"{paint('restores', green)} the {lost_total} lost above — "
                  f"re-run until this section is empty.")

    return 1 if over else 0


def main() -> int:
    global MAX_DESC_CHARS
    ap = argparse.ArgumentParser(
        description="Fail when a SKILL.md description exceeds Claude Code's "
                    "skill-listing cap.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="exit 0 = clean · exit 1 = at least one description over the cap")
    ap.add_argument("paths", nargs="*", default=["."],
                    help="files or directories to scan (default: .)")
    ap.add_argument("--context", type=int, default=DEFAULT_CONTEXT,
                    help=f"context window to size the budget against "
                         f"(default: {DEFAULT_CONTEXT:,})")
    ap.add_argument("--max-chars", type=int, default=MAX_DESC_CHARS,
                    help=f"override the per-skill cap (default: {MAX_DESC_CHARS})")
    ap.add_argument("--triggers", action="store_true",
                    help="list the quoted trigger phrases lost to truncation")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--no-color", action="store_true", help="disable ANSI color")
    args = ap.parse_args()

    MAX_DESC_CHARS = args.max_chars

    paths = args.paths or ["."]

    # A typo'd path must not pass silently -- that would turn the CI gate into a
    # no-op that still reports success.
    missing = [p for p in paths if not os.path.exists(p)]
    if missing:
        for p in missing:
            print(f"error: no such path: {p}", file=sys.stderr)
        return 2

    skills = collect(paths)
    if not skills:
        print("no SKILL.md found (nothing to check)", file=sys.stderr)
        return 0

    if args.json:
        live = [s for s in skills if not s.disabled]
        total = sum(s.entry_chars for s in live) + max(0, len(live) - 1)
        budget = int(args.context * CHARS_PER_TOKEN * BUDGET_FRACTION)
        print(json.dumps({
            "cap": MAX_DESC_CHARS,
            "context": args.context,
            "budget_chars": budget,
            "listing_chars": total,
            "within_budget": total <= budget,
            "counts": {"total": len(skills), "model_invocable": len(live),
                       "disabled": len(skills) - len(live),
                       "over_cap": sum(1 for s in live if s.over),
                       "lost_triggers": sum(len(s.lost_triggers) for s in live)},
            "skills": [asdict(s) | {"over": s.over, "warn": s.warn}
                       for s in sorted(skills, key=lambda s: -s.desc_chars)],
        }, indent=2))
        return 1 if any(s.over for s in skills) else 0

    use_color = not args.no_color and sys.stdout.isatty() and not os.environ.get("NO_COLOR")
    return report(skills, args.context, use_color, show_triggers=args.triggers)


if __name__ == "__main__":
    sys.exit(main())
