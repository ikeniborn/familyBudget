---
review:
  intent_hash: "5ba299fe5646e7aa"
  last_run: 2026-11-24
  phases:
    structure: { status: passed }
    completeness: { status: passed }
    clarity: { status: passed }
    consistency: { status: passed }
    alignment: { status: passed }
  findings: []
workflow:
  route: chain
  continuation: full
---
# Intent: Bank CSV import integrity

**Date:** 2026-11-24
**Status:** approved

## Objective

Help users review bank CSV imports before writing budget facts. Prevent duplicate writes and explain rejected rows and whole-ruble amounts.

## Desired Outcomes

- Before confirmation, the preview highlights rows whose transaction date and stored whole-ruble amount match an existing budget fact. It displays matching facts and their accounts.
- The preview marks these rows as likely duplicates and leaves them unselected. Include a matching row only after the user explicitly confirms that it is a distinct transaction.
- Repeating confirmation of an already committed import does not create additional facts. Reuploading an identical statement identifies the prior import before confirmation.
- The import report shows source row numbers, rejection reasons, and counts that reconcile the input rows with accepted and rejected rows.
- The preview shows the original amount, the whole-ruble amount that will be stored, and the conversion difference. The final result uses the same conversion.

## Health Metrics

- Importing the same confirmed rows twice creates each accepted fact only once.
- Identical date and amount do not prevent the user from importing a distinct transaction after explicit confirmation.
- Every rejected input row has a source row number and a reason. Reported counts match the test file.
- Existing integer-only imports preserve their amounts and counts. Importing creates no changes to previously stored facts.

## Strategic Context

- Interacts with: bank CSV parsing, the staging preview and confirmation flow, and existing budget facts.
- Priority trade-off: trust over speed. Users must be able to reconcile a CSV statement with the stored ledger.

## Constraints

### Steering

- Display duplicate matches next to the affected CSV row before confirmation.
- Use the four-row fbd reproduction and checks for repeated, simultaneous, and intentionally identical transactions.

### Hard

- Discard fractional rubles toward zero. For example, 12500.75 becomes 12500 and -840.49 becomes -840 before applying the existing positive-amount storage convention.
- Compare against already stored actual budget facts by transaction date and resulting whole-ruble amount. Treat a match as a duplicate by default. Require explicit confirmation to import a distinct matching transaction.
- Reject and explain any row whose amount becomes zero after conversion.
- Scope this change to bank CSV import. Preserve existing financial data and the whole-ruble schema.

## Autonomy Zones

- Full autonomy: inspect code and test with synthetic CSV fixtures.
- Guarded: change the bank CSV import flow after the approved design gates. Verify it in an isolated test database.
- Proposal-first: change the amount policy, match criteria, or import scope.
- No autonomy: modify previously imported facts or use production bank statements in tests.

## Stop Rules

- Halt if retry or concurrent confirmation can create a duplicate fact.
- Escalate if a required design changes the whole-ruble schema or an existing public contract beyond the accepted scope.
- Done when: the fbd fixture displays date-and-amount matches, the user can include a distinct matching transaction, replay creates zero new facts, every rejected row has a reason, and preview and stored amounts agree.
