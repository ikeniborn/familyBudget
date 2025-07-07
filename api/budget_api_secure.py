from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from utils.postgres_secure import PostgresSecure
from utils.models import Models
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Budget API", version="2.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
db = PostgresSecure(
    host=os.getenv("POSTGRES_HOST", "localhost"),
    port=int(os.getenv("POSTGRES_PORT", "5432")),
    database=os.getenv("POSTGRES_DB", "budgetdb"),
    user=os.getenv("POSTGRES_USER", "budget"),
    password=os.getenv("POSTGRES_PASSWORD", "password"),
)


@app.on_event("startup")
async def startup_event():
    """Initialize database connection pool on startup"""
    await db.init_pool()
    logger.info("Application started")


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection pool on shutdown"""
    await db.close_pool()
    logger.info("Application shutdown")


def get_user_id(x_user_id: Optional[str] = Header(None)) -> str:
    """Extract and validate user ID from headers"""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID is required")
    return x_user_id


# Users endpoints
@app.get("/users")
async def get_users(user_id: str = Depends(get_user_id)):
    """Get all users (admin only should see all users)"""
    return await db.fetchall(
        """
        SELECT 
            user_id, 
            user_name,
            user_telegram_id 
        FROM 
            t_d_user
        WHERE 
            is_active = true
        ORDER BY 
            user_name
        """
    )


@app.get("/users/{id}")
async def get_user(id: int, user_id: str = Depends(get_user_id)):
    """Get specific user by ID"""
    # Users should only be able to see their own data
    if str(id) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.fetchone(
        """
        SELECT
            user_id,
            user_name,
            user_email,
            user_telegram_id
        FROM
            t_d_user
        WHERE
            user_id = $1 AND is_active = true
        """,
        id
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    
    return result


# Periods endpoints
@app.get("/periods")
async def get_periods(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: str = Depends(get_user_id)
):
    """Get periods with optional date filtering"""
    if start_date and end_date:
        rows = await db.fetchall(
            """
            SELECT
                period_id,
                period_dt,
                period_ru_name
            FROM
                t_d_period
            WHERE 
                period_dt >= $1 AND period_dt <= $2
            ORDER BY
                period_dt
            """,
            start_date,
            end_date
        )
    else:
        rows = await db.fetchall(
            """
            SELECT
                period_id,
                period_dt,
                period_ru_name
            FROM
                t_d_period
            ORDER BY
                period_dt
            """
        )
    
    return [
        Models.Period(period_id=row['period_id'], period_dt=row['period_dt'], period_ru_name=row['period_ru_name'])
        for row in rows
    ]


@app.get("/periods/{id}")
async def get_period(id: int, user_id: str = Depends(get_user_id)):
    """Get specific period by ID"""
    result = await db.fetchone(
        """
        SELECT
            period_id,
            period_dt,
            period_ru_name
        FROM
            t_d_period
        WHERE
            period_id = $1
        """,
        id
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Period not found")
    
    return Models.Period(
        period_id=result['period_id'],
        period_dt=result['period_dt'],
        period_ru_name=result['period_ru_name']
    )


# Financial centers endpoints
@app.get("/financial_centers")
async def get_financial_centers(user_id: str = Depends(get_user_id)):
    """Get all financial centers"""
    return await db.fetchall(
        """
        SELECT
            financial_center_id,
            financial_center_name
        FROM
            t_d_financial_center
        ORDER BY
            financial_center_name
        """
    )


@app.get("/financial_centers/{id}")
async def get_financial_center(id: int, user_id: str = Depends(get_user_id)):
    """Get specific financial center by ID"""
    result = await db.fetchone(
        """
        SELECT
            financial_center_id,
            financial_center_name
        FROM
            t_d_financial_center
        WHERE
            financial_center_id = $1
        """,
        id
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Financial center not found")
    
    return result


# Cost centers endpoints
@app.get("/cost_centers")
async def get_cost_centers(user_id: str = Depends(get_user_id)):
    """Get all cost centers"""
    return await db.fetchall(
        """
        SELECT
            cost_center_id,
            cost_center_name
        FROM
            t_d_cost_center
        ORDER BY
            cost_center_name
        """
    )


@app.get("/cost_centers/{id}")
async def get_cost_center(id: int, user_id: str = Depends(get_user_id)):
    """Get specific cost center by ID"""
    result = await db.fetchone(
        """
        SELECT
            cost_center_id,
            cost_center_name
        FROM
            t_d_cost_center
        WHERE
            cost_center_id = $1
        """,
        id
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Cost center not found")
    
    return result


# Nomenclatures endpoints
@app.get("/nomenclatures")
async def get_nomenclatures(user_id: str = Depends(get_user_id)):
    """Get all nomenclatures"""
    return await db.fetchall(
        """
        SELECT
            nomenclature_id,
            nomenclature_name,
            account_name,
            bill_name,
            operation_name,
            is_budget,
            is_fact
        FROM
            t_d_nomenclature
        WHERE 
            is_budget = true OR is_fact = true
        ORDER BY 
            operation_name,
            nomenclature_name
        """
    )


@app.get("/nomenclatures/{id}")
async def get_nomenclature(id: int, user_id: str = Depends(get_user_id)):
    """Get specific nomenclature by ID"""
    result = await db.fetchone(
        """
        SELECT
            nomenclature_id,
            nomenclature_name,
            account_name,
            bill_name,
            operation_name,
            is_budget,
            is_fact
        FROM
            t_d_nomenclature
        WHERE
            nomenclature_id = $1
        """,
        id
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Nomenclature not found")
    
    return result


# Row types endpoints
@app.get("/row_types")
async def get_row_types(user_id: str = Depends(get_user_id)):
    """Get all row types"""
    return await db.fetchall(
        """
        SELECT
            row_type_id,
            row_type_name
        FROM
            t_d_row_type
        ORDER BY
            row_type_id
        """
    )


@app.get("/row_types/{id}")
async def get_row_type(id: int, user_id: str = Depends(get_user_id)):
    """Get specific row type by ID"""
    result = await db.fetchone(
        """
        SELECT
            row_type_id,
            row_type_name
        FROM
            t_d_row_type
        WHERE
            row_type_id = $1
        """,
        id
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Row type not found")
    
    return result


# Registry endpoints
@app.post("/registry")
async def insert_to_registry(row: Models.Registry, user_id: str = Depends(get_user_id)):
    """Insert new registry entry"""
    # Ensure user can only insert for themselves
    if str(row.user_id) != user_id:
        raise HTTPException(status_code=403, detail="Cannot create registry for another user")
    
    await db.execute(
        """
        INSERT INTO t_f_registry (
            operation_dttm,
            period_id,
            financial_center_id,
            cost_center_id,
            nomenclature_id,
            cost_sum,
            comment_description,
            row_type_id,
            user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
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


@app.get("/registry/last_row")
async def get_registry_last_row(
    row_type_id: Optional[int] = None,
    limit_rows: int = 5,
    user_id: str = Depends(get_user_id)
):
    """Get last registry entries for current user"""
    if row_type_id:
        return await db.fetchall(
            """
            SELECT
                t0.operation_dttm::date as "Дата операции",
                t1.period_ru_name as "Период",
                t2.financial_center_name as "ЦФО",
                t3.cost_center_name as "МВЗ",
                t4.nomenclature_name as "Номенклатура",
                t0.cost_sum as "Сумма",
                t0.comment_description as "Комментарий"
            FROM t_f_registry t0
            JOIN t_d_period t1 USING(period_id)
            JOIN t_d_financial_center t2 USING(financial_center_id)
            JOIN t_d_cost_center t3 USING(cost_center_id)
            JOIN t_d_nomenclature t4 USING(nomenclature_id)
            WHERE
                t0.row_type_id = $1 AND t0.user_id = $2
            ORDER BY
                t0.registry_id DESC
            LIMIT $3
            """,
            row_type_id,
            int(user_id),
            limit_rows
        )
    else:
        return await db.fetchall(
            """
            SELECT
                t0.operation_dttm::date as "Дата операции",
                t1.period_ru_name as "Период",
                t2.financial_center_name as "ЦФО",
                t3.cost_center_name as "МВЗ",
                t4.nomenclature_name as "Номенклатура",
                t0.cost_sum as "Сумма",
                t0.comment_description as "Комментарий"
            FROM t_f_registry t0
            JOIN t_d_period t1 USING(period_id)
            JOIN t_d_financial_center t2 USING(financial_center_id)
            JOIN t_d_cost_center t3 USING(cost_center_id)
            JOIN t_d_nomenclature t4 USING(nomenclature_id)
            WHERE
                t0.user_id = $1
            ORDER BY
                t0.registry_id DESC
            LIMIT $2
            """,
            int(user_id),
            limit_rows
        )


# Report endpoints
@app.get("/report/budget/row_type_nomenclature")
async def get_report_budget_row_type_nomenclature(
    financial_center_id: int,
    period_id: int,
    nomenclature_id: Optional[int] = None,
    user_id: str = Depends(get_user_id)
):
    """Get budget report by row type and nomenclature"""
    if nomenclature_id:
        return await db.fetchall(
            """
            SELECT
                t4.row_type_name as "Тип",
                t3.nomenclature_name as "Номенклатура",
                sum(cost_sum) as "Сумма"
            FROM
                t_f_registry t0
            JOIN t_d_financial_center t2 USING(financial_center_id)
            JOIN t_d_nomenclature t3 USING(nomenclature_id)
            JOIN t_d_row_type t4 USING(row_type_id)
            WHERE
                t0.financial_center_id = $1
                AND t0.period_id = $2
                AND t0.nomenclature_id = $3
                AND t0.user_id = $4
            GROUP BY
                t4.row_type_name,
                t3.nomenclature_name
            ORDER BY
                t4.row_type_name
            """,
            financial_center_id,
            period_id,
            nomenclature_id,
            int(user_id)
        )
    else:
        return await db.fetchall(
            """
            SELECT
                t4.row_type_name as "Тип",
                t3.nomenclature_name as "Номенклатура",
                sum(cost_sum) as "Сумма"
            FROM
                t_f_registry t0
            JOIN t_d_financial_center t2 USING(financial_center_id)
            JOIN t_d_nomenclature t3 USING(nomenclature_id)
            JOIN t_d_row_type t4 USING(row_type_id)
            WHERE
                t0.financial_center_id = $1
                AND t0.period_id = $2
                AND t0.user_id = $3
            GROUP BY
                t4.row_type_name,
                t3.nomenclature_name
            ORDER BY
                t4.row_type_name
            """,
            financial_center_id,
            period_id,
            int(user_id)
        )


@app.get("/report/compare/row_type_nomenclature")
async def get_report_compare_row_type_nomenclature(
    financial_center_id: int,
    period_id: int,
    user_id: str = Depends(get_user_id)
):
    """Get comparison report by row type and nomenclature"""
    return await db.fetchall(
        """
        SELECT
            t4.row_type_name as "Тип",
            t3.nomenclature_name as "Номенклатура",
            sum(cost_sum) as "Сумма"
        FROM
            t_f_registry t0
        JOIN t_d_financial_center t2 USING(financial_center_id)
        JOIN t_d_nomenclature t3 USING(nomenclature_id)
        JOIN t_d_row_type t4 USING(row_type_id)
        WHERE
            t0.financial_center_id = $1
            AND t0.period_id = $2
            AND t0.user_id = $3
        GROUP BY
            t4.row_type_name,
            t3.nomenclature_name
        ORDER BY
            t4.row_type_name
        """,
        financial_center_id,
        period_id,
        int(user_id)
    )


@app.get("/report/compare/row_type_operation")
async def get_report_compare_row_type_operation(
    financial_center_id: int,
    period_id: int,
    user_id: str = Depends(get_user_id)
):
    """Get comparison report by row type and operation"""
    return await db.fetchall(
        """
        SELECT
            t2.row_type_name AS "Тип",
            t1.operation_name AS "Операция",
            sum(t0.cost_sum) AS "Сумма"
        FROM
            t_f_registry t0
        JOIN t_d_nomenclature t1 USING(nomenclature_id)
        JOIN t_d_row_type t2 USING(row_type_id)
        WHERE
            t0.financial_center_id = $1
            AND t0.period_id = $2
            AND t0.user_id = $3
        GROUP BY 
            t2.row_type_name,
            t1.operation_name
        ORDER BY
            t2.row_type_name,
            t1.operation_name
        """,
        financial_center_id,
        period_id,
        int(user_id)
    )


@app.get("/report/compare/row_type_bill")
async def get_report_compare_row_type_bill(
    financial_center_id: int,
    period_id: int,
    user_id: str = Depends(get_user_id)
):
    """Get comparison report by row type and bill"""
    return await db.fetchall(
        """
        SELECT
            t2.row_type_name AS "Тип",
            t1.bill_name AS "Счет",
            sum(t0.cost_sum) AS "Сумма"
        FROM
            t_f_registry t0
        JOIN t_d_nomenclature t1 USING(nomenclature_id)
        JOIN t_d_row_type t2 USING(row_type_id)
        WHERE
            t0.financial_center_id = $1
            AND t0.period_id = $2
            AND t0.user_id = $3
        GROUP BY 
            t2.row_type_name,
            t1.bill_name
        ORDER BY
            t2.row_type_name,
            t1.bill_name
        """,
        financial_center_id,
        period_id,
        int(user_id)
    )


@app.get("/report/compare/row_type_account")
async def get_report_compare_row_type_account(
    financial_center_id: int,
    period_id: int,
    user_id: str = Depends(get_user_id)
):
    """Get comparison report by row type and account"""
    return await db.fetchall(
        """
        SELECT
            t2.row_type_name AS "Тип",
            t1.account_name AS "Статья",
            sum(t0.cost_sum) AS "Сумма"
        FROM
            t_f_registry t0
        JOIN t_d_nomenclature t1 USING(nomenclature_id)
        JOIN t_d_row_type t2 USING(row_type_id)
        WHERE
            t0.financial_center_id = $1
            AND t0.period_id = $2
            AND t0.user_id = $3
        GROUP BY 
            t2.row_type_name,
            t1.account_name
        ORDER BY
            t2.row_type_name,
            t1.account_name
        """,
        financial_center_id,
        period_id,
        int(user_id)
    )


@app.get("/report/budget/total")
async def get_report_budget_total(
    financial_center_id: int,
    period_id: int,
    user_id: str = Depends(get_user_id)
):
    """Get total budget sum"""
    result = await db.fetchval(
        """
        SELECT
            COALESCE(sum(t0.cost_sum), 0) AS "Сумма"
        FROM
            t_f_registry t0
        WHERE
            t0.financial_center_id = $1
            AND t0.period_id = $2
            AND t0.row_type_id = 1
            AND t0.user_id = $3
        """,
        financial_center_id,
        period_id,
        int(user_id)
    )
    
    return {"Сумма": result}


@app.get("/report/budget/bill_account")
async def get_report_budget_bill_account(
    financial_center_id: int,
    period_id: int,
    user_id: str = Depends(get_user_id)
):
    """Get budget report by bill and account"""
    return await db.fetchall(
        """
        SELECT
            t1.bill_name AS "Счет",
            t1.account_name AS "Статья",
            sum(t0.cost_sum) AS "Сумма"
        FROM
            t_f_registry t0
        JOIN t_d_nomenclature t1 USING(nomenclature_id) 
        WHERE
            t0.financial_center_id = $1
            AND t0.period_id = $2
            AND t0.row_type_id = 1
            AND t0.user_id = $3
        GROUP BY
            t1.bill_name,
            t1.account_name
        ORDER BY
            t1.bill_name,
            t1.account_name
        """,
        financial_center_id,
        period_id,
        int(user_id)
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check database connection
        await db.fetchval("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")