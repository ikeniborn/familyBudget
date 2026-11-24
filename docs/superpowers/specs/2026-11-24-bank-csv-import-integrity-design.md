---
review:
  spec_hash: "49d0d754291971a1"
  last_run: 2026-11-24
  phases:
    structure: { status: passed }
    coverage: { status: passed }
    clarity: { status: passed }
    consistency: { status: passed }
  findings: []
chain:
  intent: docs/superpowers/intents/2026-11-24-bank-csv-import-integrity-intent.md
---
# Bank CSV import integrity design

## Acceptance (from intent)

- Before confirmation, the preview highlights rows whose transaction date and stored whole-ruble amount match an existing budget fact. It displays matching facts and their accounts.
- The preview marks these rows as likely duplicates and leaves them unselected. Include a matching row only after the user explicitly confirms that it is a distinct transaction.
- Repeating confirmation of an already committed import does not create additional facts. Reuploading an identical statement identifies the prior import before confirmation.
- The import report shows source row numbers, rejection reasons, and counts that reconcile the input rows with accepted and rejected rows.
- The preview shows the original amount, the whole-ruble amount that will be stored, and the conversion difference. The final result uses the same conversion.

Done when: the fbd fixture displays date-and-amount matches, the user can include a distinct matching transaction, replay creates zero new facts, every rejected row has a reason, and preview and stored amounts agree.

## Scope and entry points

Apply the changes to the user-facing bank CSV upload, parse, staging preview, and confirmation flow. The bank import endpoint for Google Sheets may use the same downstream CSV rules. Keep shopping-list imports, manual fact creation, existing facts, and the whole-ruble schema unchanged.

Keep existing response fields and add structured results. Apply the write guard server-side for bank CSV staging even when the caller does not render the new preview fields. Keep legacy staging rows readable and confirmable. Apply registry matching and amount conversion to them. When no original upload fingerprint or source row survives, use the existing staging ID for request replay. Do not report statement recognition for unverifiable historical files.

## Parse and review

Compute a SHA-256 fingerprint of uploaded statement bytes and associate it with the authenticated uploader. Report prior committed imports of identical bytes for that uploader, including the prior imported count. File names do not participate in matching. Do not expose other users' uploaded files or receipts.

Persist each logical CSV record's source row number using the physical line where the record starts. Classify non-header records as accepted or rejected. Rejection details include source row number and machine-readable reason. Include missing fields, invalid dates, invalid amounts, and amounts that become zero. Report total, accepted, and rejected counts. Keep accepted rows available when the same file contains rejected rows.

Parse the signed amount as decimal. Truncate its magnitude toward zero and use that whole-ruble magnitude as the storage amount. Preserve the sign for displaying and interpreting the bank statement. Show the original signed amount, the signed whole-ruble equivalent, and their difference. A row with original amount 12500.75 saves 12500. A row with original amount -840.49 displays -840 and saves magnitude 840. The same conversion runs in preview and execution.

## Match existing facts

Query the actual budget fact registry for the transaction date and whole-ruble magnitude. Use the same visibility scope as the requesting user's fact registry. Include facts regardless of whether they came from manual entry, AI-assisted entry, or a previous import. Ignore planned records. Keep date and magnitude as the match criteria even when the existing account differs.

Return the fact ID and enough visible details to identify the match, including the account. Highlight matching source rows and leave them unselected by default. Include a matching row only after an explicit confirmation tied to that row and the displayed set of matching fact IDs. If a new match appears or the acknowledged match set changes, show the updated matches before writing the row.

## Transactional confirmation

Use a durable import receipt scoped to the authenticated uploader and original statement fingerprint. Record committed source row identities and the associated fact identifiers. The fingerprint plus source row number distinguishes two identical transactions that genuinely occur on different source rows. Persist a stable confirmation result for retries even after staging rows are deleted. Bind a confirmation identity to its selected rows and override acknowledgments. Reject reuse for different content.

Serialize competing confirmations for the same uploader and retain database uniqueness on committed source row identity. Within one transaction, recheck registry matches, create selected facts and their normal history, store the receipt, and remove committed staging rows. Roll back all four effects on failure. When a repeated confirmation is already committed, return its prior result without adding facts. For an identical file uploaded again, continue to allow previously uncommitted source rows while excluding committed source rows.

If the final registry check finds an unacknowledged match, return it for review without committing the confirmation request. Do not rely on the date-and-amount heuristic as a database uniqueness constraint.

## Verification

- Import the fbd four-row fixture. Verify two ready and two rejected rows and the two source line numbers and reasons. Compare preview and stored amounts. Add tests for positive and negative fractions below one ruble and unchanged whole-ruble amounts.
- Seed existing manual, AI-assisted, and imported facts with matching dates and amounts. Verify visible match details and default exclusion. Verify that a plan, another date, a different amount, and an invisible fact do not match.
- Confirm a legitimate second matching transaction. Add a fact between preview and confirmation and verify that the import requires review again.
- Verify repeated confirmation, simultaneous confirmation, partial import followed by reupload, and simultaneous imports with matching amounts. Verify counts and receipt recovery in PostgreSQL.
- Force failure after fact creation and before commit. Verify that facts, history, receipts, and staging changes roll back together. Repeat against a legacy staging row using its existing ID.
