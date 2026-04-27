# Research for v2.8 Improvements

Compiled 2026-03-26 from deep research across 19 sources.

## 1. Severity Calibration / False Positive Reduction

### CORE — Dual Proposer-Ranker (Microsoft, FSE 2024)
- **Source:** https://dl.acm.org/doi/10.1145/3643762
- **Key:** Proposer LLM generates findings, Ranker LLM evaluates against acceptance criteria. Reduced false positives by 25.8%.
- **Apply:** Add Ranker Agent post-debate. Evaluate each P0/P1 against rubric: (1) Is code location real? (2) Does behavior actually occur? (3) Is severity proportional?

### Datadog — LLM False Positive Filtering for Static Analysis
- **Source:** https://www.datadoghq.com/blog/using-llms-to-filter-out-false-positives/
- **Key:** Precision-recall tension: prompts for catching vulns misclassify FPs, and vice versa. Balanced via systematic prompt/temperature sweeps.
- **Apply:** Severity-dampening prompt for Judge: "What is the minimum severity justified by concrete evidence?" instead of "What severity is this?"

### Qodo 2.0 — Precise vs Exhaustive Dual-Mode
- **Source:** https://www.qodo.ai/blog/how-we-built-a-real-world-benchmark-for-ai-code-review/
- **Key:** Two modes: Precise (only clearly actionable, high precision) and Exhaustive (max recall). Achieved 60.1% F1, best in class by 9%.
- **Apply:** Configurable review mode. Code reviews → Precise (require code evidence). Plan reviews → Exhaustive (allow broader risk identification).

## 2. Grounding Claims in Actual Code

### SGCR — Specification-Grounded Code Review (ASE 2025)
- **Source:** https://arxiv.org/abs/2512.17540
- **Key:** Dual pathway: Explicit (deterministic rule checking) + Implicit (RAG-based discovery with verification). 42% developer adoption rate (90.9% improvement over baseline).
- **Apply:** Run Explicit Compliance Check against project conventions (config.py, CLAUDE.md) before debate. Feed as ground truth.

### CodeRabbit — Tool-Augmented Review with AST-grep + LLM
- **Source:** https://www.coderabbit.ai/blog/ai-native-universal-linter-ast-grep-llm
- **Key:** Agent generates shell scripts (grep, cat, ast-grep) to verify assumptions in sandboxed Cloud Run. Combines AST analysis with RAG.
- **Apply:** Verify-before-claim protocol: each agent includes `verification_command` field. Orchestrator runs commands, attaches results.

### Nexus — Execution-Grounded Multi-Agent Verification (Oct 2025)
- **Source:** https://arxiv.org/abs/2510.26423
- **Key:** Four specialist agents deliberate then execute proposals in sandbox. Deliberation-only misses bugs execution catches. 46.3% → 57.7% accuracy.
- **Apply:** Sandbox Validation step where Judge can request execution of specific checks before verdict.

## 3. Existing Bugs vs Plan Risks

### Code Review Concern Taxonomy (Blincoe et al., IST 2022)
- **Source:** https://kblincoe.github.io/publications/2022_IST_CodeReview.pdf
- **Key:** ~75% of defects found in code review are evolvability defects (readability, maintainability), not functional bugs. Three tiers: functional defect, evolvability defect, false positive.
- **Apply:** Three-tier classification: Confirmed Defect (code evidence, P0 eligible), Design Risk (speculative, caps at P2), Quality Concern (non-blocking).

### Rethinking Code Review Workflows (May 2025)
- **Source:** https://arxiv.org/html/2505.16339v1
- **Key:** AI reviews more trusted for low-severity PRs; trust drops for high-severity. LLM-assisted reviews need explicit context about what they're reviewing.
- **Apply:** For plan reviews, prompt agents: "You are reviewing a design document. Distinguish between: (a) flaws in logic, (b) implementation risks, (c) suggestions."

## 4. Multi-Agent Debate Improvements

### ConfMAD — Confidence-Calibrated Debate (EMNLP 2025)
- **Source:** https://arxiv.org/abs/2509.14034
- **Key:** Agents emit calibrated confidence scores (0-100) using Platt/temperature scaling. High-confidence agent prevails. MMLU: 78.3% → 83.3%.
- **Apply:** Require confidence scores per finding. Judge weights by confidence, not just severity label. "P0, confidence 40" = uncertain.

### Demystifying MAD — Diversity + Confidence (Jan 2026)
- **Source:** https://arxiv.org/abs/2601.19921
- **Key:** Two mechanisms: (i) diversity of initial viewpoints, (ii) calibrated confidence. Homogeneous agents with uniform updates CANNOT reliably improve.
- **Apply:** Ensure personas produce genuinely diverse initial assessments. All-converge = suspicious groupthink signal.

### DAR — Diversity-Aware Message Retention (March 2026)
- **Source:** https://arxiv.org/abs/2603.20640
- **Key:** Select maximally disagreeing responses each round. "A high-confidence echo contributes far less than a lower-confidence alternative."
- **Apply:** During debate, amplify dissenting voices. If 4/5 agree, broadcast the dissenter's argument prominently.

### MAD Performance Challenges (ICLR Blog, April 2025)
- **Source:** https://d2jud02ci9yv69.cloudfront.net/2025-04-28-mad-159/blog/mad/
- **Key:** MAD fails to consistently beat simpler baselines. Agents over-weight final answers vs reasoning steps. Turning correct→incorrect at higher rates than correction.
- **Apply:** Debate on evidence chains, not conclusions. "Does this code path reach the vulnerable state?" not "Is this P0 or P2?"

## 5. GitHub Repos

### adversarial-review (alecnielsen)
- **Source:** https://github.com/alecnielsen/adversarial-review
- **Key:** Four-phase: Independent → Cross-Review → Meta-Review (defend/retract) → Synthesis. Cross-model (Claude + Codex).
- **Apply:** Add structured "defend or retract" step after cross-review.

### Hegelion — Dialectical Reasoning (Hmbown)
- **Source:** https://github.com/Hmbown/Hegelion
- **Key:** Thesis-Antithesis-Synthesis in separate LLM calls. Player-Coach: Coach independently verifies by re-reading source, not trusting player.
- **Apply:** Judge should re-read source material independently, not only evaluate debate transcript.

### g3 — Block AI Adversarial Cooperation (dhanji)
- **Source:** https://block.xyz/documents/adversarial-cooperation-in-code-synthesis.pdf
- **Key:** Bounded adversarial process. Splitting thesis/antithesis into separate agents maintains cleaner context.
- **Apply:** Validates separate API calls per agent. Consider early termination on high-confidence convergence.

### InfCode — Adversarial Test+Patch (Tokfinity)
- **Source:** https://arxiv.org/abs/2511.16004
- **Key:** Test Generator and Code Generator adversarially refine each other. 79.4% SWE-bench Verified (SOTA).
- **Apply:** Adversarial test writer role: instead of arguing about bugs, write a test that demonstrates the bug. Pass = confirmed; fail to construct = likely FP.

## 6. Tool-Augmented Review

### Tool-MAD — Tool-Augmented Debate (Jan 2026)
- **Source:** https://arxiv.org/abs/2601.04742
- **Key:** Each agent gets different external tool (RAG, web search). Dynamically retrieve evidence during debate. Judge uses Faithfulness + Answer Relevance scores. Up to 5.5% accuracy improvement.
- **Apply:** Give each persona a different tool: Security → grep, Correctness → read, Performance → AST analysis, Maintainability → git log.

### CodeRabbit on Google Cloud Run
- **Source:** https://cloud.google.com/blog/products/ai-machine-learning/how-coderabbit-built-its-ai-code-review-agent-with-google-cloud-run
- **Key:** Agent generates verification shell scripts in sandboxed Cloud Run. Verifies own assumptions before posting.
- **Apply:** Verify-before-claim protocol with sandboxed execution.
