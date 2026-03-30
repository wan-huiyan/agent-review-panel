#!/bin/bash
# Colored terminal demo output for VHS GIF recording.
# Run via: bash docs/demo-output.sh
# Or via VHS: vhs docs/demo.tape

# --- ANSI color codes ---
RST='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
# Foreground
CYAN='\033[36m'
BCYAN='\033[1;36m'
BYELLOW='\033[1;33m'
BRED='\033[1;31m'
BGREEN='\033[1;32m'
BMAGENTA='\033[1;35m'
BBLUE='\033[1;34m'
BWHITE='\033[1;37m'
GRAY='\033[90m'
WHITE='\033[37m'
# Background badges
BG_RED='\033[41;97m'
BG_GREEN='\033[42;30m'
BG_YELLOW='\033[43;30m'
BG_BLUE='\033[44;97m'
BG_MAGENTA='\033[45;97m'
BG_CYAN='\033[46;30m'

# Simulate typing the user prompt
prompt="Review this ML pipeline from multiple perspectives: src/pipeline/"
for ((i=0; i<${#prompt}; i++)); do
    printf "%s" "${prompt:$i:1}"
    sleep 0.03
done
printf "\n"
sleep 2

# ── Gather ──
printf "\n"
printf "${BCYAN}━━━ Gather: Context Scan & Persona Selection ━━━${RST}\n"
sleep 1

printf "\n"
printf "Scanning context... detected signals:\n"
printf "  ${BBLUE}● ML/Statistics${RST} (7)  ${BGREEN}● SQL${RST} (4)  ${BYELLOW}● Data Pipeline${RST} (3)\n"
sleep 1

printf "\n"
printf "Auto-adding personas:\n"
printf "  ${BMAGENTA}✦ Statistical Rigor Reviewer${RST}\n"
sleep 0.35
printf "  ${BMAGENTA}✦ Data Quality Auditor${RST}\n"
sleep 0.35
printf "  ${BMAGENTA}✦ Pipeline Safety Reviewer${RST}\n"
sleep 1

printf "\n"
printf "${DIM}Mining knowledge: 3 feedback memories, 2 project lessons found${RST}\n"
sleep 1.5

# ── Review ──
printf "\n"
printf "${BCYAN}━━━ Review: Independent Review (6 agents in parallel) ━━━${RST}\n"
sleep 1

printf "\n"
printf "  ${GRAY}[1/6]${RST} ${BYELLOW}Security Reviewer${RST}         ${DIM}▸${RST} found ${BWHITE}2${RST} issues (${BRED}1 high${RST})\n"
sleep 0.5
printf "  ${GRAY}[2/6]${RST} ${BYELLOW}Statistical Rigor Reviewer${RST} ${DIM}▸${RST} found ${BWHITE}3${RST} issues (${BRED}2 high${RST})\n"
sleep 0.5
printf "  ${GRAY}[3/6]${RST} ${BYELLOW}Performance Reviewer${RST}       ${DIM}▸${RST} found ${BWHITE}1${RST} issue  (${GRAY}0 high${RST})\n"
sleep 0.5
printf "  ${GRAY}[4/6]${RST} ${BYELLOW}Data Quality Auditor${RST}       ${DIM}▸${RST} found ${BWHITE}4${RST} issues (${BRED}1 high${RST})\n"
sleep 0.5
printf "  ${GRAY}[5/6]${RST} ${BYELLOW}Pipeline Safety Reviewer${RST}   ${DIM}▸${RST} found ${BWHITE}2${RST} issues (${BRED}1 high${RST})\n"
sleep 0.5
printf "  ${GRAY}[6/6]${RST} ${BYELLOW}Maintainability Reviewer${RST}   ${DIM}▸${RST} found ${BWHITE}1${RST} issue  (${GRAY}0 high${RST})\n"
sleep 1.5

# ── Debate ──
printf "\n"
printf "${BCYAN}━━━ Debate: Adversarial Debate (Round 1) ━━━${RST}\n"
sleep 1

printf "\n"
printf "  ${BYELLOW}Statistical Rigor:${RST} ${BG_RED} HIGH ${RST} train_test_split without stratification\n"
printf "                     will leak class imbalance into validation.\n"
sleep 0.9
printf "  ${BGREEN}Pipeline Safety:${RST}   ${BG_YELLOW} DISAGREE ${RST} upstream sampling already\n"
printf "                     balances classes before this stage.\n"
sleep 0.9
printf "  ${BYELLOW}Statistical Rigor:${RST} Show me the evidence. Line 42 reads\n"
printf "                     raw CSV with no prior balancing step.\n"
sleep 0.9
printf "  ${BGREEN}Pipeline Safety:${RST}   ${BG_MAGENTA} CONCEDE ${RST} the raw ingest path is\n"
printf "                     unprotected. ${BRED}Upgrading to HIGH.${RST}\n"
sleep 1.5

# ── Blind Finals ──
printf "\n"
printf "${BCYAN}━━━ Debate: Blind Final Scoring ━━━${RST}\n"
sleep 1

printf "\n"
printf "Blind final scores submitted.\n"
sleep 0.7
printf "  Security: ${BYELLOW}6${RST}/10 | Stat Rigor: ${BRED}4${RST}/10 | Perf: ${BGREEN}8${RST}/10\n"
printf "  Data Quality: ${BYELLOW}5${RST}/10 | Safety: ${BYELLOW}5${RST}/10 | Maintain: ${BGREEN}7${RST}/10\n"
sleep 1.2

# ── Verify ──
printf "\n"
printf "${BCYAN}━━━ Verify: Audit & Claim Verification ━━━${RST}\n"
sleep 1

printf "\n"
printf "Claim verification: 12/14 citations ${BG_GREEN} VERIFIED ${RST}\n"
printf "                     1 ${BG_RED} INACCURATE ${RST}  1 ${BG_YELLOW} UNVERIFIABLE ${RST}\n"
sleep 1.5

# ── Adjudicate ──
printf "\n"
printf "${BCYAN}━━━ Adjudicate: Supreme Judge Verdict ━━━${RST}\n"
sleep 1

printf "\n"
printf "${DIM}Supreme Judge rendering verdict...${RST}\n"
sleep 1.5

printf "\n"
printf "${BBLUE}╔══════════════════════════════════════════════════════╗${RST}\n"
printf "${BBLUE}║${RST}  ${BOLD}VERDICT:${RST} ${BG_RED} REVISE ${RST} ${BWHITE}3 blocking issues identified${RST}      ${BBLUE}║${RST}\n"
printf "${BBLUE}║${RST}  Consensus score: ${BRED}5.8${RST} / 10                           ${BBLUE}║${RST}\n"
printf "${BBLUE}║${RST}  Top action: ${BGREEN}add stratified split + input validation${RST}  ${BBLUE}║${RST}\n"
printf "${BBLUE}╚══════════════════════════════════════════════════════╝${RST}\n"
sleep 6
