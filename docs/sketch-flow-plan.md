# v2 Animated Banner: Sketchy Art Style with Character Personality

## Context
The v1 pixel-art SVG banner was well received but lacks detail from the actual review flow (demo.gif) and uses a rigid pixel-art style. v2 redesigns from scratch with:
- **Sketch/doodle art style** with wobbly hand-drawn lines
- **Full demo.gif flow** mirrored scene-by-scene
- **Character personality** via facial expressions, body language, and accessories
- **Expanded climax moments** (debate, blind finals, judge verdict)
- **Single timeline** format (no panels — continuous story unfolding)

## Files to Create/Modify
- `docs/sketch-flow-animated.svg` — New animated SVG (main deliverable)
- `docs/sketch-flow.gif` — GIF captured from animated SVG via Puppeteer+ffmpeg
- `README.md` — Update references

## Technical Approach

### SVG Art Style: "Sketchy Doodle"
- Characters drawn as SVG `<path>` elements with slightly imperfect curves (cubic beziers with small offsets to simulate hand-drawn wobble)
- Round heads (~30px diameter circles with slight irregularity)
- Simple but expressive faces: dot eyes, curved mouth lines, eyebrows for emotion
- Body: simple oval torso + stick limbs with rounded ends
- Each character ~60-80px tall
- Color fills with hand-drawn stroke outlines (stroke-width: 1.5-2px, slightly rough)
- Warm cream background (#FAF8F4), same as v1

### Animation Strategy
- CSS `@keyframes` with **opacity-only transitions** (no CSS transforms — avoids SVG transform conflicts discovered in v1)
- Wrapper `<g>` elements for positioning, inner elements for animation classes
- Total duration: ~25 seconds
- Captured at 4fps = ~100 frames → GIF

### Character Roster with Full Personality

| Character | Accessories | Face/Expression | Body Language | Color |
|---|---|---|---|---|
| **Claude Code** (orchestrator) | Headset with antenna, slight smile | Friendly half-circle eyes, small confident grin | Stands upright, one arm gesturing forward (directing) | Blue #4A90D9 |
| **Security Reviewer** | Shield emblem on chest | Stern furrowed brows, straight mouth | Arms crossed (guarded stance) | Red #E74C3C |
| **Statistical Rigor** | Round glasses, pocket protector | Squinting analytical eyes, slight frown | Leans forward examining, one hand on chin | Purple #8E44AD |
| **Performance Reviewer** | Stopwatch dangling from hand | Wide alert eyes, neutral mouth | Bouncy posture, on tiptoes (ready to sprint) | Green #27AE60 |
| **Data Quality Auditor** | Magnifying glass held up | One eye large (through magnifier), curious raised brow | Hunched over, peering closely at something | Orange #E67E22 |
| **Pipeline Safety** | Hard hat, safety vest stripe | Cautious worried eyes, slight grimace | One hand up in "stop" gesture | Teal #1ABC9C |
| **Maintainability** | Wrench in hand | Tired/weary half-closed eyes, small sigh mouth | Slouched slightly, hand scratching head | Gray #5D6D7E |
| **Completeness Auditor** | Clipboard + red pen | Focused determined eyes, pressed lips | Ticking items off clipboard, quick movements | Dark orange #D35400 |
| **Supreme Judge** | Robe, gavel, slightly taller (1.2x) | Commanding deep-set eyes, neutral dignified mouth | Stands tall and centered, gavel raised or at rest | Navy #2C3E50 |

### Scene-by-Scene Storyboard

#### Scene 1: The Prompt (0–2s)
- Terminal-style input area with blinking cursor
- Text types out character by character: `Review this ML pipeline...`
- A code file icon sits beside it with faint syntax-highlighted lines
- **Animation**: Text appears letter by letter (opacity stagger on `<tspan>` elements)

#### Scene 2: Gather — Signal Detection (2–5s)
- Claude Code walks in from left (fade in), magnifying glass raised, friendly grin
- Signal badges pop in with slight wobble: `ML/Stats (7)` `SQL (4)` `Pipeline (3)`
- Three specialist characters enter from right one-by-one:
  - Stat Rigor adjusts glasses, peers at the signals
  - Data Quality holds magnifier up to the badges
  - Pipeline Safety arrives last, hard hat on, hand up cautiously
- Dim handwritten text: "Mining 3 memories, 2 lessons..."
- **Animation**: Characters fade in staggered; badges pop in

#### Scene 3: Independent Review (5–9s)
- All 6 reviewers spread in a row, each in their characteristic pose
- A dashed "wall" line separates each reviewer (no-cross-talk barrier)
- Each reviewer gets a thought bubble appearing one-by-one:
  - Security (arms crossed): "2 issues, 1 HIGH"
  - Stat Rigor (leaning forward): "3 issues, 2 HIGH"
  - Performance (on tiptoes): "1 issue, 0 high"
  - Data Quality (hunched, peering): "4 issues, 1 HIGH"
  - Pipeline Safety (hand up): "2 issues, 1 HIGH"
  - Maintainability (slouched): "1 issue, 0 high"
- Small scribble animation near each character's hand (writing motion via rotating line)
- **Animation**: Wall fades in, then each character + bubble staggered 0.5s apart

#### Scene 4: Adversarial Debate — EXPANDED (9–14.5s)
*This is a climax moment — gets more screen time and detail*

- The dashed walls **dissolve** (fade out)
- Stat Rigor and Pipeline Safety **step forward** (shift toward center)
- Other reviewers slide back slightly (dimmed, watching)

**Beat 1 (9–10.5s)**: Stat Rigor raises fist
- Stat Rigor: expression changes to intense (furrowed brows, open mouth)
- Speech bubble slams in: `HIGH` badge + "train_test_split without stratification"
- Small impact lines radiating from the bubble (emphasis effect)

**Beat 2 (10.5–11.5s)**: Pipeline Safety crosses arms
- Pipeline Safety: expression shifts to defiant (narrowed eyes, frown)
- Speech bubble slides in from right: `DISAGREE` + "upstream sampling already balances"

**Beat 3 (11.5–13s)**: Stat Rigor points at code
- Expression: determined, one arm extended pointing
- Speech bubble: "Show me the evidence. Line 42 reads raw CSV..."
- A small code snippet icon appears (representing the source-grounded evidence)

**Beat 4 (13–14.5s)**: Pipeline Safety concedes
- Expression changes: eyes widen, mouth shifts to accepting nod, shoulders drop
- Speech bubble: `CONCEDE` badge + "Upgrading to HIGH"
- A small "Round 1" badge floats between them
- Background reviewers show subtle reactions (some nod)

#### Scene 5: Blind Finals — EXPANDED (14.5–17s)
*Fun visual moment — all characters cover eyes*

- All 6 reviewers line up again
- **Blindfold animation**: Each character simultaneously puts hands over eyes (arms rise to face)
  - Implemented as two arm-position states (down → covering eyes) via opacity swap
- One by one, score bubbles float up above each:
  - Security: `6` (yellow)
  - Stat Rigor: `4` (red, larger/bold)
  - Performance: `8` (green)
  - Data Quality: `5` (yellow)
  - Pipeline Safety: `5` (yellow)
  - Maintainability: `7` (green)
- Label: "Blind final scores submitted"
- **Animation**: Blindfold state fades in for all, then scores pop in staggered

#### Scene 6: Verify — Audit & Claims (17–19s)
- Completeness Auditor walks in briskly (determined expression, clipboard out)
- Checkmarks animate next to a mini checklist:
  - ✓✓✓ `12/14 VERIFIED` (green checks)
  - ✗ `1 INACCURATE` (red X)
  - ? `1 UNVERIFIABLE` (yellow ?)
- Auditor's expression: satisfied nod after the checks complete
- **Animation**: Auditor fades in, then checkmarks appear one-by-one

#### Scene 7: Supreme Judge Verdict — EXPANDED (19–23s)
*The big finale — most dramatic animation*

- Scene dims slightly (other characters fade to ~40% opacity)
- Judge enters from center-bottom, larger than other characters (1.2x scale)
- Robe flowing, gavel raised, commanding expression

**Beat 1 (19–20s)**: Judge entrance
- Dramatic fade-in, other characters step aside
- Judge stands center stage, gavel held high

**Beat 2 (20–21.5s)**: Gavel slam
- Gavel comes down (two positions: raised → down, opacity swap)
- Small impact star/burst at the gavel contact point
- Screen slight "shake" effect (implemented as 2px translate oscillation on the verdict box)

**Beat 3 (21.5–23s)**: Verdict reveal
- Verdict box builds up line by line:
  ```
  ╔═══════════════════════════════╗
  ║ VERDICT: REVISE               ║
  ║ Consensus: 5.8/10             ║
  ║ Top: stratified split + ...   ║
  ╚═══════════════════════════════╝
  ```
- Box has a blue glow effect
- Background characters react:
  - Some nod (slight head tilt)
  - Stat Rigor looks satisfied (small smile)
  - Performance shrugs (neutral)

#### Scene 8: Hold + zzZ (23–25s)
- Final state holds
- Floating "zzZ" letters with gentle pulse animation
- Handwritten caption: "all while you sleep"
- Footer: "agent-review-panel — multi-agent adversarial review"

## SVG Structure

```
<svg viewBox="0 0 960 540">
  <style>/* all @keyframes fadeIn + timing classes */</style>
  <defs>/* markers, filters for glow/shadow */</defs>

  <!-- Background -->
  <rect fill="#FAF8F4"/>

  <!-- Scene 1: Prompt -->
  <g class="anim s1-*">...</g>

  <!-- Scene 2: Gather -->
  <g class="anim s2-*">...</g>

  <!-- Scenes 3-8 positioned along a horizontal timeline -->
  <!-- Each scene occupies roughly the same viewport area -->
  <!-- Previous scenes fade to ~20% opacity as new scenes take focus -->
</svg>
```

Key technical decisions:
- **Viewport**: 960x540 (16:9, good for GIF)
- **Scene transitions**: Previous scene elements fade to low opacity, new scene fades in at same position (overlay approach, not scrolling)
- **Character reuse**: Define each character as a `<g id="char-name">` with variants (normal pose, blindfolded, reacting) as separate sub-groups toggled via opacity
- **Wobbly lines**: SVG paths with hand-tuned cubic bezier control points that deviate slightly from perfect arcs
- **No CSS transforms on elements with SVG transform attributes** (lesson from v1)

## Verification
1. Open `docs/sketch-flow-animated.svg` in Chrome — verify full 25s animation plays correctly
2. Run Puppeteer capture script → verify `docs/sketch-flow.gif` has ~100 frames, ~25s duration
3. Check GIF file size is reasonable (<500KB)
4. Verify README.md references render on GitHub
