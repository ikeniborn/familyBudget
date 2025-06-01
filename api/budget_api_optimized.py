from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta, datetime
from utils.postgres_optimized import PostgresOptimized
from utils.models import Models
from utils.auth import (
    get_current_user,
    verify_password,
    get_password_hash,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from utils.redis_client import redis_client, cache_result, invalidate_cache, LONG_TTL, SHORT_TTL
from utils import queries
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Budget API", version="2.0.0")

# Use optimized connection with pooling
connection = PostgresOptimized(
    host=os.getenv("POSTGRES_HOST"),
    database=os.getenv("POSTGRES_DB"),
    user=os.getenv("POSTGRES_USER"),
    password=os.getenv("POSTGRES_PASSWORD"),
)


@app.on_event("startup")
async def startup_event():
    """Initialize connections on startup."""
    await connection.init_pool()
    await redis_client.connect()
    logger.info("Application startup complete")


@app.on_event("shutdown")
async def shutdown_event():
    """Close connections on shutdown."""
    await connection.close_pool()
    await redis_client.close()
    logger.info("Application shutdown complete")


@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate user and return JWT token."""
    # Use parameterized query to prevent SQL injection
    user_data = await connection.fetchrow(
        queries.GET_USER_BY_USERNAME,
        form_data.username
    )
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not user_data.get('user_password_hash') or not verify_password(
        form_data.password, user_data['user_password_hash']
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_data['user_name'], "user_id": user_data['user_id']}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/users", dependencies=[Depends(get_current_user)])
@cache_result("users", ttl=LONG_TTL)
async def get_users():
    """Get all users."""
    rows = await connection.fetch(queries.GET_ALL_USERS)
    return [dict(row) for row in rows]


@app.get("/users/{id}", dependencies=[Depends(get_current_user)])
async def get_user(id: int):
    """Get user by ID."""
    row = await connection.fetchrow(queries.GET_USER_BY_ID, id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row)


@app.get("/periods", dependencies=[Depends(get_current_user)])
async def get_periods(start_date: str = None, end_date: str = None):
    """Get periods with optional date range filter."""
    if start_date and end_date:
        # Validate dates
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        rows = await connection.fetch(queries.GET_PERIODS_BY_DATE_RANGE, start, end)
    else:
        rows = await connection.fetch(queries.GET_ALL_PERIODS)
    
    return [Models.Period(
        period_id=row['period_id'],
        period_dt=row['period_dt'],
        period_ru_name=row['period_ru_name']
    ) for row in rows]


@app.get("/periods/{id}", dependencies=[Depends(get_current_user)])
async def get_period(id: int):
    """Get period by ID."""
    row = await connection.fetchrow(queries.GET_PERIOD_BY_ID, id)
    if not row:
        raise HTTPException(status_code=404, detail="Period not found")
    
    return Models.Period(
        period_id=row['period_id'],
        period_dt=row['period_dt'],
        period_ru_name=row['period_ru_name']
    )


@app.get("/financial_centers", dependencies=[Depends(get_current_user)])
@cache_result("financial_centers", ttl=LONG_TTL)
async def get_financial_centers():
    """Get all financial centers."""
    rows = await connection.fetch(queries.GET_ALL_FINANCIAL_CENTERS)
    return [dict(row) for row in rows]


@app.get("/financial_centers/{id}", dependencies=[Depends(get_current_user)])
async def get_financial_center(id: int):
    """Get financial center by ID."""
    row = await connection.fetchrow(queries.GET_FINANCIAL_CENTER_BY_ID, id)
    if not row:
        raise HTTPException(status_code=404, detail="Financial center not found")
    return dict(row)


@app.get("/cost_centers", dependencies=[Depends(get_current_user)])
@cache_result("cost_centers", ttl=LONG_TTL)
async def get_cost_centers():
    """Get all cost centers."""
    rows = await connection.fetch(queries.GET_ALL_COST_CENTERS)
    return [dict(row) for row in rows]


@app.get("/cost_centers/{id}", dependencies=[Depends(get_current_user)])
async def get_cost_center(id: int):
    """Get cost center by ID."""
    row = await connection.fetchrow(queries.GET_COST_CENTER_BY_ID, id)
    if not row:
        raise HTTPException(status_code=404, detail="Cost center not found")
    return dict(row)


@app.get("/nomenclatures", dependencies=[Depends(get_current_user)])
@cache_result("nomenclatures", ttl=LONG_TTL)
async def get_nomenclatures():
    """Get active nomenclatures."""
    rows = await connection.fetch(queries.GET_ACTIVE_NOMENCLATURES)
    return [dict(row) for row in rows]


@app.get("/nomenclatures/{id}", dependencies=[Depends(get_current_user)])
async def get_nomenclature(id: int):
    """Get nomenclature by ID."""
    row = await connection.fetchrow(queries.GET_NOMENCLATURE_BY_ID, id)
    if not row:
        raise HTTPException(status_code=404, detail="Nomenclature not found")
    return dict(row)


@app.get("/row_types")
@cache_result("row_types", ttl=LONG_TTL)
async def get_row_types():
    """Get all row types."""
    rows = await connection.fetch(queries.GET_ALL_ROW_TYPES)
    return [dict(row) for row in rows]


@app.get("/row_types/{id}")
async def get_row_type(id: int):
    """Get row type by ID."""
    row = await connection.fetchrow(queries.GET_ROW_TYPE_BY_ID, id)
    if not row:
        raise HTTPException(status_code=404, detail="Row type not found")
    return dict(row)


@app.post("/registry", dependencies=[Depends(get_current_user)])
@invalidate_cache("registry:*")
async def insert_to_registry(row: Models.Registry):
    """Insert new registry entry."""
    try:
        await connection.execute(
            queries.INSERT_REGISTRY,
            row.operation_dttm,
            row.period_id,
            row.financial_center_id,
            row.cost_center_id,
            row.nomenclature_id,
            row.cost_sum,
            row.comment_description,
            row.row_type_id,
            row.user_id
        )
        return {"status": "success", "message": "Registry entry created"}
    except Exception as e:
        logger.error(f"Registry insert error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/registry/last_row")
@cache_result("registry:last_row", ttl=SHORT_TTL)
async def get_registry_last_row(row_type_id: int = None, limit_rows: int = 5):
    """Get last registry rows."""
    if not row_type_id:
        raise HTTPException(status_code=400, detail="row_type_id is required")
    
    if limit_rows > 100:
        limit_rows = 100  # Prevent too large queries
    
    rows = await connection.fetch(queries.GET_LAST_REGISTRY_ROWS, row_type_id, limit_rows)
    return [dict(row) for row in rows]


@app.get("/report/compare/row_type_nomenclature")
async def get_report_compare_row_type_nomenclature(
    financial_center_id: int = None,
    period_id: int = None,
    nomenclature_id: int = None
):
    """Get comparison report by row type and nomenclature."""
    if not financial_center_id or not period_id:
        raise HTTPException(
            status_code=400,
            detail="financial_center_id and period_id are required"
        )
    
    rows = await connection.fetch(
        queries.GET_REPORT_BY_TYPE_NOMENCLATURE,
        financial_center_id,
        period_id,
        nomenclature_id  # Can be None for all nomenclatures
    )
    return [dict(row) for row in rows]


@app.get("/report/compare/row_type_operation")
async def get_report_compare_row_type_operation(
    financial_center_id: int = None,
    period_id: int = None
):
    """Get comparison report by row type and operation."""
    if not financial_center_id or not period_id:
        raise HTTPException(
            status_code=400,
            detail="financial_center_id and period_id are required"
        )
    
    rows = await connection.fetch(
        queries.GET_REPORT_BY_TYPE_OPERATION,
        financial_center_id,
        period_id
    )
    return [dict(row) for row in rows]


@app.get("/report/budget/total")
async def get_report_budget_total(
    financial_center_id: int = None,
    period_id: int = None
):
    """Get budget total report."""
    if not financial_center_id or not period_id:
        raise HTTPException(
            status_code=400,
            detail="financial_center_id and period_id are required"
        )
    
    result = await connection.fetchval(
        queries.GET_BUDGET_TOTAL,
        financial_center_id,
        period_id
    )
    return {"Сумма": result or 0}


@app.get("/report/budget/bill_account")
async def get_report_budget_bill_account(
    financial_center_id: int = None,
    period_id: int = None
):
    """Get budget report by bill and account."""
    if not financial_center_id or not period_id:
        raise HTTPException(
            status_code=400,
            detail="financial_center_id and period_id are required"
        )
    
    rows = await connection.fetch(
        queries.GET_BUDGET_BY_BILL_ACCOUNT,
        financial_center_id,
        period_id
    )
    return [dict(row) for row in rows]