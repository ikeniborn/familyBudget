"""Exercise the bank import review and confirmation against the real fact registry."""

from contextlib import asynccontextmanager
from datetime import date, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from backend.app.models.article import Article
from backend.app.models.budget_fact_history import BudgetFactHistory
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.import_staging import ImportStaging

pytestmark = [pytest.mark.integration, pytest.mark.backend, pytest.mark.destructive]


@pytest.fixture
async def ledger(db_session, test_user, admin_user):
    day = date.today()
    category = Article(user_id=test_user.id, name="CSV integrity", type="expense")
    account = FinancialCenter(user_id=test_user.id, name="CSV account")
    other = FinancialCenter(user_id=admin_user.id, name="Other account")
    db_session.add_all([category, account, other])
    await db_session.flush()
    row = ImportStaging(
        user_id=test_user.id,
        fact_date=day,
        amount_string="-840.49",
        article_id=category.id,
        financial_center_id=account.id,
    )
    db_session.add(row)
    await db_session.flush()

    async def add_fact(amount=840, record_type="fact", fact_date=day, description="manual"):
        fact = BudgetFact(
            user_id=admin_user.id,
            article_id=category.id,
            financial_center_id=other.id,
            fact_date=fact_date,
            amount=amount,
            record_type=record_type,
            description=description,
        )
        db_session.add(fact)
        await db_session.flush()
        return fact

    return row, add_fact


async def test_registry_review_recheck_and_receipt_replay(authenticated_client, db_session, ledger):
    row, add_fact = ledger
    matches = [await add_fact(description=source) for source in ("manual", "AI", "previous import")]
    await add_fact(record_type="plan")
    await add_fact(amount=839)
    await add_fact(fact_date=row.fact_date - timedelta(days=1))
    preview = await authenticated_client.get("/api/v1/staging")
    assert preview.status_code == 200, preview.text
    item = next(r for r in preview.json() if r["id"] == row.id)
    assert item["whole_amount"] == "-840"
    assert item["amount_difference"] == "0.49"
    assert [f["id"] for f in item["matches"]] == [m.id for m in matches]
    assert {f["account_name"] for f in item["matches"]} == {"Other account"}
    payload = {"staging_ids": [row.id], "confirmation_id": str(uuid4())}
    endpoint = "/api/v1/staging/import"
    response = await authenticated_client.post(endpoint, json=payload)
    assert response.status_code == 409, response.text
    payload["acknowledgments"] = {str(row.id): [m.id for m in matches]}
    new = await add_fact()
    changed = await authenticated_client.post(endpoint, json=payload)
    assert changed.status_code == 409
    assert changed.json()["detail"]["message"]["matches"][str(row.id)][-1]["id"] == new.id
    payload["acknowledgments"][str(row.id)].append(new.id)
    done = await authenticated_client.post(endpoint, json=payload)
    assert done.status_code == 200, done.text
    retry = await authenticated_client.post(endpoint, json=payload)
    assert retry.json() == done.json()
    assert done.json()["total_imported"] == 1
    payload["acknowledgments"] = {}
    assert (await authenticated_client.post(endpoint, json=payload)).status_code == 409
    created = await db_session.scalar(select(BudgetFact).where(BudgetFact.user_id == row.user_id))
    assert created.amount == 840
    assert (
        await db_session.scalar(
            select(func.count()).select_from(BudgetFactHistory).where(BudgetFactHistory.fact_id == created.id)
        )
        == 1
    )
    assert await db_session.get(ImportStaging, row.id) is None


@asynccontextmanager
async def new_statement(engine):
    """Use private fixture identities so independent transactions can really commit."""
    from sqlalchemy import delete
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from backend.app.models.bank_provider import BankProvider
    from backend.app.models.import_confirmation import ImportConfirmation, ImportSourceReceipt
    from backend.app.models.import_file_upload import ImportFileUpload
    from backend.app.models.user import User

    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions.begin() as session:
        user = User(telegram_id=uuid4().int % 10**15, first_name="CSV concurrency test")
        session.add(user)
        await session.flush()
        account = FinancialCenter(user_id=user.id, name=f"Receipt fixture {user.id}")
        category = Article(user_id=user.id, name=f"Receipt fixture {user.id}", type="expense")
        bank_id = await session.scalar(select(BankProvider.id).limit(1))
        upload = ImportFileUpload(
            user_id=user.id,
            bank_provider_id=bank_id,
            fingerprint=uuid4().hex * 2,
            file_name="integrity.csv",
            file_size=50,
        )
        session.add_all([account, category, upload])
        await session.flush()
        amount = str(100000000 + user.id)
        rows = [
            ImportStaging(
                user_id=user.id,
                article_id=category.id,
                file_upload_id=upload.id,
                financial_center_id=account.id,
                source_row=line,
                fact_date=date.today(),
                amount_string=amount,
            )
            for line in (2, 3)
        ]
        session.add_all(rows)
        await session.flush()
    try:
        yield sessions, user.id, [row.id for row in rows]
    finally:
        async with sessions.begin() as session:
            for model in (
                ImportSourceReceipt,
                ImportConfirmation,
                ImportStaging,
                BudgetFactHistory,
                BudgetFact,
                ImportFileUpload,
                Article,
                FinancialCenter,
            ):
                await session.execute(delete(model).where(model.user_id == user.id))
            await session.execute(delete(User).where(User.id == user.id))


@pytest.fixture
async def committed_statement(engine):
    async with new_statement(engine) as statement:
        yield statement


async def test_concurrent_confirmation_and_partial_statement(committed_statement):
    import asyncio

    from fastapi import HTTPException

    from backend.app.models.import_confirmation import ImportSourceReceipt
    from backend.app.schemas.import_multibank_schema import ImportExecuteRequest
    from backend.app.services.bank_import_confirmation import confirm_staging

    sessions, user, (first, second) = committed_statement
    one = ImportExecuteRequest(staging_ids=[first], confirmation_id=uuid4())

    async def confirm(request):
        async with sessions() as session:
            return await confirm_staging(session, user, request)

    a, b = await asyncio.gather(confirm(one), confirm(one))
    assert a == b
    async with sessions() as session:
        existing = (
            await session.execute(select(ImportSourceReceipt).where(ImportSourceReceipt.user_id == user))
        ).scalar_one()
        fact_id = existing.fact_id
        pending = await session.get(ImportStaging, second)
        duplicate = ImportStaging(**{**pending.model_dump(exclude={"id", "created_at"}), "source_row": 2})
        session.add(duplicate)
        await session.commit()
        repeated_source = duplicate.id
    with pytest.raises(HTTPException) as caught:
        await confirm(ImportExecuteRequest(staging_ids=[repeated_source], acknowledgments={repeated_source: [fact_id]}))
    assert caught.value.detail["code"] == "source_already_imported"
    with pytest.raises(HTTPException) as caught:
        await confirm(ImportExecuteRequest(staging_ids=[second]))
    assert caught.value.detail["code"] == "matches_changed"
    await confirm(ImportExecuteRequest(staging_ids=[second], acknowledgments={second: [fact_id]}))
    async with sessions() as session:
        count = await session.scalar(select(func.count()).select_from(BudgetFact).where(BudgetFact.user_id == user))
        assert count == 2


async def test_commit_failure_rolls_back_facts_history_receipts_and_staging(committed_statement):
    from sqlalchemy import event

    from backend.app.models.import_confirmation import ImportConfirmation, ImportSourceReceipt
    from backend.app.schemas.import_multibank_schema import ImportExecuteRequest
    from backend.app.services.bank_import_confirmation import confirm_staging

    sessions, user, ids = committed_statement
    async with sessions() as session:

        @event.listens_for(session.sync_session, "before_commit")
        def fail_before_commit(_session):
            raise RuntimeError("simulated commit failure")

        with pytest.raises(RuntimeError, match="simulated commit failure"):
            await confirm_staging(session, user, ImportExecuteRequest(staging_ids=ids))
    async with sessions() as session:
        for model, expected in (
            (BudgetFact, 0),
            (BudgetFactHistory, 0),
            (ImportSourceReceipt, 0),
            (ImportConfirmation, 0),
            (ImportStaging, 2),
        ):
            assert (
                await session.scalar(select(func.count()).select_from(model).where(model.user_id == user)) == expected
            )


async def test_competing_imports_require_review_of_new_fact(committed_statement):
    import asyncio

    from fastapi import HTTPException

    from backend.app.schemas.import_multibank_schema import ImportExecuteRequest
    from backend.app.services.bank_import_confirmation import confirm_staging

    sessions, user, ids = committed_statement

    async def run(row_id):
        async with sessions() as session:
            return await confirm_staging(session, user, ImportExecuteRequest(staging_ids=[row_id]))

    outcomes = await asyncio.gather(*(run(row_id) for row_id in ids), return_exceptions=True)
    successes = [r for r in outcomes if not isinstance(r, BaseException)]
    failures = [r for r in outcomes if isinstance(r, HTTPException)]
    assert len(successes) == len(failures) == 1
    assert failures[0].status_code == 409
    assert failures[0].detail["code"] == "matches_changed"


async def test_preview_preserves_bigint_precision_in_browser_json(authenticated_client, ledger):
    row, add_fact = ledger
    row.amount_string = "9007199254740993"
    await add_fact(amount=9007199254740993)
    result = await authenticated_client.get("/api/v1/staging")
    item = next(r for r in result.json() if r["id"] == row.id)
    assert item["whole_amount"] == "9007199254740993"
    assert item["matches"][0]["amount"] == "9007199254740993"


async def test_backfills_from_two_uploaders_share_month_partition(engine):
    import asyncio

    from sqlalchemy import text, update

    from backend.app.schemas.import_multibank_schema import ImportExecuteRequest
    from backend.app.services.bank_import_confirmation import confirm_staging

    async with new_statement(engine) as first, new_statement(engine) as second:
        sessions = first[0]
        async with sessions.begin() as session:
            month = await session.scalar(
                text("""
                SELECT month::date FROM generate_series(date '2020-01-01', current_date,
                                                       interval '1 month') AS month
                WHERE to_regclass('public.t_f_budget_fact_' || to_char(month, 'YYYY_MM')) IS NULL
                ORDER BY month LIMIT 1
            """)
            )
            if month is None:
                pytest.skip("All historical partitions already exist")
            for offset, (_, user_id, ids) in enumerate((first, second)):
                await session.execute(
                    update(ImportStaging)
                    .where(ImportStaging.id == ids[0])
                    .values(fact_date=month + timedelta(days=offset))
                )

        async def confirm(statement):
            sessions, user, ids = statement
            async with sessions() as session:
                return await confirm_staging(session, user, ImportExecuteRequest(staging_ids=[ids[0]]))

        a, b = await asyncio.gather(confirm(first), confirm(second))
        assert a.total_imported == b.total_imported == 1
