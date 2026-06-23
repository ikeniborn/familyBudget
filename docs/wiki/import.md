# Import

The data-import subsystem ingests transactions and shopping-list rows from CSV files, public Google Sheets, and bank statement exports. It is two parallel pipelines that share the same CSV primitives. The **multi-bank pipeline** lands bank transactions in a staging table for user enrichment before they become budget facts; the **shopping-list pipeline** parses a CSV straight into shopping-list items in one request. Both detect format, match columns, validate, and guard against CSV injection. Medicine imports live separately — see [[medicine]]. Endpoints are routed under `/api/v1` per [[api]]; staging and template tables are described in [[database]]; the facts created are domain entities from [[domain]].

## File Upload & Staging

The multi-bank flow is a stateful wizard: upload a file, analyze its structure, choose/confirm a column mapping, parse into staging, enrich each row, then execute. `ImportFileUpload` (`backend/app/models/import_file_upload.py`, table `t_import_file_upload`) holds per-file metadata across these steps.

- `POST /api/v1/import/upload` (`import_endpoints.py`) accepts a multipart CSV (100 MB limit) plus `bank_provider_id` and optional `delimiter`. It writes the bytes to `/app/uploads/temp/import_<uuid>_<name>`, records `temp_file_path`, then runs analysis. The `status` field advances `uploaded → analyzed → parsed`; `analyzed_at` / `parsed_at` timestamps are stamped at each transition.
- The file *content* is not stored in the DB — only metadata (`file_name`, `file_size`, `mime_type`, detected `csv_headers`, `csv_sample_rows`, `total_rows`, `csv_delimiter`, `csv_encoding`). The temp file is unlinked after a successful parse (or on analysis failure).
- `ImportStaging` (`backend/app/models/import_staging.py`, table `t_import_staging`) is a temporary table holding raw rows (`fact_date`, `amount_string`, `description`, `csv_metadata` JSON) plus user-assigned enrichment fields (`article_id`, `financial_center_id`, `cost_center_id`, `budget_description`, `user_comment`, `is_selected`, `record_type`). It carries `bank_provider_id` for per-bank filtering and is deleted after import execution. See [[database]] for the staging/metadata-table pattern.

## CSV Detection & Analysis

Two distinct detectors exist, one per pipeline. The multi-bank flow uses `CSVAnalyzer`; the shopping-list flow uses the richer `detect_csv_format`. Both decode unknown bytes by trying encodings in order.

- `CSVAnalyzer.analyze_file` (`backend/app/services/csv_analyzer.py`) decodes UTF-8 → Windows-1251 → CP1251, then either honors a user-supplied delimiter or auto-detects via `detect_delimiter`, which first tries Python's `csv.Sniffer` (candidates `; , \t | : space`) and falls back to a consistency-scoring heuristic. It returns `encoding`, `delimiter`, `headers`, the first 5 `sample_rows`, and `total_rows`. `GET /api/v1/import/files/{file_id}/analyze` serves the stored result; `GET /api/v1/import/files/{file_id}/preview?delimiter=` re-parses the temp file with a chosen delimiter for the delimiter-selection UI.
- `detect_csv_format` (`backend/app/services/csv_detector.py`) is more thorough: it detects encoding (UTF-8 / Windows-1251 / ISO-8859-1 / CP1252), delimiter (`, ; \t |` by column-count consistency, returning a confidence), header presence (numeric-content heuristic), date format (`DD.MM.YYYY`, `YYYY-MM-DD`, `MM/DD/YYYY`, `DD/MM/YYYY`), and number format (`1,234.56` US vs `1.234,56` EU vs no-thousands variants), bundling everything into a `CSVDetectionResult` with a `confidence` score. The shopping-list `POST /shopping-lists/import/analyze` rejects results below `confidence < 0.5`.

## Column Matching & Mapping

Two mapping mechanisms exist. The shopping-list pipeline auto-maps columns to a fixed field set with fuzzy matching; the multi-bank pipeline persists user-chosen mappings per bank.

- `csv_column_matcher.py` (`backend/app/services/`) defines `EXPECTED_FIELDS` for shopping rows (`store`, `product_group`, `product_name`, `quantity`, `unit`, `comment`) with Russian/English synonyms. `match_column` tries exact → synonym → partial (`simple_similarity` ≥ 0.8) matching; `auto_map_columns` returns column→field, `get_mapping_suggestions` returns ranked `(field, confidence)` lists, and `validate_mapping` requires `store`, `product_group`, `product_name`.
- `MappingService` (`backend/app/services/mapping_service.py`) persists multi-bank mappings in `ImportColumnMapping` (`backend/app/models/import_column_mapping.py`, table `t_import_column_mapping`). Mappings are **per-user per-bank** (unique `(bank_provider_id, user_id)`, SCD Type 1 in-place update). The mapping dict maps budget fields to CSV columns (`fact_date`, `amount` required; `description`, `csv_category`, `csv_mcc`, `csv_card` optional), with an optional `transformations` dict (date/number format, delimiter). `get_default_mapping` ships built-in defaults for `tinkoff`, `alfabank`, `sberbank`, `vtb`, `raiffeisen`.
- `GET /api/v1/import/mappings/{bank_provider_id}` returns the saved mapping, or 404 carrying the bank's `default_mapping`. `POST /api/v1/import/mappings` saves/updates and enforces that `fact_date` and `amount` are present.

## Validation & Security

Validation and CSV-injection defense are shared primitives, used most heavily by the shopping-list pipeline.

- `csv_validator.py` (`backend/app/services/`) validates mapped shopping rows: required fields (`store`, `product_group`, `product_name`), positive-decimal `quantity`, and reference existence (`validate_store_reference`, `validate_product_group_reference`) against `Store` / `ProductGroup`. It accumulates `ValidationError`s into a `ValidationResult` with `errors` / `warnings` and valid/invalid counts. `aggregate_duplicate_rows` merges rows with the same `(store, product_group, product_name)` (summing quantity, concatenating comments); `detect_duplicates` flags repeats as warnings. `get_or_create_store` / `get_or_create_product_group` lazily create missing references inline, writing the SCD2 history row (and the closure-table self-reference for groups, see [[database]]) without committing.
- `csv_security.py` (`backend/app/services/`) prevents formula/CSV-injection (OWASP CSV Injection, CWE-1236). `sanitize_csv_value` prepends a single quote to any value starting with `= @ + - \t \r`; `sanitize_csv_row` sanitizes a whole row. `validate_csv_safety` / `advanced_csv_validation` additionally detect suspicious patterns (`=cmd|`, `=dde|`, `@sum(`, `+cmd|`). The shopping-list endpoints sanitize every mapped value before persisting.

## Bank Providers (Tinkoff)

`BankProvider` (`backend/app/models/bank_provider.py`, table `t_d_bank_provider`) is a small reference dimension seeded with five banks (`tinkoff`, `alfabank`, `sberbank`, `vtb`, `raiffeisen`). It scopes uploads, mappings, and staging rows.

- `BankProviderService` (`backend/app/services/bank_provider_service.py`) provides `list_active_banks`, `get_by_code`, `get_by_id`, `create_bank` (unique-code check), and `delete_bank` — a cascade delete that removes the bank's `ImportStaging`, `ImportFileUpload`, and `ImportColumnMapping` rows first. Exposed via `GET /api/v1/import/banks`, `POST /api/v1/import/banks`, `DELETE /api/v1/import/banks/{bank_id}`.
- `TinkoffCSVParser` (`backend/app/services/tinkoff_csv_parser.py`) is the one bank-specific parser: it validates the 15-column Tinkoff export (semicolon-delimited, comma decimals, Russian headers), `filter_transactions` drops `FAILED` rows and internal transfers (keywords like *Между своими счетами*), and `convert_to_staging` maps rows to staging dicts (`tinkoff_date`, `tinkoff_amount`, `tinkoff_category`, `tinkoff_mcc`, `tinkoff_description`, `tinkoff_card`). Other banks are handled generically through the column-mapping flow rather than dedicated parsers.

## Google Sheets Import

Public Google Sheets are pulled as CSV through their export endpoint and then flow through the same downstream steps. `google_sheets_parser.py` (`backend/app/services/`) has no parser of its own — it fetches bytes that the CSV detectors then handle.

- `parse_google_sheets_url` extracts the spreadsheet ID (and optional `gid`) from `docs.google.com/spreadsheets/d/{ID}` URLs. `fetch_google_sheets_as_csv` calls `…/export?format=csv&gid=…` with manual redirect handling: redirects to `accounts.google.com`/`oauth`/`login`, an HTML content-type, or 401/403/404 all raise `GoogleSheetsError` with user-facing Russian guidance to make the sheet public.
- `POST /api/v1/import/google-sheets/upload` (`import_endpoints.py`) fetches the sheet, writes a temp file, creates an `ImportFileUpload`, and analyzes it — returning the same `FileUploadResponse` as `/import/upload`, so the wizard continues identically.
- `POST /api/v1/shopping-lists/google-sheets/fetch` (`google_sheets_import.py`) is the shopping-list variant: it returns the CSV base64-encoded for the client to feed into `/shopping-lists/import/analyze`.

## Import Templates

`ImportTemplate` (`backend/app/models/import_template.py`, table `t_d_import_template`) is the **user-specific** saved-configuration table for the shopping-list import wizard — distinct from the per-bank `ImportColumnMapping`. Its `config` JSONB holds `delimiter`, `encoding`, `has_header`, `date_format`, `number_format`, `column_mapping`, and `default_values`.

- Full CRUD lives in `import_templates.py` under `GET/POST /api/v1/import-templates`, `GET/PUT/DELETE /api/v1/import-templates/{template_id}`. Every query is filtered by `user_id`; deletes are soft (`is_active=False`); template names are unique per user.

## Import Execution

Execution converts enriched staging rows into `BudgetFact` records (see [[domain]]). Two code paths exist — the `staging.py` endpoint (the one wired into the UI, with history tracking) and the `ImportExecutor` service.

- `POST /api/v1/staging/import` (`staging.py`) takes `staging_ids`, requires each row to have `article_id` and `financial_center_id`, parses `amount_string` via `_parse_amount_smart` (handles Russian / US / German formats, currency symbols, and ambiguous multi-dot strings), takes `abs()` (DB stores positive amounts; expenses are CSV-negative), rejects zero amounts, builds the description from `budget_description`/`description` + `user_comment`, then creates a `BudgetFact` **and** a `BudgetFactHistory` (SCD Type 2, `change_type="CREATE"`) per row and deletes the staging record.
- `ImportExecutor` (`backend/app/services/import_executor.py`) is the service-level equivalent: `execute_import` imports `is_selected=True` rows independently (partial success allowed), `parse_amount` returns a `Decimal`, `validate_staging_record` checks required fields, and `cleanup_staging` deletes imported rows. The staging records are mutated beforehand via `GET /api/v1/staging`, `PATCH /api/v1/staging/{id}`, `POST /api/v1/staging/bulk-update`, `POST /api/v1/staging/bulk-delete`, `DELETE /api/v1/staging`.
- `GenericCSVParser.parse_with_mapping` (`backend/app/services/generic_csv_parser.py`) is what `POST /api/v1/import/files/{file_id}/parse` runs to populate staging: it applies the saved mapping, parses dates (specified format then auto-detect), normalizes amounts to a dot-decimal string via `_normalize_amount` (`ru`/`us`/`de`/auto), skips rows missing required fields, with unparseable dates, or with zero amounts, and can concatenate extra columns into the description.

## Shopping CSV Import

The shopping-list pipeline is a stateless, single-request alternative to the staging wizard: analyze → preview → execute, each posting base64 file content. It targets `ShoppingListItem` rows, not budget facts, and is the primary consumer of the detection/matching/validation/security primitives above.

- `POST /api/v1/shopping-lists/import/analyze` (`shopping_csv_import.py`) decodes base64 (5 MB limit), runs `detect_csv_format`, `auto_map_columns`, and `get_mapping_suggestions`, returning detected format plus mapping suggestions and sample rows.
- `POST /api/v1/shopping-lists/import/preview` parses with the client's delimiter/encoding/mapping, sanitizes via `sanitize_csv_row`, optionally aggregates duplicates, runs `validate_csv_rows`, and returns per-row validation status. When `create_missing_references` is set, reference errors are filtered out (they'll be created at execute time).
- `POST /api/v1/shopping-lists/import/execute` repeats parse/map/validate, then for each valid row either creates missing stores/product-groups (`get_or_create_store` / `get_or_create_product_group`) or validates references, and inserts `ShoppingListItem` rows in one commit. It honors `skip_invalid`, `skip_duplicates`, and `create_missing_references`, and returns counts plus metadata about any references it created.
