# Personal Home Finance Web Application - Development Plan

**1. Project Goal:**

Develop a modern, secure, and user-friendly web application for personal finance management, featuring budget tracking, transaction logging, and insightful reporting.

**2. Project Setup & Structure:**

*   Create a root directory: `finance-app/`
*   Initialize a Git repository within `finance-app/`.
*   Establish the following subdirectory structure:
    *   `finance-app/backend/`: For the FastAPI application code.
    *   `finance-app/frontend/`: For the Vue.js application code.
    *   `finance-app/database/`: For database schema definitions (e.g., `schema.sql`).
    *   `finance-app/docs/`: For project documentation.
*   Create a `docker-compose.yml` file in the root (`finance-app/`).
*   Create a `.gitignore` file in the root.

**3. Technology Stack:**

*   **Backend:**
    *   Language/Framework: Python 3.10+, FastAPI
    *   Database ORM: SQLAlchemy (with Alembic for migrations)
    *   Data Validation: Pydantic
    *   Authentication: `python-jose` (JWT), `passlib[bcrypt]` (hashing)
    *   Telegram Integration: Relevant Python library (focus on validating login widget response)
    *   ASGI Server: Uvicorn
*   **Frontend:**
    *   Framework: Vue.js 3 (using Composition API)
    *   Build Tool: Vite
    *   UI Library: **Tailwind CSS** (with a component library like Headless UI or daisyUI if desired)
    *   State Management: Pinia
    *   API Client: Axios
    *   Charting Library: Chart.js (or similar compatible library)
*   **Database:** PostgreSQL (Version 13 or newer)
*   **Containerization:** Docker, Docker Compose

**4. Backend Development (FastAPI - `finance-app/backend/`)**

*   **Database Schema (PostgreSQL):**
    ```mermaid
    erDiagram
        USERS ||--o{ ACCOUNTS : "manages"
        USERS ||--o{ CATEGORIES : "defines"
        USERS ||--o{ TRANSACTIONS : "performs"
        USERS ||--o{ BUDGETS : "sets"
        ACCOUNTS ||--o{ TRANSACTIONS : "has"
        CATEGORIES ||--o{ TRANSACTIONS : "categorizes"
        CATEGORIES ||--o{ BUDGETS : "applies to"

        USERS {
            INT id PK
            VARCHAR email UNIQUE
            VARCHAR hashed_password
            VARCHAR telegram_id NULLABLE UNIQUE
            TIMESTAMP created_at
            TIMESTAMP updated_at
        }

        ACCOUNTS {
            INT id PK
            INT user_id FK
            VARCHAR name
            VARCHAR type "e.g., Checking, Savings, Credit Card, Cash"
            TIMESTAMP created_at
            TIMESTAMP updated_at
        }

        CATEGORIES {
            INT id PK
            INT user_id FK
            VARCHAR name
            TIMESTAMP created_at
            TIMESTAMP updated_at
        }

        TRANSACTIONS {
            INT id PK
            INT user_id FK
            INT account_id FK
            INT category_id FK NULLABLE "Allow uncategorized"
            DATE date
            DECIMAL amount
            VARCHAR type "Income | Expense"
            TEXT description NULLABLE
            TIMESTAMP created_at
            TIMESTAMP updated_at
        }

        BUDGETS {
            INT id PK
            INT user_id FK
            INT category_id FK
            DATE month_year "Store as first day of the month, e.g., 2025-04-01"
            DECIMAL allocated_amount
            TIMESTAMP created_at
            TIMESTAMP updated_at
            UNIQUE (user_id, category_id, month_year)
        }
    ```
    *   Define SQLAlchemy models corresponding to this schema.
    *   Use Alembic for managing database schema migrations.

*   **API Endpoints (RESTful):**
    *   **Authentication (`/auth`)**
        *   `POST /register`: Native user registration.
        *   `POST /login`: Native email/password login (returns JWT).
        *   `POST /login/telegram`: Handle Telegram Login widget callback, validate data, return JWT.
        *   `GET /me`: Get current authenticated user details (requires JWT).
    *   **Accounts (`/accounts`)**
        *   `POST /`: Create a new account.
        *   `GET /`: List user's accounts.
        *   `PUT /{account_id}`: Update an account.
        *   `DELETE /{account_id}`: Delete an account.
    *   **Categories (`/categories`)**
        *   `POST /`: Create a new category.
        *   `GET /`: List user's categories.
        *   `PUT /{category_id}`: Update a category.
        *   `DELETE /{category_id}`: Delete a category.
    *   **Budgets (`/budgets`)**
        *   `POST /`: Set or update a budget for a category/month.
        *   `GET /`: Get budgets (filterable by `month_year` range).
        *   `DELETE /{budget_id}`: Delete a specific budget entry (or by category/month).
    *   **Transactions (`/transactions`)**
        *   `POST /`: Add a new transaction.
        *   `GET /`: List transactions (with filtering: date range, category, account, type; and sorting).
        *   `PUT /{transaction_id}`: Update a transaction.
        *   `DELETE /{transaction_id}`: Delete a transaction.
    *   **Reports (`/reports`)**
        *   `GET /spending-by-category`: Aggregated spending per category (filterable: date range, accounts).
        *   `GET /income-vs-expense`: Aggregated income and expense totals over time (filterable: date range, accounts).
        *   `GET /budget-vs-actual`: Comparison of allocated budget vs actual spending per category (filterable: month(s), categories).

*   **Implementation Details:**
    *   Structure the FastAPI app using Routers for modularity.
    *   Implement secure password hashing using `passlib`.
    *   Generate and validate JWTs using `python-jose` for session management.
    *   Use FastAPI's dependency injection system for database sessions and authentication checks.
    *   Validate request/response data using Pydantic models.
    *   Implement logic for Telegram Login validation based on Telegram's documentation.
    *   Write unit and integration tests.

**5. Frontend Development (Vue.js - `finance-app/frontend/`)**

*   **Setup:**
    *   Use Vite (`npm create vite@latest finance-app/frontend -- --template vue-ts`).
    *   Install Tailwind CSS, Pinia, Axios, Vue Router, Chart.js (or similar). Consider Headless UI or daisyUI for pre-built Tailwind components.
*   **UI Library:** Tailwind CSS.
*   **Routing (Vue Router):** Define routes for:
    *   `/login`
    *   `/register`
    *   `/telegram-auth` (Callback page for Telegram Login)
    *   `/dashboard` (Main authenticated view, potentially combining reports/overview)
    *   `/budgets`
    *   `/transactions`
    *   `/reports`
    *   `/settings` (For managing Accounts, Categories)
    *   Implement route guards to protect authenticated routes.
*   **Pages/Views & Components:**
    *   Create views for each route.
    *   Break down views into reusable components using Tailwind CSS for styling (e.g., `LoginForm`, `RegistrationForm`, `BudgetCard`, `TransactionTable`, `TransactionForm`, `CategorySelect`, `AccountSelect`, `ReportChart`, `DataTable`, `Sidebar`, `Navbar`).
*   **State Management (Pinia):**
    *   Create stores for: `auth` (user info, token, auth status), `accounts`, `categories`, `transactions`, `budgets`, `reports`.
    *   Manage API data fetching and caching within stores.
*   **API Communication:**
    *   Create composables or services using Axios to interact with the backend API.
    *   Configure Axios instance to automatically include the JWT in Authorization headers.
    *   Handle API errors gracefully.
*   **UI/UX:**
    *   Focus on a clean, intuitive interface using Tailwind utility classes.
    *   Implement responsive design for desktop and mobile.
    *   Use charts for visualizations on the Reporting page.
    *   Provide clear feedback to the user (loading states, success/error messages).

**6. Database Setup (`finance-app/database/`)**

*   Create `schema.sql` containing the `CREATE TABLE` statements (useful for reference or initial setup if not using migrations first).
*   Rely primarily on Alembic migrations managed within the backend codebase for schema evolution.

**7. Containerization (`finance-app/docker-compose.yml`)**

*   Define services:
    *   `db`: PostgreSQL image, configure ports, volumes for data persistence, environment variables (passwords, db name).
    *   `backend`: Build from `finance-app/backend/Dockerfile`, link to `db`, map ports, manage environment variables (database connection string, JWT secret, Telegram bot token/secret).
    *   `frontend`: Build from `finance-app/frontend/Dockerfile` (using a multi-stage build with Nginx to serve static files is common for production), map ports.
*   Define networks for inter-service communication.
*   Use `.env` files (`backend.env`, `db.env`) to manage sensitive configuration.

**8. Security Considerations:**

*   **Input Validation:** Rigorously validate all user input on both frontend and backend (Pydantic helps significantly on the backend).
*   **Authentication:** Secure password hashing (bcrypt), robust JWT implementation (short expiry, refresh tokens if needed), secure handling of Telegram auth data.
*   **Authorization:** Ensure users can only access/modify their own data (check `user_id` in all relevant queries).
*   **SQL Injection:** Prevented by using the ORM (SQLAlchemy) correctly with parameterized queries.
*   **XSS (Cross-Site Scripting):** Vue.js provides good protection by default. Sanitize any user-generated content if rendered directly as HTML (though generally avoid this). Use Tailwind safely.
*   **CSRF (Cross-Site Request Forgery):** Less of a concern for stateless JWT APIs if tokens are stored securely (e.g., `localStorage` or `sessionStorage`) and not in cookies without proper protection. FastAPI has middleware options if needed.
*   **HTTPS:** Essential for deployment (can be handled by a reverse proxy like Nginx or Traefik).
*   **Dependency Security:** Keep libraries updated.