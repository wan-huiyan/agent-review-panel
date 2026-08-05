#!/usr/bin/env python3
"""Gate SKILL.md frontmatter descriptions against Claude Code's skill-listing cap.

--8<-- vendoring note (local addition; stripped before the parity hash) --8<--
Vendored from wan-huiyan/context-police, scripts/check_skill_descriptions.py.
Do not edit locally -- fix it upstream and re-vendor, so every repo's gate agrees.

PROVENANCE, exactly:
    upstream commit  c413fd4  (on context-police main)
    upstream version 2.3.0    -- a plugin.json/marketplace version, NOT a git tag.
                                 Upstream's newest tag is v2.0.0; there is no v2.x.y tag
                                 for any of 2.2.0 / 2.2.1 / 2.2.2 / 2.3.0.
    upstream sha256  f72dcfabcca18c6936153c6d5c117f0f982ae649ea468b11a52d2b57e99d079c
    re-vendored      2026-08-05

    This file is byte-identical to that upstream revision apart from this note, which
    sits between the --8<-- markers so a parity test can strip it and hash the rest.
    Pin that digest. Do NOT guard this file with a feature-presence grep: a test named
    "not a stale fork" that asserted find_wrap_corruption/compare_descriptions/
    `MAX_DESC_CHARS - 1)` were present stayed GREEN on a copy that genuinely was one,
    because the drift was inside a function whose name never changed.

WHAT CHANGED IN v2.3.0 (from v2.2.1, commit eedad0f):
    1. Wrap corruption is now scored over EVERY skill, disabled included, and fails the
       build. It was scoped to the model-invocable subset, so a hyphen break inside a
       `disable-model-invocation: true` skill was neither printed nor failed. In a repo
       where 74 of 94 skills are disabled that made CI blind to most of it -- which is
       why four real corruptions there had to be found via --json. Disabled hits print
       in their own group.

       IF THIS TURNS YOUR CI RED, the corruption was always there and was being hidden.
       Fix the description; do not re-scope the check.

    2. New NO HEADROOM tier (MIN_HEADROOM = 40), separate from APPROACHING CAP. Exit
       code unchanged -- under the cap is not a failure, however tight.

    3. --json gains min_headroom, counts.critical_headroom, and per-skill
       critical / headroom. counts.wrap_corruption now spans all skills, matching the
       text report.

    The cap arithmetic has not changed since v2.2.0: `desc_chars - (MAX_DESC_CHARS - 1)`.
    No "N chars discarded" figure moves.
--8<-- end vendoring note --8<--

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

# The floor implied by the trimming procedure's "leave 30-50 chars of headroom". A
# description under this is reported separately from the broad WARN_FRACTION bucket:
# 0.75 of 1536 is 1,152, so that bucket spans everything from 340 chars of slack down
# to 1, and the genuinely urgent cases disappear into it.
MIN_HEADROOM = 40


@dataclass
class Skill:
    path: str
    name: str
    desc_chars: int      # description [+ " - " + whenToUse], uncapped
    entry_chars: int     # what the listing actually spends, after the cap
    disabled: bool
    triggers: list       # quoted phrases -- the skill's explicit trigger vocabulary
    lost_triggers: list  # those falling past the cut, invisible to the model
    wrap_corruption: list  # hyphenated tokens split across folded-scalar lines

    @property
    def over(self) -> bool:
        return not self.disabled and self.desc_chars > MAX_DESC_CHARS

    @property
    def warn(self) -> bool:
        return (not self.disabled and not self.over
                and self.desc_chars > MAX_DESC_CHARS * WARN_FRACTION)

    @property
    def headroom(self) -> int:
        """Characters that can still be added before the description is truncated."""
        return MAX_DESC_CHARS - self.desc_chars

    @property
    def critical(self) -> bool:
        """Under the cap, but too close to survive the next edit.

        WARN_FRACTION alone lumps a description with 3 chars of headroom in with one
        that has 340 -- same colour, same bucket, no ordering. This repo's own skill sat
        at cap-3 inside that bucket while publishing "leave 30-50 chars of headroom",
        and nothing distinguished it. MIN_HEADROOM is the floor that rule implies.
        """
        return not self.disabled and not self.over and self.headroom < MIN_HEADROOM

    @property
    def truncated_chars(self) -> int:
        """Characters the model never sees.

        The harness keeps `full[:cap-1]` and appends an ellipsis, so the dead tail is
        `desc_chars - (cap - 1)`, one MORE than the naive `desc_chars - cap`. Reporting
        the naive figure undercounts every over-cap skill by exactly one character.
        """
        if not self.over:
            return 0
        return self.desc_chars - (MAX_DESC_CHARS - 1)


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


# Words that turn a standalone trigger into a conditional one. If one of these appears
# between a trigger phrase and its clause head AFTER a rewrite but not before, the trigger
# now only matches users who already satisfy an extra precondition -- a narrowed surface.
_RESTRICTORS = (
    "whose", "provided that", "provided", "only if", "only when", "unless", "assuming",
    "given that", "so long as", "as long as", "where the", "in which the", "if the", "if it",
)


def find_wrap_corruption(fm: str) -> list[str]:
    """Detect hyphenated tokens split across lines of a folded/block YAML scalar.

    `description: >` and `description: |` join their lines with a SPACE. So a line ending
    in a hyphen silently becomes `high- stakes` in the text the harness injects. The usual
    cause is re-wrapping with textwrap.wrap(), which breaks on hyphens by DEFAULT -- pass
    break_on_hyphens=False. This corrupts exactly the hyphenated compounds that tend to be
    trigger phrases ("token-efficient review", "high-stakes", "stress-test"), and no
    length check can see it because the char count is unchanged.
    """
    hits = []
    # Match the WHOLE block header, including any chomping (`>-`, `|+`) or explicit-indent
    # (`|2`) indicator. Stopping the match at the `|`/`>` leaves the chomping character
    # behind as a phantom one-character line `-`, which then trips the hyphen test below
    # and reports a bogus hit on every skill written with the very common `description: >-`.
    m = re.search(r"^(description|whenToUse|when_to_use):[ \t]*[|>][-+]?\d*[ \t]*$", fm, re.M)
    if not m:
        return hits
    # Stay inside the block body: stop at the first non-indented line, which is the next key.
    body = []
    for line in fm[m.end():].splitlines():
        if line.strip() and not line[:1].isspace():
            break
        if line.strip():
            body.append(line)
    lines = body
    for i, line in enumerate(lines[:-1]):
        stripped = line.strip()
        if not stripped.endswith("-"):
            continue
        nxt = lines[i + 1].strip()
        if nxt and nxt[0].isalnum():
            tail = stripped.split()[-1] if stripped.split() else stripped
            head = nxt.split()[0] if nxt.split() else nxt
            hits.append(f"{tail} {head}")
    return hits


def _clause_around(text: str, phrase: str, window: int = 110) -> str:
    """The sentence-ish span a phrase sits in -- enough context to see its condition."""
    i = text.find(phrase)
    if i == -1:
        return ""
    start = max(0, i - window)
    for sep in (". ", "; ", " -- ", " — "):
        j = text.rfind(sep, start, i)
        if j != -1:
            start = max(start, j + len(sep))
    end = min(len(text), i + len(phrase) + window)
    for sep in (". ", "; ", " -- ", " — "):
        j = text.find(sep, i + len(phrase), end)
        if j != -1:
            end = min(end, j)
    return text[start:end].strip()


def compare_descriptions(old: str, new: str) -> dict:
    """Diff two descriptions at the level of TRIGGER SURFACE, not word overlap.

    Word-overlap scoring is structurally blind to the most damaging trim regression:
    restructuring `trigger on X -- and separately, watch for Y` into `trigger on X WHOSE Y`
    preserves the exact same word set, so any bag-of-words metric scores it identically,
    while the trigger now only fires for users who have already diagnosed Y.

    This compares each trigger phrase's surrounding clause instead, and flags:
      dropped    -- phrase present before, gone after (or pushed past the cut)
      narrowed   -- a restrictor word appeared in the phrase's clause that was not there before
      reworded   -- the clause changed materially but no restrictor was introduced
    All three are REVIEWER FLAGS, not verdicts: `narrowed` in particular needs a human read.
    """
    old_vis = old if len(old) <= MAX_DESC_CHARS else old[:MAX_DESC_CHARS - 1]
    new_vis = new if len(new) <= MAX_DESC_CHARS else new[:MAX_DESC_CHARS - 1]

    out = {"dropped": [], "narrowed": [], "reworded": [], "rephrased": [],
           "added": [], "kept": 0}

    old_tr = extract_triggers(old_vis)
    new_tr = extract_triggers(new_vis)

    # Pair each old trigger with its new counterpart. Exact match first, then a
    # content-word overlap match -- otherwise a pure rephrasing ("I want thorough
    # feedback from different angles" -> "thorough feedback from different angles")
    # reports as one DROPPED plus one ADDED, and the noise buries the real losses.
    def key(s: str) -> set:
        filler = {"i", "want", "a", "an", "the", "this", "that", "get", "give", "me",
                  "to", "of", "on", "for", "with", "from", "and", "or", "it", "my",
                  "can", "you", "please", "some", "do", "have"}
        return {w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in filler}

    unmatched_new = list(new_tr)
    pairs, dropped = [], []
    new_exact = {t.lower(): t for t in new_tr}

    for t in old_tr:
        if t.lower() in new_exact:
            m = new_exact[t.lower()]
            pairs.append((t, m, True))
            if m in unmatched_new:
                unmatched_new.remove(m)
            continue
        ok = key(t)
        best, best_score = None, 0.0
        for c in unmatched_new:
            ck = key(c)
            if not ok or not ck:
                continue
            score = len(ok & ck) / len(ok | ck)
            if score > best_score:
                best, best_score = c, score
        if best is not None and best_score >= 0.5:
            pairs.append((t, best, False))
            unmatched_new.remove(best)
        else:
            dropped.append(t)

    out["dropped"] = dropped
    out["added"] = unmatched_new

    for t, m, exact in pairs:
        if not exact:
            out["rephrased"].append({"trigger": t, "now": m})
            continue
        before, after = _clause_around(old_vis, t), _clause_around(new_vis, t)
        if before == after:
            out["kept"] += 1
            continue
        gained = [w for w in _RESTRICTORS
                  if w in after.lower() and w not in before.lower()]
        if gained:
            out["narrowed"].append({"trigger": t, "gained": gained,
                                    "before": before, "after": after})
        else:
            out["reworded"].append({"trigger": t, "before": before, "after": after})

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
    # The harness only truncates when the description EXCEEDS the cap; at or under it the
    # whole string is shown (l7_ in the binary is `len > cap ? slice(0, cap-1) + "…" : t`).
    # Slicing unconditionally would falsely report the final characters of an exactly-at-cap
    # description as lost.
    kept = full if len(full) <= MAX_DESC_CHARS else full[:MAX_DESC_CHARS - 1]
    lost = [] if disabled else [t for t in triggers if t not in kept]

    return Skill(path=path, name=name, desc_chars=len(full),
                 entry_chars=entry, disabled=disabled,
                 triggers=triggers, lost_triggers=lost,
                 wrap_corruption=find_wrap_corruption(fm))


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

    # Wrap corruption is scored over EVERY skill, disabled included. The cap check
    # legitimately skips disabled skills -- they consume no listing budget. Corruption is
    # different: it is a text-integrity defect, the description is still read when the
    # skill is invoked by name, and it ships corrupt the moment the skill is re-enabled.
    # Scoping this to `live` is why four real corruptions in agent-traffic-control sat
    # unseen -- all four were in manual-only skills, so CI never looked at them.
    corrupt = [s for s in skills if s.wrap_corruption]
    if corrupt:
        n = sum(len(s.wrap_corruption) for s in corrupt)
        print(paint(f"  BROKEN BY LINE-WRAP ({n}) — a folded/block scalar joins lines with a "
                    f"SPACE, so these tokens are corrupt in the injected text", red))
        for label, group in (("model-invocable", [s for s in corrupt if not s.disabled]),
                             ("disabled", [s for s in corrupt if s.disabled])):
            if not group:
                continue
            print(f"    {paint(label + ':', dim)}")
            for s in group:
                for h in s.wrap_corruption:
                    print(f"      {s.name}:  {paint(h, yellow)}")
        cause = ("Cause: textwrap.wrap() breaks on hyphens by default — "
                 "pass break_on_hyphens=False.")
        print("  " + paint(cause, dim))
        print()

    lost_total = sum(len(s.lost_triggers) for s in over)
    if lost_total:
        print(paint(f"  {lost_total} trigger phrase"
                    f"{'s are' if lost_total != 1 else ' is'} past the cut and "
                    f"invisible to the model right now.", red))
        if not show_triggers:
            print(f"  {paint('Re-run with --triggers to list them.', dim)}")
        print()

    critical = sorted((s for s in warn if s.critical), key=lambda s: s.headroom)
    if critical:
        print(paint(f"  NO HEADROOM ({len(critical)}) — under {MIN_HEADROOM} chars to spare; "
                    f"the next edit truncates trigger text", red))
        for s in critical:
            print(f"    {s.headroom:>4} left  ({s.desc_chars:>5,} chars)  {s.name}")
        print()

    rest = [s for s in warn if not s.critical]
    if rest:
        print(paint(f"  APPROACHING CAP ({len(rest)}) — over "
                    f"{int(WARN_FRACTION * 100)}% of the limit", yellow))
        for s in rest:
            print(f"    {s.desc_chars:>6,} chars  {s.name}  ({s.headroom} left)")
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

    return 1 if (over or corrupt) else 0


def _load_description(spec: str) -> str | None:
    """Read a description from a file path or a `git-ref:path` spec."""
    text = None
    if ":" in spec and not os.path.exists(spec):
        ref, _, path = spec.partition(":")
        import subprocess
        r = subprocess.run(["git", "show", f"{ref}:{path}"],
                           capture_output=True, text=True)
        if r.returncode == 0:
            text = r.stdout
    if text is None:
        try:
            text = open(spec, encoding="utf-8", errors="replace").read()
        except OSError:
            return None
    fm = _split_frontmatter(text)
    if fm is None:
        return None
    desc = _scalar(fm, "description")
    when = _scalar(fm, "whenToUse") or _scalar(fm, "when_to_use")
    return f"{desc} - {when}" if when else desc


def _run_compare(old_spec: str, new_spec: str, as_json: bool, color: bool) -> int:
    old, new = _load_description(old_spec), _load_description(new_spec)
    for spec, val in ((old_spec, old), (new_spec, new)):
        if val is None:
            print(f"error: could not read a description from {spec}", file=sys.stderr)
            return 2

    d = compare_descriptions(old, new)
    if as_json:
        print(json.dumps({"old_chars": len(old), "new_chars": len(new), **d}, indent=2))
        return 1 if (d["dropped"] or d["narrowed"]) else 0

    def paint(s, c):
        return f"\033[{c}m{s}\033[0m" if color else s

    print(f"trigger-surface diff  ·  {len(old):,} → {len(new):,} chars  ·  "
          f"{d['kept']} triggers unchanged\n")

    if d["dropped"]:
        print(paint(f"  DROPPED ({len(d['dropped'])}) — gone from the visible description", "31"))
        for t in d["dropped"]:
            print(f"    · {t}")
        print()
    if d["narrowed"]:
        print(paint(f"  NARROWED ({len(d['narrowed'])}) — a precondition appeared; the trigger "
                    f"now fires for fewer users", "31"))
        for n in d["narrowed"]:
            print(f"    · {n['trigger']}   {paint('gained: ' + ', '.join(n['gained']), '33')}")
            print(f"        before: {n['before'][:150]}")
            print(f"        after:  {n['after'][:150]}")
        print()
    if d["rephrased"]:
        print(f"  REPHRASED ({len(d['rephrased'])}) — same concept, different wording (usually fine)")
        for n in d["rephrased"][:8]:
            print(f"    · {n['trigger']}  →  {n['now']}")
        if len(d["rephrased"]) > 8:
            print(f"    … and {len(d['rephrased']) - 8} more")
        print()
    if d["reworded"]:
        print(paint(f"  REWORDED ({len(d['reworded'])}) — clause changed, no precondition added; "
                    f"read to confirm meaning held", "33"))
        for n in d["reworded"][:8]:
            print(f"    · {n['trigger']}")
        if len(d["reworded"]) > 8:
            print(f"    … and {len(d['reworded']) - 8} more")
        print()
    if d["added"]:
        print(f"  ADDED ({len(d['added'])}): " + ", ".join(d["added"][:8]))
        print()

    if not d["dropped"] and not d["narrowed"]:
        print(paint("  No trigger dropped or narrowed.", "32"))
    print("\n  NOTE: word-overlap/coverage scoring cannot see NARROWED or REWORDED — the word\n"
          "  set is unchanged. Those rows need a human read; do not clear them with a metric.")
    return 1 if (d["dropped"] or d["narrowed"]) else 0


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
    ap.add_argument("--compare", nargs=2, metavar=("OLD", "NEW"),
                    help="compare two SKILL.md revisions at the trigger-surface level; "
                         "flags dropped/narrowed/reworded triggers that word-overlap "
                         "scoring cannot see. Use OLD=git-ref:path or a file path.")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--no-color", action="store_true", help="disable ANSI color")
    args = ap.parse_args()

    MAX_DESC_CHARS = args.max_chars

    if args.compare:
        return _run_compare(args.compare[0], args.compare[1], args.json,
                            not args.no_color and sys.stdout.isatty())

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
                       # Counted over ALL skills, disabled included -- corruption is a
                       # text-integrity defect, not a listing-budget one, and matching
                       # the text report's exit code keeps the two forms consistent.
                       "wrap_corruption": sum(len(s.wrap_corruption) for s in skills),
                       "critical_headroom": sum(1 for s in live if s.critical),
                       "lost_triggers": sum(len(s.lost_triggers) for s in live)},
            "min_headroom": MIN_HEADROOM,
            "skills": [asdict(s) | {"over": s.over, "warn": s.warn,
                                    "critical": s.critical, "headroom": s.headroom}
                       for s in sorted(skills, key=lambda s: -s.desc_chars)],
        }, indent=2))
        return 1 if any(s.over or s.wrap_corruption for s in skills) else 0

    use_color = not args.no_color and sys.stdout.isatty() and not os.environ.get("NO_COLOR")
    return report(skills, args.context, use_color, show_triggers=args.triggers)


if __name__ == "__main__":
    sys.exit(main())
