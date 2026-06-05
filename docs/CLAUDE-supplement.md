# CLAUDE.md — Supplement

Supplements the root `CLAUDE.md` (which is the protected source of truth and must not be edited by agents). This file captures commands and conventions that root `CLAUDE.md` omits or states inaccurately. Merge into `CLAUDE.md` manually if desired.

## Backend lint & type checks (missing from root Commands)

Root `CLAUDE.md` lists only ESLint. The Python toolchain:

```bash
ruff check backend bot tests        # lint — line-length 120, rule sets E/W/F/I/UP (config: pyproject.toml)
mypy backend                         # type check — python_version 3.11
# pyright also configured: pyproject.toml [tool.pyright], pythonVersion 3.12, venvPath "."
```

## Running a single backend test

`tests/run-tests.sh backend` runs the whole suite. To run one test or file:

```bash
PYTHONPATH=<repo-root> backend/.venv/bin/pytest backend/tests/path/test_x.py::test_name -v
```

`pytest.ini` (repo root): `asyncio_mode = auto`, `--strict-markers`, `--strict-config`.

## pytest markers (`destructive` is load-bearing)

Defined in root `pytest.ini`:

- **`destructive`** — tests that CREATE/UPDATE/DELETE database state. Post-deploy CI runs `-m "not destructive"` to protect live test-server data. Mark any new mutating test `@pytest.mark.destructive`, or it will run against the live test DB.
- `unit`, `integration`, `backend`, `webapp`, `slow` — discovery/selection markers.

## Database migrations (Alembic)

Config lives under the backend, not repo root:

```bash
backend/.venv/bin/alembic -c backend/db/migrations/alembic.ini upgrade head
```

Migration versions: `backend/db/migrations/versions/`.

## Build pipeline entry points

- `npm run bundle` → `node build-all.js` — Rollup bundle orchestrator (all JS bundles).
- `npm run build:prod` = `build:css` + `build:vendor` + `bundle`.
- `npm run build` = `type-check` + `build:prod`.
- `build:css` batches one `minify:<name>` PostCSS/cssnano script per stylesheet (custom, choices, lists, calendar-widget, z-index, plan, …).

## Corrections to root CLAUDE.md stack notes

- Models use **SQLModel** (`sqlmodel==0.0.22`), not raw SQLAlchemy as the architecture section implies.
- `FastAPI 0.121.2`, `python-telegram-bot 21.10` — correct.
