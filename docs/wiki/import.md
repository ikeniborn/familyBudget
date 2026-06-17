# Data Import

The multi-bank CSV / Google Sheets import pipeline ingests external transaction exports into budget facts, and a separate shopping-list CSV importer ingests product rows. Both follow upload → detect → map → validate → stage → execute stages.

## Pipeline Stages (Multi-Bank)

The bank-transaction flow is staged and stateful: each step persists progress on `t_import_file_upload.status` (`uploaded → analyzed → parsed`), then staging rows are enriched and executed into facts. File bytes are written to `/app/uploads/temp` and deleted after parsing.

1. **Upload** — `POST /api/v1/import/upload` saves bytes to temp, creates `ImportFileUpload`, runs analysis. `backend/app/api/v1/endpoints/import_endpoints.py:219`
2. **Analyze** — `CSVAnalyzer.analyze_file` detects encoding/delimiter, stores headers + 5 sample rows. `backend/app/services/csv_analyzer.py:43`
3. **Map** — load saved/default mapping, save edits. `import_endpoints.py:653`, `:718`
4. **Parse → staging** — `GenericCSVParser.parse_with_mapping` writes `ImportStaging` rows; status `parsed`; temp file unlinked. `import_endpoints.py:789`
5. **Enrich & Execute** — staging rows get `article_id`/`financial_center_id`, then become `BudgetFact`. See [[import#Staging Records]], [[import#Execution into Facts]].

## File Upload & Temp Storage

Upload accepts multipart CSV (100MB limit) bound to a `bank_provider_id`, or fetches a public Google Sheet. Content is never stored in the DB — only metadata in `t_import_file_upload`; raw bytes live in `/app/uploads/temp` under a UUID name until parse succeeds.

- `ImportFileUpload` — `backend/app/models/import_file_upload.py:16`; fields `csv_headers`, `csv_sample_rows`, `total_rows`, `csv_delimiter`, `csv_encoding`, `temp_file_path`, `status`, `mapping_id`.
- Optional `delimiter` query param (`;`, `,`, `tab`) overrides auto-detect. `import_endpoints.py:219`
- `GET /import/files/{id}/preview` re-parses temp file with a chosen delimiter for UI preview. `import_endpoints.py:563`
- See [[api#Import Endpoints]], [[database#Model Conventions]].

## Bank Providers

Banks are a small SCD Type 1 reference dimension (`t_d_bank_provider`) seeded at migration (Tinkoff, Alfabank, Sberbank, VTB, Raiffeisen). Users may add custom banks; deleting a bank cascades through staging, uploads, and mappings.

- Model `BankProvider` — `backend/app/models/bank_provider.py:15` (`code` unique, `name`, `active`).
- `BankProviderService` — list/get/create, and ordered cascade delete (staging → uploads → mappings → bank). `backend/app/services/bank_provider_service.py:22`
- Endpoints `GET/POST/DELETE /import/banks` — `import_endpoints.py:55`, `:90`, `:151`.

## Format & Encoding Detection

`CSVAnalyzer` decodes UTF-8 first, falling back to windows-1251/cp1251 (Russian bank exports), then detects the delimiter via `csv.Sniffer` over the first 8KB, with a column-consistency heuristic fallback. A second module, `csv_detector`, additionally infers date and number formats and header presence for the shopping flow.

- `CSVAnalyzer.detect_delimiter` candidates `; \t , | : space` — `backend/app/services/csv_analyzer.py:165`
- `csv_detector.detect_csv_format` returns delimiter, encoding, `has_header`, date format (`DD.MM.YYYY`, `YYYY-MM-DD`, `MM/DD/YYYY`), number format, and a confidence score. `backend/app/services/csv_detector.py:299`

## CSV Security (Injection Guard)

The shopping import sanitizes every cell against CSV formula injection (OWASP CSV Injection / CWE-1236): values starting with `= @ + - \t \r` are prefixed with a single quote. Helper functions also detect known malicious patterns for reporting.

- `sanitize_csv_value` / `sanitize_csv_row` — `backend/app/services/csv_security.py:19`, `:56`
- `detect_suspicious_patterns` flags `=cmd|`, `=dde|`, `@sum(`, `+cmd|`. `csv_security.py:163`
- Applied per-cell during shopping execute. `backend/app/api/v1/endpoints/shopping_csv_import.py:318`

## Column Mapping (Bank)

Bank mappings translate budget fields → CSV column names and are stored one-per-(user, bank) as SCD Type 1 in-place updates. When a user has no saved mapping, hard-coded per-bank defaults are returned. Required keys: `fact_date` and `amount`.

- `ImportColumnMapping` — `backend/app/models/import_column_mapping.py:16`; unique `(bank_provider_id, user_id)`.
- `MappingService.get_mapping` / `save_mapping` / `get_default_mapping` — `backend/app/services/mapping_service.py:48`, `:77`, `:144` (defaults for tinkoff/alfabank/sberbank/vtb/raiffeisen).
- Optional `transformations` JSON carries `delimiter`, `date_format`, `number_format`, separators (consumed at parse time). `import_endpoints.py:860`

## Column Matching (Shopping)

The shopping importer auto-maps columns to a fixed field set (`store`, `product_group`, `product_name`, `quantity`, `unit`, `comment`) using exact → synonym (RU/EN) → partial (≥0.8 char-similarity) strategies, returning suggestions with confidence. Required mapped fields: store, product_group, product_name.

- `EXPECTED_FIELDS`, `match_column`, `auto_map_columns`, `get_mapping_suggestions`, `validate_mapping` — `backend/app/services/csv_column_matcher.py:12`, `:184`, `:226`, `:249`, `:308`.

## Parsing to Staging (Generic)

`GenericCSVParser.parse_with_mapping` is the bank parser: it decodes, reads rows via `csv.DictReader`, parses dates (specified format then a fallback list), normalizes amounts to dot-decimal, skips rows missing required fields / unparseable dates / zero amounts, and can concatenate extra columns into the description.

- Multi-format date parsing — `backend/app/services/generic_csv_parser.py:237`
- `_normalize_amount` handles `ru`/`us`/`de`/auto formats → `1234.56`. `generic_csv_parser.py:302`
- Emits dicts with `fact_date`, `amount_string`, `description`, `csv_metadata` for `ImportStaging`.

## Tinkoff Parser

A dedicated Tinkoff parser validates the fixed 15-column export, filters out `FAILED` rows and internal transfers (e.g. "Между своими счетами"), and converts to staging dicts. Most banks instead go through the generic parser + default mapping; this parser is the strict format-specific path.

- `TinkoffCSVParser` — `backend/app/services/tinkoff_csv_parser.py:30`; `EXPECTED_HEADERS` (15), `INTERNAL_TRANSFER_KEYWORDS`, `filter_transactions`, `convert_to_staging`, `parse_and_prepare`.

## Google Sheets Source

A public Google Sheet is fetched as CSV via the `export?format=csv&gid=` endpoint, with manual redirect handling that detects OAuth/login redirects and raises a user-friendly "make it public" error. Two entry points exist: server-side upload (creates `ImportFileUpload`) and a base64 fetch for the shopping analyze flow.

- `parse_google_sheets_url` / `fetch_google_sheets_as_csv` / `GoogleSheetsError` — `backend/app/services/google_sheets_parser.py:32`, `:81`.
- Bank flow `POST /import/google-sheets/upload` — `import_endpoints.py:352`.
- Shopping flow `POST /shopping-lists/google-sheets/fetch` returns base64 CSV. `backend/app/api/v1/endpoints/google_sheets_import.py:55`

## Validation

Two validators exist. The shopping validator (`csv_validator`) checks required fields, quantity format, store/product-group references (with optional get-or-create), and flags duplicates as warnings. The bank executor validates per staging row that `article_id`, `financial_center_id`, and a parseable amount are present.

- `validate_csv_rows` + `ValidationResult`/`ValidationError` — `backend/app/services/csv_validator.py:510`, `:26`, `:57`.
- `get_or_create_store` / `get_or_create_product_group` create missing refs inline with SCD history records. `csv_validator.py:242`, `:317` (see [[database#SCD Type 1 + History-Table Pattern]]).
- `aggregate_duplicate_rows` sums quantity and merges comments. `csv_validator.py:404`

## Staging Records

`ImportStaging` (`t_import_staging`) is a temporary table holding parsed bank rows until the user assigns category (`article_id`), financial center, optional cost center, and toggles `is_selected`. Rows are deleted after execution. The staging API lists/edits/bulk-updates and runs the import.

- Model — `backend/app/models/import_staging.py:16`; `amount_string`, `fact_date`, `csv_metadata`, `budget_description`, `user_comment`, `record_type`.
- Router `/staging` — list/patch/delete/bulk-delete/bulk-update/import. `backend/app/api/v1/endpoints/staging.py:150`
- Schemas in `backend/app/schemas/import_multibank_schema.py:207` and `backend/app/schemas/import_schema.py`.

## Execution into Facts

`POST /staging/import` converts selected staging rows into `BudgetFact` records (plus an SCD Type 2 `BudgetFactHistory` `CREATE` row), takes the absolute integer ruble amount (bank expenses are negative), composes the final description from `budget_description`/`description` + `user_comment`, then deletes the consumed staging rows.

- Endpoint — `backend/app/api/v1/endpoints/staging.py:491`; smart amount parser `_parse_amount_smart` at `:36`.
- Alternative `ImportExecutor.execute_import` (service variant, no history) — `backend/app/services/import_executor.py:162`.
- Lands in the fact table — see [[domain#Budget Facts (Transactions)]], [[database#Star Schema & Fact Table]], [[database#SCD Type 2 Versioning Service]].

## Shopping-List CSV Import

A self-contained flow (base64 file in request body, no staging table) for importing product rows into a shopping list: analyze → preview → execute. Execute parses, sanitizes, maps, validates, optionally aggregates duplicates and auto-creates stores/product groups, then inserts `ShoppingListItem` rows in one commit.

- Router `/shopping-lists/import` — analyze/preview/execute. `backend/app/api/v1/endpoints/shopping_csv_import.py:41`, `:114`, `:255`.
- Schemas `CSVAnalyzeRequest`/`CSVImportRequest`/`CSVPreviewResponse` etc. — `backend/app/schemas/csv_import.py`.
- Items created at `shopping_csv_import.py:470`; see [[domain#Shopping Lists & Items]].

## Import Templates (Shopping)

`ImportTemplate` (`t_d_import_template`) stores reusable, user-specific shopping-import configs (delimiter, encoding, date/number format, `column_mapping`, `default_values`) as a JSON `config`. Unlike bank mappings it is keyed only by user and supports full CRUD. It is the only user-specific table in the shopping feature.

- Model — `backend/app/models/import_template.py:20`; config validator requires a `delimiter` key.
- Router `/import-templates` CRUD — `backend/app/api/v1/endpoints/import_templates.py:24`.
- Schemas — `backend/app/schemas/import_template.py`.
