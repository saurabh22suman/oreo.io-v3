# Great Expectations Integration Specification for Oreo.io

**Purpose**
This document defines how Great Expectations (GE) will be integrated into Oreo.io to enforce business rules, validate data during every stage (upload, live edit, preview, change request, approval, merge, and restore), and provide human-friendly validation results in the UI and audit logs.

Target audience: AI coding agent (Opus-4.5), backend engineers (Python + Go), frontend engineers (React), QA.

---

# 1. High-level Goals

* Treat GE suites as the **single source of truth for business rules** per dataset.
* Run validations at these moments:

  * On file upload / initial ingest
  * During live cell edits (cell-level and row-level checks)
  * When user requests session preview
  * On CR submission
  * On approver view (re-validation)
  * Before final merge
  * On restore preview
* Present results in human-readable form in the UI (inline cell hints, preview summary, validation report tab in audit)
* Store validation run metadata and full details in both metadata DB and dataset audit folder
* Ensure performance via caching, partial validation, and DuckDB-backed execution

---

# 2. GE Suite Format & Storage

* Store GE expectation suites as JSON compatible with GE v0.16+ (or used GE feature set).
* Persist suite JSON in `dataset_meta.rules_json` and `expectation_suites` table.
* Suite metadata fields:

  * `suite_id` (uuid)
  * `dataset_id`
  * `version` (incremented on edits)
  * `created_by`, `created_at`
  * `description`
  * `suite_json` (full expectation suite)
  * `scope`: `dataset` | `entity` | `field`

---

# 3. Severity Model

Map GE outcomes to Oreo severities. Each expectation in the suite may include a `metadata.severity` hint (info/warning/error/fatal). Otherwise default mapping rules apply.

| GE result                           | Oreo severity | Behavior                                   |
| ----------------------------------- | ------------- | ------------------------------------------ |
| success                             | info          | display as info                            |
| partial (expectation has threshold) | warning       | shown in preview, approver attention       |
| failure                             | error         | blocks submission unless approver override |
| failure + severity = fatal          | fatal         | blocks submission & merge; must be fixed   |

**Note:** GE custom metadata field `{"severity":"error"}` or `{"severity":"fatal"}` should be supported in suite expectations.

---

# 4. Validation Execution Engine

### 4.1 Execution Modes

* **Full-suite execution** — run entire GE suite against the dataset or synthetic dataframe (used on CR submission, merge-time, restore preview)
* **Row-level execution** — run expectations scoped to a single row (used for row-level rules, optional)
* **Cell-level execution** — run expectations that reference a single column/value (used for live edit immediate feedback)
* **Partial execution** — run only the expectations that reference changed columns (performance optimization)

### 4.2 Implementation Approach

* Use GE via Python orchestration; do not call GE from Go.
* Use DuckDB to prepare dataframes for GE when reading from Delta (fast in-memory, supports time travel)
* Convert DuckDB result into pandas DataFrame for GE where needed
* For cell-level checks do targeted pandas Series or single-row DataFrame
* For very large datasets, prefer validating only changed rows or running batch jobs asynchronously and mark CR as pending until results finish

### 4.3 API Contract (Python)

* `POST /validate/preview` — runs suite on synthetic dataframe (session edits applied) — returns validation summary and detailed results
* `POST /validate/cell` — validates a single cell edit — returns cell validation result
* `POST /validate/cr/{cr_id}` — validate staging table for given CR — returns run_id and summary
* `GET /validate/runs/{run_id}` — fetch validation detailed results

---

# 5. Dataflow Integration Points

1. **Upload / initial ingest**

   * Infer schema via existing code
   * Run GE suite (if exists) against uploaded sample or full ingest depending on size
   * Persist validation run in `validation_runs`; block import on fatal errors

2. **Live Edit (cell)**

   * On commit of cell edit, call `POST /validate/cell` with `dataset_id`, `session_id`, `row_id`, `column`, `new_value`
   * GE runs expectations relevant to that column + any dependent row-level expectations
   * Return immediate feedback to UI (severity, message)

3. **Session preview**

   * Compose synthetic DataFrame: main table rows for affected primary keys overlaid with staged edits
   * Call `POST /validate/preview` with session details
   * Store summary in `validation_runs` for the session and surface to UI

4. **Change Request submission**

   * On CR submit, run full-suite validation on staging path
   * Persist `validation_runs` with detailed JSON under `/audit/change_requests/<cr_id>/validation.json`
   * If fatal/errors → block CR; if warnings → allow but mark PARTIAL_PASS

5. **Approver re-validation**

   * On approver view, re-run validations against the staging Delta table to ensure stale sessions don't slip bad data

6. **Pre-merge final validation**

   * Just prior to running delta merge, run full-suite validation on merged synthetic projection (how data will appear post merge)
   * If PASS → proceed; PARTIAL_PASS → approver forced to override; ERROR/FATAL → block

7. **Restore preview validation**

   * When previewing restore, run validations against the snapshot and indicate any rules that would change

---

# 6. Validation Result Model

Store both summary and detailed results.

### `validation_runs` table

| field        | type      | description                                                      |
| ------------ | --------- | ---------------------------------------------------------------- |
| id           | uuid      | run id                                                           |
| dataset_id   | fk        | dataset                                                          |
| cr_id        | fk/null   | optional link to CR                                              |
| session_id   | fk/null   | optional session                                                 |
| run_by       | user      | who triggered                                                    |
| run_at       | timestamp | time                                                             |
| state        | enum      | passed/partial_pass/failed                                       |
| summary_json | json      | counts by severity                                               |
| details_path | string    | pointer to audit JSON file in delta `/audit/.../validation.json` |

### Validation JSON (audit folder)

* store GE full result JSON
* enrich with Oreo fields: `severity`, `related_row_id`, `related_column`, `message`, `expectation_id`

---

# 7. UI Integration

* **Inline cell hints** — show small chips/pips on cells with warnings/errors and hover text
* **Session preview UI** — show summary card with counts and top 5 issues; "View full report" opens validation tab
* **CR details** — include Validation Report tab that renders GE result in human-friendly format (grouped by severity and column)
* **Approver UI** — clearly show blocking issues (error/fatal) and allow override only with reason
* **Audit UI** — store validation JSON in audit folder and render in audit validation tab

---

# 8. Performance & Caching

* Cache expectation suites in memory per dataset to avoid disk reload
* Cache recent validation runs and reuse them if identical inputs are used
* Use partial validation aggressively: for live edits and small sessions, run only expectations referencing changed columns
* For large CRs consider asynchronous validation (return run_id, poll for result), but final merge requires a blocking validation

---

# 9. Error Handling & Safety

* If GE execution fails (runtime error), surface friendly error and block merge until resolved
* If GE tests time out, mark run as `partial_pass` with note "validation timed out"
* Never treat GE internal errors as pass; require human review
* Keep validation run logs for troubleshooting

---

# 10. Testing Strategy

* Unit tests for mapping expectation results → Oreo severity
* Integration tests: upload → run GE → validate result storage
* E2E: live edit cell -> validate cell -> create CR -> run CR validation -> merge
* Performance tests: simulate 1000 cell edits; ensure cell-level validation latency < 500ms for local checks

---

# 11. Developer APIs & Examples

### Example `POST /validate/cell` payload

```json
{
  "dataset_id":"ds_101",
  "session_id":"sess_339",
  "row_id":"row_488",
  "column":"amount",
  "new_value": 982,
  "user_id": "user_77"
}
```

### Example `POST /validate/preview` payload

```json
{
  "dataset_id":"ds_101",
  "session_id":"sess_339",
  "edits_path":"/data/delta/.../live_edit/sess_339/",
  "max_preview_rows": 10
}
```

---

# 12. Security & Permissions

* Only owners & contributors can define or edit GE suites
* Viewers can read validation results
* Validation endpoints must check dataset permissions
* Validation JSON in audit must be access-restricted

---

# 13. Migration & Versioning of Suites

* When a suite is edited, increment suite `version` and keep old suite JSON in `expectation_suites_history`
* Store `suite_version` in validation runs so results are reproducible

---

# 14. Notes for AI Agent Implementation (GPT-5)

* Use existing Python FastAPI service for GE endpoints
* Use DuckDB to extract data from Delta for GE tests
* Convert to pandas DataFrame only for GE execution
* Persist full GE result JSON to audit folder + pointer in `validation_runs`
* Keep timeouts and graceful failures

---

# END OF SPEC
