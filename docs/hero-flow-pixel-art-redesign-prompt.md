# Hero diagram → 16-bit pixel-art redesign — handoff prompt

This is a self-contained brief to hand to a design session ("claude design"). It redesigns the
README hero diagram (`docs/hero-flow.svg`) as a **16-bit / SNES-era pixel-art** illustration.
Everything the designer needs — corrected facts, layout, palette, acceptance criteria — is below.
Copy from the `---` line down.

---

## Brief

Redesign the **Agent Review Panel** hero diagram in **16-bit / SNES-era pixel art**. It is the first
image in the repo's README (a GitHub-rendered `<img>`), so it must read instantly at ~880px wide
and look crisp at any zoom. It replaces the current vector diagram at `docs/hero-flow.svg`.

**What it depicts:** a multi-agent adversarial code-review *pipeline* — your code/plan goes in on the
left, flows through review stages, and a final arbitrated report comes out on the right.

## Style: 16-bit SNES pixel art (hard requirements)

- **True pixel art** — every shape snaps to a pixel grid. Build "pixels" as equal-size `<rect>`s
  (7px works well) on a fixed grid; reuse characters via `<g transform="translate(x,y)">`.
- **NO anti-aliasing, NO gradients, NO blur/glow/drop-shadow filters.** (The current SVG leans on
  `feGaussianBlur` glow and radial gradients — drop all of that. That's what makes it *vector*, not
  pixel art.) Shade with **dithering** (checkerboard / Bayer pixel patterns), not smooth gradients.
- **16-bit palette:** ~32–48 colors total. Richer than 8-bit (you may dither for depth and shading),
  but still a tight, deliberate palette — no photographic blends.
- **Background:** deep/dark, to match the repo's dark-themed README and make accent colors pop.
  Use the brand charcoal `#0d1117` or a SNES-era deep indigo (e.g. `#16182e`). Panels/cards a step
  lighter (`#1c2030` / `#21262d`).
- **Reviewers as little specialist sprites** (8–12 px tall), each tinted by its semantic color.
- **Legibility first.** This is a functional diagram, not just decoration — stage labels and the
  output panel must be readable at README scale. Use a crisp pixel/monospace-style font for labels;
  keep captions short.

## Color semantics — preserve these exactly (they carry meaning)

| Color | Meaning | Suggested hex |
|---|---|---|
| 🟢 Green | Verified / Agreed / pass | `#3fb950` |
| 🔴 Red | Critical / blocking | `#f85149` |
| 🟡 Yellow | Disputed / caution | `#d29922` |
| 🔵 Blue | Primary flow / the Judge | `#388bfd` / `#58a6ff` |
| 🟣 Purple | Blind / anti-bias step | `#bc8cff` |

## Information architecture to preserve

Left-to-right flow with a tall output panel on the right, plus a stage "breadcrumb" along the bottom.
Keep this structure; restyle it as pixel art:

```
  ┌────────┐   ┌──────────┐  ┌──────────┐  ┌──────────┐         ┌──────────────┐
  │  CODE  │→ │  GATHER   │→│  REVIEW   │→│  DEBATE   │ ─┐      │  REVIEW       │
  │ / PLAN │   │ context & │  │ 4–6       │  │ adversarial│  │      │  REPORT       │
  │ (input)│   │ setup     │  │ reviewers │  │ + finals  │  │      │  ───────────  │
  └────────┘   └──────────┘  └──────────┘  └──────────┘  │      │  Exec summary │
                                                          ▼      │  Consensus    │
               ┌──────────┐  ┌──────────┐  ┌──────────┐         │  Action items │
               │  VERIFY   │→│ ADJUDICATE│→ ( output ) ─────────▶│  Scope/limits │
               │ audit +   │  │ Supreme   │                      │  legend       │
               │ claim-check│  │ Judge (Opus)│                    └──────────────┘
               └──────────┘  └──────────┘

  Bottom breadcrumb:  GATHER → REVIEW → DEBATE → VERIFY → ADJUDICATE → REPORT
```

**Nodes (use these stage names — NOT phase numbers, see "Accuracy" below):**

1. **Input** — "Your Code / Plan".
2. **Gather** — context & setup: signal detection, persona selection, knowledge mining.
3. **Review** — independent review: **4–6 reviewers in parallel, no cross-talk** (show 4–6 sprites).
4. **Debate** — adversarial debate (1–3 rounds) + blind final scoring (anti-groupthink; a
   blindfold/hidden-eye motif works for the "blind finals" beat).
5. **Verify** — completeness audit + claim/severity verification (shield-and-check motif; VERIFIED /
   CRITICAL chips).
6. **Adjudicate** — **Supreme Judge** (Opus) arbitrates; scales-of-justice motif; emits epistemic
   labels (DISPUTED / AGREED).
7. **Output** — the tall **Review Report** panel: Executive Summary, Consensus, Action Items
   (with VERIFIED/CRITICAL chips), Scope & Limitations, and a small color legend.

Bottom breadcrumb pills, left→right: **Gather → Review → Debate → Verify → Adjudicate → Report**.

## Accuracy — do NOT reintroduce stale facts

The current diagram (and an older pixel attempt) are stale; the whole point of this redesign is to
get them right:

- ❌ **Do not print a phase count like "10-Phase Pipeline" or per-node phase numbers** ("Gather 1–2",
  "Adjudicate 10–11"). The pipeline has grown (it's currently ~16 internal phases) and any baked-in
  number rots. **Label by stage name only.** If you want a subtitle, use
  *"Multi-Agent Adversarial Code Review Pipeline"* — no number.
- ✅ **"4–6 reviewers in parallel" is correct** — keep it.
- ✅ Reviewer archetypes to depict (pick ~6): Correctness, Security, Performance, Data/SQL,
  Architecture, Risk, ML/Stats. (Exact set is flexible; 4–6 sprites total.)

## Optional — nod to VoltAgent (nice-to-have, don't crowd the diagram)

Reviewers can be backed by installed **VoltAgent specialist agents** (a Security Auditor becomes a
real `voltagent-qa-sec:security-auditor`). If it fits cleanly, hint that reviewer sprites are
"specialist-backed" — e.g. a tiny badge/pin on a sprite, or a one-line caption. Skip it if it adds
clutter; legibility of the core flow wins.

## Reference assets in this repo

- **`docs/hero-flow.svg`** (current, on `main`) — the information architecture to preserve. Its
  stale phase strings have already been fixed on the working branch; use it for *layout*, not style.
- **`docs/pixel-flow.svg`** on branch **`feat/pixel-art-banner`** — an earlier pixel attempt with a
  reusable **reviewer-sprite + orchestrator-sprite vocabulary** you can borrow. Caveats: it's a
  *light/cream* theme (we want dark here) and its labels are badly stale ("Phase 1–2 / 3–4 / 5–6") —
  reuse the sprites, not the theme or the labels.

## Deliverable

- **Format:** a **rect-grid pixel-art SVG** (preferred — version-controllable, sharp at any zoom,
  matches repo convention). A raster PNG at 2× is acceptable as a fallback.
- **Dimensions:** wide hero, roughly **2:1** (e.g. `960×480` or keep the current `900×520`). Tight
  viewBox, ~10px padding, no wasted margin.
- **Filename:** `docs/hero-flow-pixel.svg` (so it can sit beside the current one during review).
- A small corner watermark "agent-review-panel" is fine (the current diagram has one).

## Acceptance checklist

- [ ] Reads clearly at ~880px wide on a GitHub README (light + dark GitHub themes).
- [ ] True pixel art: no anti-aliasing, gradients, blur, or glow filters; shading via dithering.
- [ ] 16-bit palette (~32–48 colors), dark background, semantic colors intact (green/red/yellow/blue/purple as above).
- [ ] **No phase-count number and no per-node phase numbers** anywhere; stage-name labels only.
- [ ] Left→right flow + tall output report panel + bottom stage breadcrumb all present.
- [ ] "4–6 reviewers in parallel" depicted; 4–6 reviewer sprites.
- [ ] Tight viewBox, ~2:1, no wasted space.
