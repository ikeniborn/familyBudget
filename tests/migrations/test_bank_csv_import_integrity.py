"""Exercise the bank CSV receipt migration against legacy data on PostgreSQL."""
import pytest
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError


async def test_legacy_round_trip_and_source_uniqueness(db_session):
    connection = await db_session.connection()
    await connection.run_sync(_check_migration)


def _check_migration(conn):
    config = Config("backend/db/migrations/alembic.ini")
    scripts = ScriptDirectory.from_config(config)
    revision = "a39e70db1f42"
    assert revision in {item.revision for item in scripts.walk_revisions()}

    # Give the revision a private namespace. Actual tables and facts stay untouched.
    conn.execute(text("CREATE SCHEMA csv_migration_test"))
    conn.execute(text("SET LOCAL search_path TO csv_migration_test"))
    conn.execute(text("CREATE TABLE t_d_user (id integer PRIMARY KEY)"))
    conn.execute(text("INSERT INTO t_d_user VALUES (1), (2)"))
    conn.execute(text("CREATE TABLE t_import_file_upload (id bigint PRIMARY KEY)"))
    conn.execute(text("CREATE TABLE t_import_staging (id bigint PRIMARY KEY)"))
    conn.execute(text("INSERT INTO t_import_file_upload VALUES (11)"))
    conn.execute(text("INSERT INTO t_import_staging VALUES (12)"))

    migration = scripts.get_revision(revision).module
    with Operations.context(MigrationContext.configure(conn)):
        migration.upgrade()
        assert conn.execute(text("SELECT id, fingerprint FROM t_import_file_upload")).one() == (11, None)
        assert conn.execute(text("SELECT id, source_row FROM t_import_staging")).one() == (12, None)
        record = text(
            "INSERT INTO t_import_source_receipt (user_id, fingerprint, source_row, fact_id) "
            "VALUES (:user_id, :fingerprint, :source_row, :fact_id)"
        )
        first = dict(user_id=1, fingerprint="a" * 64, source_row=2, fact_id=71)
        conn.execute(record, first)
        with pytest.raises(IntegrityError), conn.begin_nested():
            conn.execute(record, {**first, "fact_id": 72})
        for changes in ({"user_id": 2}, {"source_row": 3}, {"fingerprint": "b" * 64}):
            conn.execute(record, {**first, **changes})

        confirmation = text(
            "INSERT INTO t_import_confirmation (user_id, confirmation_id, request_hash, response) "
            "VALUES (:user_id, 'review', :request_hash, '{}')"
        )
        conn.execute(confirmation, {"user_id": 1, "request_hash": "c" * 64})
        with pytest.raises(IntegrityError), conn.begin_nested():
            conn.execute(confirmation, {"user_id": 1, "request_hash": "d" * 64})
        conn.execute(confirmation, {"user_id": 2, "request_hash": "d" * 64})

        migration.downgrade()
        assert conn.execute(text("SELECT * FROM t_import_file_upload")).one() == (11,)
        assert conn.execute(text("SELECT * FROM t_import_staging")).one() == (12,)
        assert conn.scalar(text("SELECT to_regclass('t_import_confirmation')")) is None
        assert conn.scalar(text("SELECT to_regclass('t_import_source_receipt')")) is None
