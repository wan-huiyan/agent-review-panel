# Content Signal Detection & Domain Checklists

## Signal Detection Table

Signal detection fires when the skill auto-selects personas (not when the user specifies them).
A signal triggers when **3+ distinct keywords** from its group appear in the work (case-insensitive).

| Signal | Detection Keywords | Recommended Persona | Intensity |
|--------|-------------------|---------------------|-----------|
| SQL/Data | `SELECT`, `FROM`, `JOIN`, `CREATE TABLE`, `INSERT`, `.sqlx`, `BigQuery`, `dbt` | **Data Quality Auditor** — Schema completeness, join correctness, NULL handling, temporal safety | 35% |
| Auth/Security | `auth`, `token`, `JWT`, `OAuth`, `password`, `secret`, `credential`, `permission`, `RBAC`, `encrypt` | **Security Auditor** — Injection vectors, auth gaps, secret exposure, access control | 30% |
| Infrastructure | `Dockerfile`, `docker-compose`, `kubernetes`, `k8s`, `terraform`, `.tf`, `helm`, `nginx`, `yaml` (in infra context) | **Reliability/SRE Reviewer** — Failure modes, scaling, monitoring, rollback | 35% |
| ML/Statistics | `model`, `training`, `accuracy`, `AUC`, `precision`, `recall`, `XGBoost`, `sklearn`, `calibration`, `feature` (in ML context) | **Statistical Rigor Reviewer** — Leakage, overfitting, evaluation methodology, feature validity | 35% |
| API/Integration | `endpoint`, `REST`, `GraphQL`, `webhook`, `API`, `request`, `response`, `middleware`, `route` | **API Design Reviewer** — Contract consistency, error handling, versioning, backward compat | 40% |
| Frontend/UI | `component`, `render`, `useState`, `CSS`, `HTML`, `accessibility`, `a11y`, `responsive` | **UX/Accessibility Advocate** — Usability, a11y compliance, responsive behavior | 50% |
| Cost/Billing | `pricing`, `cost`, `billing`, `budget`, `free tier`, `SKU`, `invoice`, `quota`, `egress`, `per-unit` | **Cost Auditor** — Hidden charges, shared free-tier assumptions, scaling costs, one-time vs steady-state separation | 40% |
| Data Pipeline/ETL | `pipeline`, `backfill`, `idempotent`, `lookforward`, `target_date`, `label_valid`, `training window`, `data freshness`, `CURRENT_DATE`, `retrain` | **Pipeline Safety Reviewer** — Temporal correctness, data freshness lag, idempotency, label validity, train/serve parity | 35% |
| Skill/Docs Portability | `universal`, `all projects`, `any warehouse`, `convention`, `best practice`, `Databricks`, `Snowflake`, `BigQuery`, `Redshift`, `dialect`, `cross-platform` | **Portability Auditor** — Dialect-specific claims labeled as universal, single-project patterns presented as standards, broken cross-references, platform assumptions | 35% |
| Repo/Data Hygiene | `.csv`, `.parquet`, `data/`, `snapshot`, `export`, `requirements`, `hardcoded`, `/Users/`, `/home/`, `analysis_runs.db`, `.db` (in tracked files) | **Reproducibility Auditor** — Data files committed to git, hardcoded absolute paths, missing dependency pins, stale artifacts, secrets in tracked files | 40% |

## Domain Checklists

Each auto-added persona receives a built-in domain checklist injected into their Phase 2 prompt (after the reasoning strategy). For each checklist item, the reviewer states: ✅ Verified, ❌ Violation, or ⚠️ Unable to verify.

### SQL/Data
- JOIN fan-out (1:N silently multiplies rows)
- NULL propagation through COALESCE chains
- Temporal safety (snapshot vs event tables)
- Idempotency (re-runs produce same result)
- Schema evolution (column additions break `SELECT *`)
- Date timezone assumptions (UTC vs local)

### Auth/Security
- Token expiry handling
- Secret rotation
- Injection vectors (SQL, command, XSS)
- Least-privilege IAM
- Audit logging
- Credential exposure in env vars/logs

### Infrastructure
- Resource limits vs observed usage
- Graceful degradation
- Rollback procedure exists
- Monitoring/alerting coverage
- Timeout margins (2-3x observed)
- Secret exposure in Dockerfiles

### ML/Statistics
- Train/serve skew (features computed identically?)
- Label leakage (temporal, feature)
- Calibration validity (independent calibration set?)
- Class imbalance handling
- Holdout contamination
- Feature drift monitoring
- NaN semantics (structural vs observed zero)
- Lookforward/lookback window correctness

### API/Integration
- Breaking changes without versioning
- Retry/idempotency keys
- Rate limiting
- Error contract consistency
- Backward compatibility
- Pagination handling

### Frontend/UI
- Accessibility (WCAG compliance)
- Responsive breakpoints
- Loading/error/empty states
- Input validation client+server
- Keyboard navigation

### Cost/Billing
- Shared free-tier assumptions (per billing account, not per service)
- Per-unit pricing at scale
- N=1 cost estimates need confidence caveats
- One-time vs steady-state separation
- Hidden costs (egress, cross-region, API calls)
- Cost × iteration count for looped operations

### Data Pipeline/ETL
- Data freshness lag (T+1, T+2 — today's data may not be available until tomorrow)
- Backfill safety (idempotent reruns without duplicates)
- Label validity windows (lookforward must not extend past available data)
- Training/serving feature parity
- Hash stability for entity resolution
- Pipeline ordering dependencies (retrain before scoring after logic changes)
- `.fillna(0)` destroys structural missingness signal

### Repo/Data Hygiene
- Data files committed to git (CSVs, Parquet, SQLite DBs — should be .gitignored with export scripts)
- Hardcoded absolute paths (`/Users/`, `/home/`, `C:\`) — should use relative paths or `Path(__file__).parent`
- Missing or unpinned dependency files (no requirements.txt, or uses `>=` without upper bounds)
- Stale build artifacts tracked in git (`.db`, `__pycache__/`, `node_modules/`)
- Secrets or credentials in tracked files (API keys, OAuth tokens, connection strings)
- Internal document framing inconsistent with client-facing deliverables (exec summary says X, deck says Y)
- Placeholder/synthetic values presented as real data without disclosure (Math.random(), hardcoded constants)
- Branch ownership confusion (deliverable fixes on feature branch, code changes on docs branch)

### Skill/Docs Portability
- Claims labeled "universal" or "all projects" — verify against official docs for each platform
- SQL functions that are dialect-specific (e.g., `first()` is Spark-only, `ANY_VALUE()` is Snowflake/BigQuery)
- Command syntax that varies by platform (e.g., `DESCRIBE` vs `INFORMATION_SCHEMA`)
- Examples from one project presented as general patterns — check if naming/conventions are project-specific
- Cross-references to other skills/files — verify they exist and are accessible
- Assumptions about file locations (e.g., `profiles.yml` in project root vs `~/.dbt/`)
- Complexity proportionality — is the process too heavy for simple cases?

### Transform/Back-Transform Completeness (v2.14, Phase 2 Data Flow Tracer)
- List ALL fields entering each forward transform (`log`, `log1p`, `encode`, `serialize`, `normalize`, `scale`, `hash`, `compress`, `encrypt`)
- List ALL fields exiting each back-transform (`exp`, `expm1`, `decode`, `deserialize`, `denormalize`, `unscale`, `verify-hash`, `decompress`, `decrypt`)
- Diff the two lists — any field in the forward list but NOT the back-transform list is a P0 candidate (the `rel_eff` class of bug)
- Check transform ORDERING — encrypt-then-compress requires decompress-then-decrypt (reverse order)
- Check transform PARAMETERS — does `exp()` use the same base as `log()`? does `decode()` use the same encoding as `encode()`?
- Check for PARTIAL back-transforms — `expm1()` applied to 3 of 4 log-transformed fields is a silent bug
- Check for ASYMMETRIC pairs — `log1p` paired with `exp` (should be `expm1`), `log` paired with `expm1` (should be `exp`)
- Check for transforms in comments vs code — docstring says "log-transformed" but code applies `np.log2`

### Data Flow Invariants (v2.14, Phase 2 Data Flow Tracer)
- Row count after join/merge — 1:1 preserves, 1:N multiplies, did the code account for the multiplication?
- Row count after filter + reindex/fillna — does `fillna(0)` or `reindex` silently reintroduce rows that a preceding filter removed? (the `apply_date_mask` + `prep_df` class of bug)
- Null semantics — does `fillna(0)` destroy structural missingness? Zero is not the same as missing for revenue, latency, or counts
- Index alignment — off-by-one after `reindex`, `shift`, or `rolling` operations
- Temporal scope — is the date filter applied to ALL date columns or just one? Are all instances of an excluded event (e.g., both Christmases) handled?
- Schema propagation — column names consistent across the pipeline? Renamed columns break downstream consumers silently
- Aggregation granularity — `groupby` changes the grain; is downstream code aware that rows now represent groups, not individuals?
- Type coercion at boundaries — implicit int-to-float loses precision, str-to-datetime may silently accept wrong format
