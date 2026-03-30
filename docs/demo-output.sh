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
sleep 3

# ── Gather ──
printf "\n"
printf "${BCYAN}━━━ Gather: Context Scan & Persona Selection ━━━${RST}\n"
sleep 1.6

printf "\n"
printf "Scanning context... detected signals:\n"
printf "  ${BBLUE}● ML/Statistics${RST} (7)  ${BGREEN}● SQL${RST} (4)  ${BYELLOW}● Data Pipeline${RST} (3)\n"
sleep 1.6

printf "\n"
printf "Persona → VoltAgent specialist mapping:\n"
printf "  ${BMAGENTA}✦ Statistical Rigor${RST}    → ${DIM}voltagent-data-ai:data-scientist${RST}\n"
sleep 0.6
printf "  ${BMAGENTA}✦ Data Quality Auditor${RST} → ${DIM}voltagent-qa-sec:code-reviewer${RST}\n"
sleep 0.6
printf "  ${BMAGENTA}✦ Pipeline Safety${RST}      → ${DIM}voltagent-infra:devops-engineer${RST}\n"
sleep 1.6

printf "\n"
printf "Tiered knowledge mining:\n"
printf "  ${BBLUE}L0${RST} index scan → 12 files  ${BMAGENTA}L1${RST} summaries → 4 relevant  ${BGREEN}L2${RST} full content → 2 loaded\n"
printf "  ${DIM}3 feedback memories, 2 project lessons found${RST}\n"
sleep 2.4

# ── Review ──
printf "\n"
printf "${BCYAN}━━━ Review: Independent Review (6 agents in parallel) ━━━${RST}\n"
sleep 1.6

printf "\n"
printf "  ${GRAY}[1/6]${RST} ${BYELLOW}Security Reviewer${RST}         ${DIM}▸${RST} found ${BWHITE}2${RST} issues (${BRED}1 high${RST})\n"
sleep 0.8
printf "  ${GRAY}[2/6]${RST} ${BYELLOW}Statistical Rigor Reviewer${RST} ${DIM}▸${RST} found ${BWHITE}3${RST} issues (${BRED}2 high${RST})\n"
sleep 0.8
printf "  ${GRAY}[3/6]${RST} ${BYELLOW}Performance Reviewer${RST}       ${DIM}▸${RST} found ${BWHITE}1${RST} issue  (${GRAY}0 high${RST})\n"
sleep 0.8
printf "  ${GRAY}[4/6]${RST} ${BYELLOW}Data Quality Auditor${RST}       ${DIM}▸${RST} found ${BWHITE}4${RST} issues (${BRED}1 high${RST})\n"
sleep 0.8
printf "  ${GRAY}[5/6]${RST} ${BYELLOW}Pipeline Safety Reviewer${RST}   ${DIM}▸${RST} found ${BWHITE}2${RST} issues (${BRED}1 high${RST})\n"
sleep 0.8
printf "  ${GRAY}[6/6]${RST} ${BYELLOW}Maintainability Reviewer${RST}   ${DIM}▸${RST} found ${BWHITE}1${RST} issue  (${GRAY}0 high${RST})\n"
sleep 2.4

# ── Private Reflection ──
printf "\n"
printf "${BCYAN}━━━ Review: Private Reflection ━━━${RST}\n"
printf "${DIM}each reviewer re-reads source, rates confidence${RST}\n"
sleep 1.6

printf "\n"
printf "  ${BYELLOW}Stat Rigor:${RST}     [train_test_split]: ${BGREEN}High${RST}  [class weights]: ${BYELLOW}Medium${RST}  ${BBLUE}NEW:${RST} batch norm missing\n"
sleep 0.8
printf "  ${BYELLOW}Security:${RST}       [SQL injection]: ${BGREEN}High${RST}  [auth bypass]: ${BRED}Low${RST} ${DIM}— false pos?${RST}\n"
sleep 0.8
printf "  ${BYELLOW}Data Quality:${RST}   [null joins]: ${BGREEN}High${RST}  [schema drift]: ${BYELLOW}Medium${RST}\n"
sleep 0.8
printf "  ${BYELLOW}Pipeline Safety:${RST} [retry logic]: ${BGREEN}High${RST}  [timeout]: ${BYELLOW}Medium${RST}\n"
sleep 0.8
printf "  ${BYELLOW}Performance:${RST}    [batch size]: ${BYELLOW}Medium${RST}  ${DIM}no new issues${RST}\n"
sleep 0.8
printf "  ${BYELLOW}Maintainability:${RST} [coupling]: ${BYELLOW}Medium${RST}  ${DIM}no new issues${RST}\n"
sleep 2.4

# ── Debate ──
printf "\n"
printf "${BCYAN}━━━ Debate: Adversarial Debate (Round 1 of 3) ━━━${RST}\n"
sleep 1.6

printf "\n"
printf "  ${BYELLOW}Statistical Rigor:${RST} ${BG_RED} HIGH ${RST} train_test_split without stratification\n"
printf "                     will leak class imbalance into validation.\n"
sleep 1.5
printf "  ${BGREEN}Pipeline Safety:${RST}   ${BG_YELLOW} DISAGREE ${RST} upstream sampling already\n"
printf "                     balances classes before this stage.\n"
sleep 1.5
printf "  ${BYELLOW}Statistical Rigor:${RST} Show me the evidence. Line 42 reads\n"
printf "                     raw CSV with no prior balancing step.\n"
sleep 1.5
printf "  ${BGREEN}Pipeline Safety:${RST}   ${BG_MAGENTA} CONCEDE ${RST} the raw ingest path is\n"
printf "                     unprotected. ${BRED}Upgrading to HIGH.${RST}\n"
sleep 2.4

# ── Debate Round 2 ──
printf "\n"
printf "${BCYAN}━━━ Debate: Adversarial Debate (Round 2 of 3) ━━━${RST}\n"
sleep 1.6

printf "\n"
printf "  ${BYELLOW}Security:${RST}    ${BG_RED} HIGH ${RST} SQL injection via raw string interpolation\n"
printf "                 in query builder. User input unsanitized.\n"
sleep 1.5
printf "  ${BGREEN}Performance:${RST} ${BG_GREEN} AGREE ${RST} confirmed, parameterized queries needed.\n"
printf "                 No performance trade-off here.\n"
sleep 2.4

# ── Debate Round 3 ──
printf "\n"
printf "${BCYAN}━━━ Debate: Adversarial Debate (Round 3 of 3) ━━━${RST}\n"
sleep 1.6

printf "\n"
printf "  ${BYELLOW}Data Quality:${RST}    ${BG_YELLOW} MEDIUM ${RST} No null checks on upstream joins,\n"
printf "                     23%% row loss detected in output table.\n"
sleep 1.5
printf "  ${BGREEN}Maintainability:${RST} ${BG_YELLOW} DISAGREE ${RST} outer join preserves all rows.\n"
printf "                     No data loss if schema is correct.\n"
sleep 1.5
printf "  ${BYELLOW}Data Quality:${RST}    INNER JOIN at line 78, not LEFT JOIN.\n"
printf "                     Rows without match are silently dropped.\n"
sleep 1.5
printf "  ${BGREEN}Maintainability:${RST} ${BG_MAGENTA} CONCEDE ${RST} the join type is wrong.\n"
printf "                     ${BRED}Upgrading to HIGH.${RST}\n"
sleep 1.5
printf "\n"
printf "  ${BG_GREEN} CONVERGED ${RST} all positions stable.\n"
sleep 2.4

# ── Blind Finals ──
printf "\n"
printf "${BCYAN}━━━ Debate: Blind Final Scoring ━━━${RST}\n"
sleep 1.6

printf "\n"
printf "Blind final scores submitted.\n"
sleep 1.2
printf "  Security: ${BYELLOW}6${RST}/10 | Stat Rigor: ${BRED}4${RST}/10 | Perf: ${BGREEN}8${RST}/10\n"
printf "  Data Quality: ${BYELLOW}5${RST}/10 | Safety: ${BYELLOW}5${RST}/10 | Maintain: ${BGREEN}7${RST}/10\n"
sleep 2

# ── Verify ──
printf "\n"
printf "${BCYAN}━━━ Verify: Audit & Claim Verification ━━━${RST}\n"
sleep 1.6

printf "\n"
printf "Claim verification: 12/14 citations ${BG_GREEN} VERIFIED ${RST}\n"
printf "                     1 ${BG_RED} INACCURATE ${RST}  1 ${BG_YELLOW} UNVERIFIABLE ${RST}\n"
sleep 2.4

# ── Adjudicate ──
printf "\n"
printf "${BCYAN}━━━ Adjudicate: Supreme Judge Verdict ━━━${RST}\n"
sleep 1.6

printf "\n"
printf "${DIM}Supreme Judge rendering verdict...${RST}\n"
sleep 2.4

printf "\n"
printf "${BBLUE}╔══════════════════════════════════════════════════════╗${RST}\n"
printf "${BBLUE}║${RST}  ${BOLD}VERDICT:${RST} ${BG_RED} REVISE ${RST} ${BWHITE}3 blocking issues identified${RST}      ${BBLUE}║${RST}\n"
printf "${BBLUE}║${RST}  Consensus score: ${BRED}5.8${RST} / 10                           ${BBLUE}║${RST}\n"
printf "${BBLUE}║${RST}  Top action: ${BGREEN}add stratified split + input validation${RST}  ${BBLUE}║${RST}\n"
printf "${BBLUE}╚══════════════════════════════════════════════════════╝${RST}\n"
sleep 8
