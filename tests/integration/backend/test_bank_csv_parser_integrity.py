"""Bank CSV review must account for every source record before confirmation."""

from decimal import Decimal

import pytest

from backend.app.services.generic_csv_parser import GenericCSVParser

MAPPING = {"fact_date": "Date", "amount": "Amount", "description": "Description"}
STATEMENT = (
    b"Date;Amount;Description\r\n"
    b'2025-11-24;12500.75;"Salary\r\npaid"\r\n'
    b"invalid;10;Invalid date\r\n"
    b"2025-11-24;-840.49;Purchase\r\n"
    b"2025-11-24;0;Zero\r\n"
)


@pytest.mark.asyncio
async def test_four_row_report_preserves_physical_source_lines():
    report = await GenericCSVParser.parse_report(STATEMENT, MAPPING, 1, 1)
    assert [r["source_row"] for r in report.records] == [2, 5]
    assert [r["amount_string"] for r in report.records] == ["12500.75", "-840.49"]
    assert report.rejected_rows == [
        {"source_row": 4, "reason": "invalid_date"},
        {"source_row": 6, "reason": "zero_after_truncation"},
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "csv,reason",
    [
        ("Date;Wrong\n2025-01-01;1", "missing_column"),
        ("Date;Amount\n2025-01-01; ", "missing_value"),
        ("Date;Amount\n2025-01-01;120X", "invalid_amount"),
        ("Date;Amount\n2025-01-01;NaN", "invalid_amount"),
        ("Date;Amount\n2025-01-01;Infinity", "invalid_amount"),
        ("Date;Amount\n2025-01-01;9223372036854775808", "amount_out_of_range"),
        ("Date;Amount\n2025-01-01;1E1000000", "amount_out_of_range"),
        ("Date;Amount\n2025-01-01;0.99", "zero_after_truncation"),
        ("Date;Amount\n2025-01-01;-0.99", "zero_after_truncation"),
    ],
)
async def test_rejected_input_has_stable_reason(csv, reason):
    report = await GenericCSVParser.parse_report(csv.encode(), MAPPING, 1, 1)
    assert not report.records
    assert report.rejected_rows == [{"source_row": 2, "reason": reason}]


@pytest.mark.parametrize(
    "value,original,whole,difference",
    [
        ("-1 234,56", "-1234.56", -1234, "0.56"),
        ("-15.100.00", "-15100.00", -15100, "0"),
        ("-1,234.56", "-1234.56", -1234, "0.56"),
        ("840", "840", 840, "0"),
        ("12500.75", "12500.75", 12500, "-0.75"),
    ],
)
def test_whole_rubles_and_difference(value, original, whole, difference):
    from backend.app.services.bank_import_amount import normalize_bank_amount

    amount = normalize_bank_amount(value)
    assert amount.original == Decimal(original)
    assert amount.whole == whole
    assert amount.stored == abs(whole)
    assert amount.difference == Decimal(difference)


@pytest.mark.destructive
@pytest.mark.asyncio
async def test_parse_api_reports_four_rows_and_persists_upload_atomically(
    authenticated_client, db_session, test_user, tmp_path
):
    from sqlalchemy import select

    from backend.app.models.bank_provider import BankProvider
    from backend.app.models.import_column_mapping import ImportColumnMapping
    from backend.app.models.import_file_upload import ImportFileUpload
    from backend.app.models.import_staging import ImportStaging

    bank = (await db_session.execute(select(BankProvider).limit(1))).scalar_one()
    source = tmp_path / "four.csv"
    source.write_bytes(STATEMENT)
    upload = ImportFileUpload(
        user_id=test_user.id,
        bank_provider_id=bank.id,
        file_size=len(STATEMENT),
        file_name=source.name,
        temp_file_path=str(source),
        csv_delimiter=";",
    )
    mapping = ImportColumnMapping(user_id=test_user.id, bank_provider_id=bank.id, mapping=MAPPING)
    db_session.add_all([upload, mapping])
    await db_session.flush()
    response = await authenticated_client.post(
        f"/api/v1/import/files/{upload.id}/parse", json={"mapping_id": mapping.id}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total_rows"] == 4 and body["total_inserted"] == 2
    assert body["prior_imported_count"] == 0
    assert body["rejected_rows"] == [
        {"source_row": 4, "reason": "invalid_date"},
        {"source_row": 6, "reason": "zero_after_truncation"},
    ]
    staging = (
        await db_session.scalars(
            select(ImportStaging).where(ImportStaging.file_upload_id == upload.id).order_by(ImportStaging.source_row)
        )
    ).all()
    assert [(r.source_row, r.amount_string) for r in staging] == [(2, "12500.75"), (5, "-840.49")]
    assert upload.status == "parsed" and not source.exists()


@pytest.mark.destructive
@pytest.mark.asyncio
async def test_reupload_sees_only_uploader_receipts(
    authenticated_client, db_session, test_user, admin_user, tmp_path, monkeypatch
):
    from hashlib import sha256

    from sqlalchemy import select

    from backend.app.api.v1.endpoints import import_endpoints
    from backend.app.models.bank_provider import BankProvider
    from backend.app.models.import_column_mapping import ImportColumnMapping
    from backend.app.models.import_confirmation import ImportSourceReceipt

    monkeypatch.setattr(import_endpoints, "UPLOAD_TEMP_DIR", tmp_path)
    bank = (await db_session.execute(select(BankProvider).limit(1))).scalar_one()
    mapping = ImportColumnMapping(user_id=test_user.id, bank_provider_id=bank.id, mapping=MAPPING)
    fingerprint = sha256(STATEMENT).hexdigest()
    db_session.add_all(
        [
            mapping,
            ImportSourceReceipt(user_id=admin_user.id, fingerprint=fingerprint, source_row=2, fact_id=100),
            ImportSourceReceipt(user_id=test_user.id, fingerprint=fingerprint, source_row=5, fact_id=101),
        ]
    )
    await db_session.flush()
    result = await authenticated_client.post(
        "/api/v1/import/upload",
        params={"bank_provider_id": bank.id, "delimiter": ";"},
        files={"file": ("different-name.csv", STATEMENT, "text/csv")},
    )
    assert result.status_code == 201, result.text
    assert result.json()["prior_imported_count"] == 1
    file_id = result.json()["file_id"]
    result = await authenticated_client.post(f"/api/v1/import/files/{file_id}/parse", json={"mapping_id": mapping.id})
    assert result.status_code == 200, result.text
    report = result.json()
    assert report["total_rows"] == 4 and report["total_inserted"] == 1
    assert report["prior_imported_count"] == 1
    assert report["rejected_rows"] == [
        {"source_row": 4, "reason": "invalid_date"},
        {"source_row": 5, "reason": "already_imported"},
        {"source_row": 6, "reason": "zero_after_truncation"},
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "value,fmt",
    [
        ("12,34.56", "us"),
        ("12.34,56", "de"),
        ("12,3,45", None),
        ("12.3.45", None),
    ],
)
async def test_invalid_grouping_cannot_change_order_of_magnitude(value, fmt):
    content = f"Date;Amount\n2025-01-01;{value}".encode()
    result = await GenericCSVParser.parse_report(content, MAPPING, 1, 1, number_format=fmt)
    assert result.rejected_rows == [{"source_row": 2, "reason": "invalid_amount"}]


@pytest.mark.asyncio
@pytest.mark.parametrize("value,fmt", [("1,234.50", "us"), ("1.234,50", "de"), ("1 234,50", "ru")])
async def test_explicit_bank_number_formats(value, fmt):
    content = f"Date;Amount\n2025-01-01;{value}".encode()
    result = await GenericCSVParser.parse_report(content, MAPPING, 1, 1, number_format=fmt)
    assert result.records[0]["amount_string"] == "1234.50"


@pytest.mark.destructive
@pytest.mark.asyncio
async def test_google_sheets_receipt_uses_original_bytes(
    authenticated_client, db_session, test_user, tmp_path, monkeypatch
):
    from hashlib import sha256
    from unittest.mock import AsyncMock

    from sqlalchemy import select

    from backend.app.api.v1.endpoints import import_endpoints
    from backend.app.models.bank_provider import BankProvider
    from backend.app.models.import_confirmation import ImportSourceReceipt
    from backend.app.models.import_file_upload import ImportFileUpload

    monkeypatch.setattr(import_endpoints, "UPLOAD_TEMP_DIR", tmp_path)
    monkeypatch.setattr(import_endpoints, "fetch_google_sheets_as_csv", AsyncMock(return_value=STATEMENT))
    bank = (await db_session.execute(select(BankProvider).limit(1))).scalar_one()
    fingerprint = sha256(STATEMENT).hexdigest()
    db_session.add(ImportSourceReceipt(user_id=test_user.id, fingerprint=fingerprint, source_row=2, fact_id=10))
    await db_session.flush()
    result = await authenticated_client.post(
        "/api/v1/import/google-sheets/upload",
        json={
            "bank_provider_id": bank.id,
            "google_sheets_url": "https://docs.google.com/spreadsheets/d/QA123456/edit",
        },
    )
    assert result.status_code == 201, result.text
    assert result.json()["prior_imported_count"] == 1
    upload = await db_session.get(ImportFileUpload, result.json()["file_id"])
    assert upload.fingerprint == fingerprint


@pytest.mark.destructive
@pytest.mark.asyncio
async def test_changed_temp_file_cannot_assume_uploaded_statement_identity(
    authenticated_client,
    db_session,
    test_user,
    tmp_path,
):
    from hashlib import sha256

    from sqlalchemy import select

    from backend.app.models.bank_provider import BankProvider
    from backend.app.models.import_column_mapping import ImportColumnMapping
    from backend.app.models.import_file_upload import ImportFileUpload
    from backend.app.models.import_staging import ImportStaging

    bank = (await db_session.execute(select(BankProvider).limit(1))).scalar_one()
    source = tmp_path / "changed.csv"
    source.write_bytes(STATEMENT + b"2025-11-24;100;Other\r\n")
    upload = ImportFileUpload(
        user_id=test_user.id,
        bank_provider_id=bank.id,
        file_name=source.name,
        fingerprint=sha256(STATEMENT).hexdigest(),
        temp_file_path=str(source),
    )
    mapping = ImportColumnMapping(user_id=test_user.id, bank_provider_id=bank.id, mapping=MAPPING)
    db_session.add_all([upload, mapping])
    await db_session.flush()
    result = await authenticated_client.post(f"/api/v1/import/files/{upload.id}/parse", json={"mapping_id": mapping.id})
    assert result.status_code == 409, result.text
    assert upload.fingerprint == sha256(STATEMENT).hexdigest()
    assert not (await db_session.scalars(select(ImportStaging).where(ImportStaging.file_upload_id == upload.id))).all()
