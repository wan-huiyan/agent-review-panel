# Sketch-Flow Animated SVG — Handoff & Fix Plan

## File
`docs/sketch-flow-animated.svg` — 960x540 viewport, ~62s CSS animation, 8 scenes.

## Architecture

### Animation Pattern
- **CSS `@keyframes`** with opacity-only transitions (no CSS transforms — they conflict with SVG `transform` attributes)
- Scene wrappers: `<g class="hide sN-in">` (fade in) with inner `<g class="sN-out">` (fade out)
- Scenes overlay in the same viewport position — each fades in as the previous fades out
- Total: 62s, captured at 4fps = 248 frames → GIF

### Character Design
- SVG `<path>` cubic beziers with slight imperfections (hand-drawn wobble)
- ~60-80px tall at scale 1.0 (head ~32px, torso ~32px, legs ~20px)
- Each character has unique accessories (glasses, shield, hard hat, wrench, magnifying glass, etc.)
- Color-coded per persona: Red=#E74C3C, Purple=#8E44AD, Green=#27AE60, Orange=#E67E22, Teal=#1ABC9C, Gray=#5D6D7E

### Scene Timing
| Scene | Phase | Time | Duration |
|---|---|---|---|
| 1. Prompt | — | 0–2.5s | 2.5s |
| 2. Context Scan | Gather | 2.5–8s | 5.5s |
| 3. Independent Review | Review | 8–15s | 7s |
| 3.5. Private Reflection | Review | 15–21s | 6s |
| 4. Adversarial Debate (3 rounds) | Debate | 21–39s | 18s |
| 5. Blind Final Scoring | Debate | 39–45s | 6s |
| 6. Claim Verification | Verify | 45–50s | 5s |
| 7. Supreme Judge Verdict | Adjudicate | 50–57s | 7s |
| 8. Hold + zzZ | — | 57–62s | 5s |

## GIF Capture Pipeline
1. Start preview server: `npx http-server docs -p 3847 --cors`
2. Puppeteer headless Chrome: `page.setViewport({width:960, height:540})`, navigate to SVG, screenshot every 250ms (4fps)
3. ffmpeg 2-pass: `palettegen` → `paletteuse` with bayer dithering
4. Output: `docs/sketch-flow.gif` (~630KB)
5. Script was deleted after capture; recreate as `docs/capture-gif.cjs` (ESM project, must use `.cjs`)

## Known Spacing Issues (from visual review on 2026-03-31)

### PRIORITY 1: Scene 5 — Blind Final Scoring (39–45s)

**Current layout:**
```
y=50:   Title "BLIND FINAL SCORING"
y=105:  Row 1 score bubbles (r=24, so y=81–129)
y=170:  Row 1 blindfolded characters (head r=24, so y=146–194)
y=260:  Row 1 name labels
y=275:  Row 2 score bubbles (r=24, so y=251–299)
y=340:  Row 2 blindfolded characters (head r=24, so y=316–364)
y=430:  Row 2 name labels
y=490:  "Blind final scores submitted."
y=540:  viewport bottom (50px unused)
```

**Problems:**
1. Score bubbles (bottom at y=129) are only 17px from character heads (top at y=146) — looks cramped
2. Row 1 names at y=260 are 66px below character feet (y=194) but only 10px above Row 2 score tops (y=251) — sandwiched
3. Bottom 50px is wasted

**Fix plan:**
- Move title up to y=40
- Move Row 1 scores to y=80 (bottom at y=104)
- Keep Row 1 characters at y=160 (gap: 56px from scores — comfortable)
- Move Row 1 labels to y=248
- Move Row 2 scores to y=275 (keep)
- Move Row 2 characters to y=350 (gap: 51px from scores)
- Move Row 2 labels to y=438
- Move "submitted" to y=480
- Net: better vertical distribution across full 540px

### PRIORITY 2: Scene 4 — Adversarial Debate, all 3 rounds (21–39s)

**Current layout (per round):**
```
y=70:   Title "ADVERSARIAL DEBATE"
y=110:  Both characters (left at x=60, right at x=860), ~90px tall → feet at y=194
y=205:  Character name labels
y=125:  Speech bubble 1 (from left character)
y=185:  Speech bubble 2 (from right character)
y=248:  Speech bubble 3 (from left character)
y=310:  Speech bubble 4 (from right character)
y=375:  Round badge
y=540:  viewport bottom (165px unused!)
```

**Problems:**
1. Character name labels at y=205 are too close to character feet at y=194 (11px gap)
2. Right character at x=860 — "Maintainability" text at x=882 center is safe but tight on right edge
3. Speech bubbles start at y=125 which overlaps with character head area (character head at y=110)
4. ~165px of empty space below Round badge at y=375

**Fix plan — Option A (characters at top, spread speech bubbles):**
- Move characters up to y=90 (keep them compact at top)
- Move name labels to y=190 (still tight but workable since characters are at top)
- Push speech bubbles down: bubble 1 at y=145, bubble 2 at y=210, bubble 3 at y=280, bubble 4 at y=350
- Move Round badge to y=420
- This fills the viewport better vertically

**Fix plan — Option B (characters at sides, full-height speech column):**
- Move characters to y=220 (vertically centered)
- Make speech bubbles the full center column from y=80 to y=440
- This maximizes the debate content area

### PRIORITY 3: Scene 3.5 — Private Reflection (15–21s)

**Current layout:**
```
y=38:   Title
y=58:   Subtitle
y=75:   Thought bubbles (height 90px, so y=75–165)
y=175:  Cloud connectors
y=310:  Characters (scale 0.9, ~76px tall → feet at y=386)
y=405:  Character name labels
y=540:  viewport bottom (135px unused)
```

**Problems:**
1. 145px gap between cloud connectors (y=190) and characters (y=310) — too much empty space
2. 135px unused below character names
3. Could center the whole layout vertically better

**Fix plan:**
- Move thought bubbles to y=80 (keep)
- Move characters to y=240 (gap from connectors: ~50px — comfortable)
- Move labels to y=335
- Net: content spans y=38–335 (297px), centered in 540px viewport

### PRIORITY 4: Scene 3 — Independent Review (8–15s)

**Current layout looks good** — 2x3 grid with dashed walls. Minor:
- Horizontal divider at y=250 is centered, both rows use space well
- No action needed unless the user sees issues

### Scenes 2, 6, 7, 8 — No major issues
- Scene 2 (Context Scan): well-structured dashboard layout
- Scene 6 (Verify): recently pushed down to center vertically
- Scene 7 (Judge): recently pushed down to center vertically
- Scene 8 (Hold): just zzZ text + footer, minimal elements

## Technical Notes

### Critical: No CSS transforms on SVG elements
SVG `transform="translate(x,y) scale(s)"` attributes on `<g>` elements must NOT be animated with CSS `transform`. CSS transforms and SVG transforms occupy the same slot — CSS will override SVG's, breaking positioning. Use **opacity-only** CSS animations.

### Scene stacking pattern
Every scene must have both `sN-in` (fade in) AND `sN-out` (fade out) wrappers:
```xml
<g class="hide sN-in">          <!-- fades in at scene start -->
  <g class="sN-out" style="opacity:1;">  <!-- fades out at scene end -->
    <!-- scene content -->
  </g>
</g>
```
The `style="opacity:1;"` on the out-wrapper prevents it from being invisible before the out animation triggers.

### Character reuse
Characters are fully duplicated per scene (not `<use>` refs) because each scene needs different poses, positions, and scales. When editing a character, remember to update ALL copies if the base design changes.

### Viewport utilization target
The viewport is 960x540. Content should use roughly y=30–510 (480px usable). No element should extend past x=940 (right padding).

### Debugging scene timing
The hardest part of working with this SVG is verifying specific scenes — CSS animations play in real time, so you must wait for the scene's start time to see it. The Claude Preview MCP's `preview_screenshot` requires sleeping the right number of seconds after page load. Account for ~2s page load time.

Workaround: temporarily modify the CSS timing for the scene you're editing to start at 0s, verify visually, then restore original timing.

## Files

| File | Purpose |
|---|---|
| `docs/sketch-flow-animated.svg` | Main animated SVG (edit this) |
| `docs/sketch-flow.gif` | GIF capture of above (regenerate after SVG edits) |
| `docs/demo-output.sh` | Terminal demo script (colored ANSI output) |
| `docs/demo.tape` | VHS tape for generating `demo.gif` from `demo-output.sh` |
| `docs/demo.gif` | Terminal demo GIF (regenerate via `vhs docs/demo.tape`) |
| `docs/hero-flow.svg` | Static pipeline architecture diagram (dark theme) |
| `README.md` | Uses `sketch-flow.gif` as banner, `demo.gif` in collapsible section |

## Regeneration Commands

```bash
# 1. Preview SVG in browser
npx http-server docs -p 3847 --cors
# Open: http://localhost:3847/sketch-flow-animated.svg

# 2. Capture sketch-flow.gif (requires puppeteer + ffmpeg)
npm install puppeteer  # if not installed (uses .cjs due to ESM project)
# Create docs/capture-gif.cjs with:
#   - Puppeteer: viewport 960x540, navigate to localhost:3847/sketch-flow-animated.svg
#   - Screenshot every 250ms (4fps) for 62s = 248 frames
#   - ffmpeg 2-pass: palettegen + paletteuse with bayer dithering
#   - Output: docs/sketch-flow.gif
node docs/capture-gif.cjs

# 3. Regenerate demo.gif (requires VHS: brew install charmbracelet/tap/vhs)
vhs docs/demo.tape
```

## Verification Checklist

After making edits, verify each scene by:
1. Start the preview server
2. Navigate to `/sketch-flow-animated.svg`
3. Wait N seconds (account for ~2s page load): Scene 2 at 3s, Scene 3 at 10s, Scene 3.5 at 16s, Scene 4 at 24s, Scene 5 at 41s, Scene 6 at 47s, Scene 7 at 53s
4. Take screenshot
5. Confirm: no text/character overlap, content centered vertically, no right-edge clipping
6. Recapture GIF after all edits are verified
