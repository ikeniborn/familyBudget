---
result_check:
  verdict: OK
  source: plan
  plan_hash: "7a6e8780aded2185"
  last_run: 2026-11-24
  reviewed: true
  docs_checked: true
review:
  plan_hash: "7a6e8780aded2185"
  last_run: 2026-11-24
  phases:
    structure: { status: passed }
    coverage: { status: passed }
    dependencies: { status: passed }
    verifiability: { status: passed }
    consistency: { status: passed }
  findings: []
chain:
  intent: docs/superpowers/intents/2026-11-24-bank-csv-import-integrity-intent.md
  spec: docs/superpowers/specs/2026-11-24-bank-csv-import-integrity-design.md
---
# Bank CSV import integrity implementation plan

> Use superpowers:executing-plans for parent execution. Record observed checks separately from expected results.

**Goal:** Make bank CSV imports reviewable and safe to confirm more than once.

**Architecture:** Carry source row identity and normalized amount through the staging flow. Query the visible fact registry for candidates. Commit the accepted facts, history, and durable receipts together.

**Tech stack:** FastAPI, SQLModel, PostgreSQL, Alembic, the bank import HTML template, pytest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-bank-csv-import-integrity-design.md`.

## Global constraints

Preserve the whole-ruble schema and existing facts. Use synthetic data in an isolated test database. Keep bank CSV behavior separate from shopping-list imports. Use the same normalization in review and execution.

### Task 1: Add durable identities and legacy compatibility

Files: `backend/app/models/import_file_upload.py`, `backend/app/models/import_staging.py`, new `backend/app/models/import_confirmation.py`, model registration, and new Alembic revision after the selected branch head.

- [ ] Write PostgreSQL migration tests for upgrade with existing uploads and staging, downgrade on a disposable copy, and uniqueness of imported source row per uploader and statement fingerprint. Confirm the new schema assertions fail before the migration.
- [ ] Add nullable SHA-256 fingerprint and source row fields. Add durable confirmation and source-row receipts. Persist the selection, acknowledgment binding, and response in a minimal representation. Give receipt rows stable identity after staging deletion. Preserve legacy rows without claiming a historical fingerprint.
- [ ] Run Alembic upgrade on pre-change fixtures and on an empty test DB. Verify one revision head, legacy row counts, and expected uniqueness failures without mutating existing facts.

### Task 2: Report rejected rows and whole-ruble conversion

Files: `backend/app/services/generic_csv_parser.py`, new `backend/app/services/bank_import_amount.py`, `backend/app/api/v1/endpoints/import_endpoints.py`, and `backend/app/schemas/import_multibank_schema.py`. Add `tests/integration/backend/test_bank_csv_import_integrity.py`.

- [ ] Add failing tests for the four-row fbd reproduction, quoted multiline fields, missing required columns and values, invalid dates and amounts, and positive and negative values below one ruble.
- [ ] Add a shared bank amount normalizer that returns signed original decimal, signed whole rubles, stored positive magnitude, and signed difference. Reject non-finite, out-of-range, or zero-result amounts. Preserve conversion and matching fields in the typed staging response.
- [ ] Capture the physical starting line for each non-header CSV record. Return source row and reason for rejected records and reconcile accepted and rejected counts. Keep `total_inserted` available to existing clients. Persist the upload fingerprint for CSV and Google Sheets paths that feed the same bank wizard.
- [ ] Query earlier committed receipt counts for identical bytes and the authenticated uploader. Keep staged accepted rows and upload parse state in one commit. Verify the four-row report, reupload, and account isolation via the live API tests on disposable PostgreSQL.

### Task 3: Match the fact registry and protect confirmation

Files: `backend/app/api/v1/endpoints/staging.py`, `backend/app/schemas/import_multibank_schema.py`, new `backend/app/services/bank_import_confirmation.py`, and the integrity integration suite.

- [ ] Add failing fixtures for manual, AI-assisted, and imported facts, plans and out-of-scope facts, another date and amount, and existing facts in a different account. Add retry, concurrent, partial replay, legacy staging, and forced failure fixtures.
- [ ] Fetch visible actual facts for candidate date and magnitude pairs in a batched lookup. Return fact IDs, dates, amounts and account display names. For older staging rows, use the same normalization and registry lookup.
- [ ] Add confirmation identity and per-row acknowledgment of displayed fact IDs. Validate selection and acknowledgment binding. Recheck matches under the uploader lock. Return a structured conflict showing updated matches before writing any new facts when review is needed.
- [ ] In one database transaction, store facts and fact history, persist the accepted source rows and confirmation result, and remove only committed staging rows. Repeat a successful confirmation and expect the original result and zero extra facts. Confirm different content with the same identity and expect rejection.
- [ ] Run the integrity suite with two independent PostgreSQL transactions for competing confirmations. Inject a failure before commit and verify that facts, history, receipt, and staging remain at their prior counts. Verify partial reupload preserves committed source row identity.

### Task 4: Update the bank import preview

Files: `frontend/web/templates/admin_import.html` and `tests/e2e/webapp/test_csv_import.spec.ts`.

- [ ] Add browser cases with a seeded registry match, an invalid CSV row, and a fractional amount. Verify the old preview fails to show the expected data.
- [ ] Show accepted and rejected counts, source rows and reasons, original and stored amounts, and signed conversion differences. Highlight registry matches with account display names and leave matching rows unselected. Require an explicit row action to acknowledge its matches.
- [ ] Reuse a stable confirmation identity when retrying the same selection. Render a server conflict as updated match review and leave the selection available. Report prior statement imports and committed row counts before confirmation.
- [ ] Run the focused Playwright CSV import scenarios. Verify warning visibility and default exclusion, an explicit inclusion, rejection reasons, amount agreement, server-side recheck, and absence of repeated writes.

### Task 5: Reconcile evidence and prepare delivery

- [ ] Run focused parser and import tests, PostgreSQL migration and concurrency checks, and the related bank CSV browser suite. Record repository revision, command, exit status and observed results.
- [ ] Update the bank import wiki documentation and align executable Given-When-Then scenarios with the changed contract. Run wiki lint. Resolve scenario bindings if the code graph is available.
- [ ] Reproduce the synthetic four-row import against an isolated deployment and record totals, visible register matches, receipt replay and persisted amounts. Compare these outcomes to the approved intent. Run check-chain result against this plan before marking the implementation complete.
