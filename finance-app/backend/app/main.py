from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import (  # Import routers
    auth, accounts, categories, transactions, budgets, reports
)
# Initialize FastAPI app
app = FastAPI(
    title="Family Budget API",
    description="API for managing personal finances.",
    version="0.1.0",
)

# Configure CORS (Cross-Origin Resource Sharing)
# Allows the frontend (running on a different origin) to communicate.
# Adjust origins for production.
origins = [
    "http://localhost",          # Allow localhost for development
    "http://localhost:5173",     # Default Vite frontend dev port
    "http://127.0.0.1:5173",
    # Add frontend production domain(s) here later
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allow all headers
)


@app.get("/")
async def read_root():
    """
    Root endpoint for basic API health check.
    """
    return {"message": "Welcome to the Family Budget API!"}

# Include routers
# All routers imported above now
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])
app.include_router(categories.router, prefix="/categories", tags=["Categories"])  # noqa: E501
app.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])  # noqa: E501
app.include_router(budgets.router, prefix="/budgets", tags=["Budgets"])
app.include_router(reports.router, prefix="/reports", tags=["Reports"])

# Placeholder for database initialization
# from .database import engine, Base
# Base.metadata.create_all(bind=engine)  # Use Alembic in production!

if __name__ == "__main__":
    import uvicorn
    # This block is mainly for local debugging without Docker
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)