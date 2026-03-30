#!/usr/bin/env bash
# =============================================================================
# record-demo.sh — Record a terminal GIF demo of the agent-review-panel skill.
#
# This script checks for recording tools and generates a polished GIF showing
# the full agent-review-panel workflow (context scan -> review -> debate ->
# scoring -> claim verification -> verdict).
#
# INSTALL VHS (preferred):
#   brew install charmbracelet/tap/vhs
#
# RUN:
#   ./docs/record-demo.sh
#
# OUTPUT:
#   docs/demo.gif  (approx 15-20s, 960x540, 15fps)
#
# CUSTOMIZE:
#   Edit docs/demo.tape to change:
#     - Output path/format (.gif, .mp4, .webm)
#     - Terminal size (Set Width / Set Height)
#     - Theme (Set Theme — any base16 name, e.g. "Dracula")
#     - Typing speed (Set TypingSpeed)
#     - Frame rate (Set FrameRate — 15 is good for GIF size)
#
# OPTIMAL SETTINGS (already set in demo.tape):
#   15 fps  |  960x540 (≈80x24 chars)  |  dark theme  |  FontSize 14
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAPE_FILE="${SCRIPT_DIR}/demo.tape"
OUTPUT_FILE="${SCRIPT_DIR}/demo.gif"

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
green()  { printf '\033[1;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[1;33m%s\033[0m\n' "$*"; }
red()    { printf '\033[1;31m%s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
# Try VHS first (preferred), then fall back to asciinema + agg
# ---------------------------------------------------------------------------
record_with_vhs() {
    green "Using VHS to record demo..."
    if [[ ! -f "$TAPE_FILE" ]]; then
        red "Error: tape file not found at ${TAPE_FILE}"
        exit 1
    fi
    vhs "$TAPE_FILE"
    green "Done! GIF saved to ${OUTPUT_FILE}"
}

install_vhs() {
    yellow "VHS not found. Attempting to install via Homebrew..."
    if ! command -v brew &>/dev/null; then
        return 1
    fi
    brew install charmbracelet/tap/vhs
}

record_with_asciinema() {
    green "Falling back to asciinema + agg..."

    local cast_file="${SCRIPT_DIR}/demo.cast"

    # Record a scripted session using asciinema
    # We pipe commands via a heredoc so it runs non-interactively.
    local script_file="${SCRIPT_DIR}/_demo_script.sh"

    cat > "$script_file" << 'DEMO'
#!/usr/bin/env bash
# Simulated demo output — not a real Claude session.
prompt() { printf '\033[1;35m❯\033[0m '; }

prompt
sleep 0.5
echo "claude"
sleep 0.8
echo ""
prompt
sleep 0.3
echo "Review this ML pipeline from multiple perspectives: pipeline.py"
sleep 1.2

echo ""
echo "━━━ Gather: Context Scan & Persona Selection ━━━"
sleep 0.5
echo ""
echo "Scanning context... detected signals:"
echo "  ● ML/Statistics (7)  ● SQL (4)  ● Data Pipeline (3)"
sleep 0.5
echo ""
echo "Auto-adding personas:"
echo "  ✦ Statistical Rigor Reviewer"
echo "  ✦ Data Quality Auditor"
echo "  ✦ Pipeline Safety Reviewer"
sleep 0.5
echo ""
echo "Mining knowledge: 3 feedback memories, 2 project lessons found"
sleep 0.8

echo ""
echo "━━━ Review: Independent Review ━━━"
sleep 0.5
echo ""
echo "Launching 6 independent reviewers in parallel..."
sleep 0.6
echo ""
echo "  [1/6] Security Reviewer         ▸ found 2 issues (1 high)"
sleep 0.2
echo "  [2/6] Statistical Rigor Reviewer ▸ found 3 issues (2 high)"
sleep 0.2
echo "  [3/6] Performance Reviewer       ▸ found 1 issue  (0 high)"
sleep 0.2
echo "  [4/6] Data Quality Auditor       ▸ found 4 issues (1 high)"
sleep 0.2
echo "  [5/6] Pipeline Safety Reviewer   ▸ found 2 issues (1 high)"
sleep 0.2
echo "  [6/6] Maintainability Reviewer   ▸ found 1 issue  (0 high)"
sleep 0.8

echo ""
echo "━━━ Debate: Adversarial Debate ━━━"
sleep 0.5
echo ""
echo '  Statistical Rigor:  "train_test_split without stratification'
echo '                       will leak class imbalance into validation."'
sleep 0.4
echo '  Pipeline Safety:    "Disagree — upstream sampling already'
echo '                       balances classes before this stage."'
sleep 0.4
echo '  Statistical Rigor:  "Show me the evidence. Line 42 reads'
echo '                       raw CSV with no prior balancing step."'
sleep 0.4
echo '  Pipeline Safety:    "Conceding — the raw ingest path is'
echo '                       unprotected. Upgrading to HIGH."'
sleep 0.8

echo ""
echo "━━━ Debate: Blind Final Scoring ━━━"
sleep 0.5
echo ""
echo "Blind final scores submitted."
echo "  Security: 6/10 | Stat Rigor: 4/10 | Perf: 8/10"
echo "  Data Quality: 5/10 | Safety: 5/10 | Maintain: 7/10"
sleep 0.6

echo ""
echo "━━━ Verify: Audit & Claim Verification ━━━"
sleep 0.5
echo ""
echo "Claim verification: 12/14 citations [VERIFIED]"
echo "                     1 [INACCURATE]  1 [UNVERIFIABLE]"
sleep 0.8

echo ""
echo "━━━ Adjudicate: Supreme Judge Verdict ━━━"
sleep 0.5
echo ""
echo "Supreme Judge rendering verdict..."
sleep 0.8
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  VERDICT: REVISE — 3 blocking issues identified     ║"
echo "║  Consensus score: 5.8 / 10                          ║"
echo "║  Top action: add stratified split + input validation ║"
echo "╚══════════════════════════════════════════════════════╝"
sleep 1.5
DEMO

    chmod +x "$script_file"

    # Record with asciinema
    asciinema rec \
        --command "bash $script_file" \
        --cols 80 \
        --rows 24 \
        --overwrite \
        "$cast_file"

    # Clean up temp script
    rm -f "$script_file"

    # Convert to GIF with agg
    if command -v agg &>/dev/null; then
        agg \
            --fps 15 \
            --theme monokai \
            --font-size 14 \
            "$cast_file" \
            "$OUTPUT_FILE"
        green "Done! GIF saved to ${OUTPUT_FILE}"
    else
        yellow "agg not found — cast file saved to ${cast_file}"
        yellow "Install agg to convert:  cargo install --git https://github.com/asciinema/agg"
        yellow "Then run:  agg --fps 15 --theme monokai ${cast_file} ${OUTPUT_FILE}"
    fi
}

install_asciinema() {
    yellow "asciinema not found. Attempting to install via Homebrew..."
    if ! command -v brew &>/dev/null; then
        return 1
    fi
    brew install asciinema
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    green "=== Agent Review Panel — Demo Recorder ==="
    echo ""

    # Strategy 1: VHS (preferred)
    if command -v vhs &>/dev/null; then
        record_with_vhs
        exit 0
    fi

    if install_vhs 2>/dev/null; then
        record_with_vhs
        exit 0
    fi

    yellow "VHS unavailable. Trying asciinema fallback..."
    echo ""

    # Strategy 2: asciinema + agg
    if ! command -v asciinema &>/dev/null; then
        if ! install_asciinema 2>/dev/null; then
            red "Error: Could not install any recording tool."
            red ""
            red "Please install one of these manually:"
            red "  brew install charmbracelet/tap/vhs    (preferred)"
            red "  brew install asciinema                (fallback)"
            exit 1
        fi
    fi

    record_with_asciinema
}

main "$@"
