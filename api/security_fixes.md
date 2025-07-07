# Security Fixes for Backend API

## SQL Injection Vulnerabilities

### Current Issues

The Backend API has multiple SQL injection vulnerabilities due to string interpolation in SQL queries.

### Examples of Vulnerable Code

```python
# VULNERABLE - String interpolation
@app.get("/nomenclatures/{id}")
async def get_nomenclature(id: int):
    return await connection.select(
        f"""
        select * from t_d_nomenclature
        where nomenclature_id in ('{id}')
        """
    )

# VULNERABLE - User input in WHERE clause
sql = f"WHERE user_id='{user_id}' AND period_id={period_id}"
```

### Fixed Code Examples

```python
# SECURE - Parameterized queries
@app.get("/nomenclatures/{id}")
async def get_nomenclature(id: int):
    return await connection.select(
        """
        select * from t_d_nomenclature
        where nomenclature_id = $1
        """,
        id  # Parameter passed separately
    )

# SECURE - Using query parameters
async def get_user_data(user_id: str, period_id: int):
    return await connection.select(
        """
        SELECT * FROM t_f_registry
        WHERE user_id = $1 AND period_id = $2
        """,
        user_id, period_id
    )
```

## User Context Validation

### Add Authentication Middleware

```python
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Validate token and extract user_id
    # This should match the Frontend API's session validation
    pass

# Use in endpoints
@app.get("/registry")
async def get_registry(user_id: str = Depends(get_current_user)):
    return await connection.select(
        """
        SELECT * FROM t_f_registry
        WHERE user_id = $1
        ORDER BY created_dttm DESC
        """,
        user_id
    )
```

## Connection Security

### Use Connection Pooling

```python
import asyncpg
from contextlib import asynccontextmanager

class DatabasePool:
    def __init__(self):
        self.pool = None
    
    async def init_pool(self):
        self.pool = await asyncpg.create_pool(
            host=os.getenv('POSTGRES_HOST'),
            port=os.getenv('POSTGRES_PORT'),
            user=os.getenv('POSTGRES_USER'),
            password=os.getenv('POSTGRES_PASSWORD'),
            database=os.getenv('POSTGRES_DB'),
            min_size=10,
            max_size=20
        )
    
    @asynccontextmanager
    async def acquire(self):
        async with self.pool.acquire() as connection:
            yield connection

db = DatabasePool()

# Usage
@app.on_event("startup")
async def startup():
    await db.init_pool()

@app.get("/users")
async def get_users(user_id: str = Depends(get_current_user)):
    async with db.acquire() as conn:
        return await conn.fetch(
            "SELECT * FROM t_d_user WHERE user_id = $1",
            user_id
        )
```

## Input Validation

### Use Pydantic Models

```python
from pydantic import BaseModel, validator
from datetime import date
from decimal import Decimal

class RegistryInput(BaseModel):
    user_id: int
    period_id: int
    financial_center_id: int
    cost_center_id: int
    nomenclature_id: int
    row_type_id: int
    registry_date: date
    qty: Decimal
    price: Decimal
    
    @validator('qty', 'price')
    def validate_positive(cls, v):
        if v <= 0:
            raise ValueError('Must be positive')
        return v
    
    @validator('registry_date')
    def validate_date_not_future(cls, v):
        if v > date.today():
            raise ValueError('Date cannot be in the future')
        return v

@app.post("/registry")
async def create_registry(
    data: RegistryInput,
    user_id: str = Depends(get_current_user)
):
    # Ensure user can only create for themselves
    if str(data.user_id) != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    # Safe insertion with validated data
    async with db.acquire() as conn:
        return await conn.fetchrow(
            """
            INSERT INTO t_f_registry (
                user_id, period_id, financial_center_id,
                cost_center_id, nomenclature_id, row_type_id,
                registry_date, qty, price, total_value
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
            """,
            data.user_id, data.period_id, data.financial_center_id,
            data.cost_center_id, data.nomenclature_id, data.row_type_id,
            data.registry_date, data.qty, data.price, data.qty * data.price
        )
```

## Implementation Priority

1. **CRITICAL - Fix SQL Injections** (1-2 days)
   - Replace all f-strings in SQL queries
   - Use parameterized queries

2. **HIGH - Add Authentication** (2-3 days)
   - Add middleware to validate user context
   - Ensure all queries filter by authenticated user

3. **MEDIUM - Connection Pooling** (1 day)
   - Replace single connection with pool
   - Better performance and reliability

4. **MEDIUM - Input Validation** (2-3 days)
   - Add Pydantic models for all inputs
   - Validate business rules