# Agent Review Panel — Demo Recording
# VHS tape file for generating a terminal GIF demo.
#
# Install:  brew install charmbracelet/tap/vhs
# Run:      vhs docs/demo.tape
# Output:   docs/demo.gif
#
# Customize:
#   - Change Output to produce .mp4, .webm, or .gif
#   - Adjust Set Width/Height for different terminal sizes
#   - Adjust Sleep/Type@speed to change pacing
#   - Change Set Theme to any base16 theme (e.g., "Dracula", "Catppuccin Mocha")

# --- Terminal settings ---
Output "docs/demo.gif"
Set FontSize 14
Set Width 960
Set Height 540
Set Framerate 15
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 0

# --- Start directly with skill output (no claude launch) ---
Sleep 500ms

# --- Gather Stage (Phases 1-2): Context Scan & Persona Selection ---
Type "━━━ Gather: Context Scan & Persona Selection ━━━"
Enter
Sleep 1s

Type ""
Enter
Type "Scanning context... detected signals:"
Enter
Sleep 700ms
Type "  ● ML/Statistics (7)  ● SQL (4)  ● Data Pipeline (3)"
Enter
Sleep 1s

Type ""
Enter
Type "Auto-adding personas:"
Enter
Sleep 500ms
Type "  ✦ Statistical Rigor Reviewer"
Enter
Sleep 350ms
Type "  ✦ Data Quality Auditor"
Enter
Sleep 350ms
Type "  ✦ Pipeline Safety Reviewer"
Enter
Sleep 1s

Type ""
Enter
Type "Mining knowledge: 3 feedback memories, 2 project lessons found"
Enter
Sleep 1.5s

# --- Review Stage (Phases 3-4): Independent Review ---
Type ""
Enter
Type "━━━ Review: Independent Review ━━━"
Enter
Sleep 1s

Type ""
Enter
Type "Launching 6 independent reviewers in parallel..."
Enter
Sleep 1.2s

Type ""
Enter
Type "  [1/6] Security Reviewer         ▸ found 2 issues (1 high)"
Enter
Sleep 500ms
Type "  [2/6] Statistical Rigor Reviewer ▸ found 3 issues (2 high)"
Enter
Sleep 500ms
Type "  [3/6] Performance Reviewer       ▸ found 1 issue  (0 high)"
Enter
Sleep 500ms
Type "  [4/6] Data Quality Auditor       ▸ found 4 issues (1 high)"
Enter
Sleep 500ms
Type "  [5/6] Pipeline Safety Reviewer   ▸ found 2 issues (1 high)"
Enter
Sleep 500ms
Type "  [6/6] Maintainability Reviewer   ▸ found 1 issue  (0 high)"
Enter
Sleep 1.5s

# --- Debate Stage (Phases 5-7): Adversarial Debate ---
Type ""
Enter
Type "━━━ Debate: Adversarial Debate ━━━"
Enter
Sleep 1s

Type ""
Enter
Type "  Statistical Rigor: train_test_split without stratification"
Enter
Type "                     will leak class imbalance into validation."
Enter
Sleep 900ms
Type "  Pipeline Safety:   Disagree - upstream sampling already"
Enter
Type "                     balances classes before this stage."
Enter
Sleep 900ms
Type "  Statistical Rigor: Show me the evidence. Line 42 reads"
Enter
Type "                     raw CSV with no prior balancing step."
Enter
Sleep 900ms
Type "  Pipeline Safety:   Conceding - the raw ingest path is"
Enter
Type "                     unprotected. Upgrading to HIGH."
Enter
Sleep 1.5s

# --- Debate Stage continued: Blind Scoring ---
Type ""
Enter
Type "━━━ Debate: Blind Final Scoring ━━━"
Enter
Sleep 1s

Type ""
Enter
Type "Blind final scores submitted."
Enter
Sleep 700ms

Type "  Security: 6/10 | Stat Rigor: 4/10 | Perf: 8/10"
Enter
Type "  Data Quality: 5/10 | Safety: 5/10 | Maintain: 7/10"
Enter
Sleep 1.2s

# --- Verify Stage (Phases 8-9): Audit & Claim Verification ---
Type ""
Enter
Type "━━━ Verify: Audit & Claim Verification ━━━"
Enter
Sleep 1s

Type ""
Enter
Type "Claim verification: 12/14 citations [VERIFIED]"
Enter
Type "                     1 [INACCURATE]  1 [UNVERIFIABLE]"
Enter
Sleep 1.5s

# --- Adjudicate Stage (Phases 10-11): Supreme Judge Verdict ---
Type ""
Enter
Type "━━━ Adjudicate: Supreme Judge Verdict ━━━"
Enter
Sleep 1s

Type ""
Enter
Type "Supreme Judge rendering verdict..."
Enter
Sleep 1.5s

Type ""
Enter
Type "╔══════════════════════════════════════════════════════╗"
Enter
Type "║  VERDICT: REVISE - 3 blocking issues identified      ║"
Enter
Type "║  Consensus score: 5.8 / 10                          ║"
Enter
Type "║  Top action: add stratified split + input validation ║"
Enter
Type "╚══════════════════════════════════════════════════════╝"
Enter
Sleep 3s
