"""Review and commit bank staging rows against the shared family fact registry."""

import hashlib
import json
from collections import defaultdict
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import and_, any_, text, tuple_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.budget_fact_history import BudgetFactHistory
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.import_confirmation import ImportConfirmation, ImportSourceReceipt
from backend.app.models.import_file_upload import ImportFileUpload
from backend.app.models.import_staging import ImportStaging
from backend.app.models.user import User
from backend.app.schemas.import_multibank_schema import (
    ImportExecuteRequest,
    ImportExecuteResponse,
    ImportFactMatch,
    StagingRecordResponse,
)
from backend.app.services.bank_import_amount import normalize_bank_amount
from backend.app.services.partition_service import ensure_partitions_for_dates


async def _staged_rows(session, user_id, selected=None):
    query = (
        select(ImportStaging, ImportFileUpload.fingerprint, ImportSourceReceipt.fact_id)
        .outerjoin(
            ImportFileUpload,
            and_(
                ImportFileUpload.id == ImportStaging.file_upload_id, ImportFileUpload.user_id == ImportStaging.user_id
            ),
        )
        .outerjoin(
            ImportSourceReceipt,
            and_(
                ImportSourceReceipt.user_id == ImportStaging.user_id,
                ImportSourceReceipt.fingerprint == ImportFileUpload.fingerprint,
                ImportSourceReceipt.source_row == ImportStaging.source_row,
            ),
        )
        .where(ImportStaging.user_id == user_id)
        .order_by(ImportStaging.fact_date.desc(), ImportStaging.id)
    )
    if selected is not None:
        query = query.where(ImportStaging.id == any_(selected)).with_for_update(of=ImportStaging)
    return (await session.execute(query)).all()


async def _review(session, rows):
    previews = []
    pairs = defaultdict(list)
    for row, _, committed_id in rows:
        preview = StagingRecordResponse(
            **{**row.model_dump(), "fact_date": row.fact_date.isoformat()}, already_imported=committed_id is not None
        )
        try:
            amount = normalize_bank_amount(row.amount_string)
        except ValueError as error:
            preview.amount_error = str(error)
        else:
            preview.original_amount = str(amount.original)
            preview.whole_amount = amount.whole
            preview.amount_difference = str(amount.difference)
            pairs[row.fact_date, amount.stored].append(preview)
        previews.append(preview)

    # Keep tuple bind parameters within asyncpg's limit on large statements.
    keys = list(pairs)
    for start in range(0, len(keys), 1000):
        query = (
            select(BudgetFact.id, BudgetFact.fact_date, BudgetFact.amount, FinancialCenter.name)
            .outerjoin(FinancialCenter, FinancialCenter.id == BudgetFact.financial_center_id)
            .where(
                BudgetFact.record_type == "fact",
                tuple_(BudgetFact.fact_date, BudgetFact.amount).in_(keys[start : start + 1000]),
            )
            .order_by(BudgetFact.id)
        )
        for fact_id, day, amount, account in (await session.execute(query)).all():
            match = ImportFactMatch(id=fact_id, fact_date=day.isoformat(), amount=amount, account_name=account)
            for preview in pairs[day, amount]:
                preview.matches.append(match)
                preview.is_selected = False
    return previews


async def preview_staging(session: AsyncSession, user_id: int):
    return await _review(session, await _staged_rows(session, user_id))


async def _insert_fact(session, row, stored, now):
    description = row.budget_description or row.description
    if row.user_comment:
        description = f"{description}. {row.user_comment}" if description else row.user_comment
    fields = dict(
        user_id=row.user_id,
        article_id=row.article_id,
        financial_center_id=row.financial_center_id,
        cost_center_id=row.cost_center_id,
        amount=stored,
        fact_date=row.fact_date,
        record_type=row.record_type,
        description=description,
    )
    fact = BudgetFact(**fields, created_at=now, updated_at=now)
    session.add(fact)
    await session.flush()
    session.add(
        BudgetFactHistory(
            **fields,
            fact_id=fact.id,
            valid_from=now,
            is_current=True,
            change_type="CREATE",
            changed_by_user_id=row.user_id,
        )
    )
    return fact.id


async def confirm_staging(session: AsyncSession, user_id: int, request: ImportExecuteRequest):
    ids = sorted(request.staging_ids)
    if not ids or len(ids) != len(set(ids)):
        raise HTTPException(400, "Select distinct staging rows")
    if request.acknowledgments.keys() - set(ids):
        raise HTTPException(400, "Acknowledgment refers to an unselected row")
    acknowledgments = {k: sorted(v) for k, v in request.acknowledgments.items()}
    content = json.dumps([ids, acknowledgments], sort_keys=True, separators=(",", ":"))
    request_hash = hashlib.sha256(content.encode()).hexdigest()
    key = str(request.confirmation_id) if request.confirmation_id else request_hash

    # A second request must read the receipt after the first transaction finishes.
    await session.execute(select(User.id).where(User.id == user_id).with_for_update(key_share=True))
    receipt = await session.get(ImportConfirmation, (user_id, key))
    if receipt:
        if receipt.request_hash != request_hash:
            raise HTTPException(409, {"code": "confirmation_reused"})
        return ImportExecuteResponse(**receipt.response)

    rows = await _staged_rows(session, user_id, ids)
    if len(rows) != len(ids):
        raise HTTPException(400 if rows else 404, "Selected staging records not found")

    months = sorted({row.fact_date.replace(day=1) for row, _, _ in rows})
    # Different uploaders can see the same facts. Serialize overlapping bank
    # confirmations by partition month before any reader can take a lock on
    # the parent fact table. Acquire all month locks in calendar order.
    for day in months:
        await session.execute(text("SELECT pg_advisory_xact_lock(864312, :day)"), {"day": day.toordinal()})

    await ensure_partitions_for_dates(session, months)
    previews = await _review(session, rows)
    changed = {}
    sources = set()
    for (row, fingerprint, _), preview in zip(rows, previews):
        if fingerprint and row.source_row is not None:
            source = (fingerprint, row.source_row)
            if preview.already_imported or source in sources:
                raise HTTPException(409, {"code": "source_already_imported", "staging_id": row.id})
            sources.add(source)
        if acknowledgments.get(row.id, []) != [m.id for m in preview.matches]:
            changed[str(row.id)] = [m.model_dump(mode="json") for m in preview.matches]
        if preview.amount_error:
            raise HTTPException(400, {"staging_id": row.id, "code": preview.amount_error})
        if not row.article_id or not row.financial_center_id:
            raise HTTPException(400, f"Assign category and account to staging record {row.id}")
    if changed:
        raise HTTPException(409, {"code": "matches_changed", "matches": changed})

    now = datetime.utcnow()
    for (row, fingerprint, _), preview in zip(rows, previews):
        fact_id = await _insert_fact(session, row, abs(preview.whole_amount), now)
        if fingerprint and row.source_row is not None:
            session.add(
                ImportSourceReceipt(
                    user_id=user_id, fingerprint=fingerprint, source_row=row.source_row, fact_id=fact_id
                )
            )
        await session.delete(row)
    response = ImportExecuteResponse(
        success=True, total_imported=len(rows), message=f"Successfully imported {len(rows)} transactions"
    )
    session.add(
        ImportConfirmation(
            user_id=user_id, confirmation_id=key, request_hash=request_hash, response=response.model_dump()
        )
    )
    await session.commit()
    return response
