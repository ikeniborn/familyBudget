"""Optimized SQL queries with parameterized queries."""

# User queries
GET_USER_BY_USERNAME = """
    SELECT 
        user_id,
        user_name,
        user_password_hash
    FROM t_d_user
    WHERE user_name = $1
    LIMIT 1
"""

GET_ALL_USERS = """
    SELECT 
        user_id, 
        user_name,
        user_telegram_id 
    FROM t_d_user
    ORDER BY user_name
"""

GET_USER_BY_ID = """
    SELECT
        user_id,
        user_name,
        user_email
    FROM t_d_user
    WHERE user_id = $1
"""

# Period queries
GET_PERIODS_BY_DATE_RANGE = """
    SELECT
        period_id,
        period_dt,
        period_ru_name
    FROM t_d_period
    WHERE period_dt >= $1 AND period_dt <= $2
    ORDER BY period_dt
"""

GET_ALL_PERIODS = """
    SELECT
        period_id,
        period_dt,
        period_ru_name
    FROM t_d_period
    ORDER BY period_dt
"""

GET_PERIOD_BY_ID = """
    SELECT
        period_id,
        period_dt,
        period_ru_name
    FROM t_d_period
    WHERE period_id = $1
"""

# Financial center queries
GET_ALL_FINANCIAL_CENTERS = """
    SELECT
        financial_center_id,
        financial_center_name
    FROM t_d_financial_center
    ORDER BY financial_center_name
"""

GET_FINANCIAL_CENTER_BY_ID = """
    SELECT
        financial_center_id,
        financial_center_name
    FROM t_d_financial_center
    WHERE financial_center_id = $1
"""

# Cost center queries
GET_ALL_COST_CENTERS = """
    SELECT
        cost_center_id,
        cost_center_name
    FROM t_d_cost_center
    ORDER BY cost_center_name
"""

GET_COST_CENTER_BY_ID = """
    SELECT
        cost_center_id,
        cost_center_name
    FROM t_d_cost_center
    WHERE cost_center_id = $1
"""

# Nomenclature queries
GET_ACTIVE_NOMENCLATURES = """
    SELECT
        nomenclature_id,
        nomenclature_name,
        account_name,
        bill_name,
        operation_name,
        is_budget,
        is_fact
    FROM t_d_nomenclature
    WHERE is_budget = true OR is_fact = true
    ORDER BY operation_name, nomenclature_name
"""

GET_NOMENCLATURE_BY_ID = """
    SELECT
        nomenclature_id,
        nomenclature_name,
        account_name,
        bill_name,
        operation_name,
        is_budget,
        is_fact
    FROM t_d_nomenclature
    WHERE nomenclature_id = $1
"""

# Row type queries
GET_ALL_ROW_TYPES = """
    SELECT
        row_type_id,
        row_type_name
    FROM t_d_row_type
    ORDER BY row_type_name
"""

GET_ROW_TYPE_BY_ID = """
    SELECT
        row_type_id,
        row_type_name
    FROM t_d_row_type
    WHERE row_type_id = $1
"""

# Registry queries
INSERT_REGISTRY = """
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
"""

GET_LAST_REGISTRY_ROWS = """
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
    WHERE t0.row_type_id = $1
    ORDER BY t0.registry_id DESC
    LIMIT $2
"""

# Report queries
GET_REPORT_BY_TYPE_NOMENCLATURE = """
    SELECT
        t4.row_type_name as "Тип",
        t3.nomenclature_name as "Номенклатура",
        sum(cost_sum) as "Сумма"
    FROM t_f_registry t0
    JOIN t_d_financial_center t2 USING(financial_center_id)
    JOIN t_d_nomenclature t3 USING(nomenclature_id)
    JOIN t_d_row_type t4 USING(row_type_id)
    WHERE t0.financial_center_id = $1
        AND t0.period_id = $2
        AND ($3::bigint IS NULL OR t0.nomenclature_id = $3)
    GROUP BY t4.row_type_name, t3.nomenclature_name
    ORDER BY t4.row_type_name
"""

GET_REPORT_BY_TYPE_OPERATION = """
    SELECT
        t2.row_type_name AS "Тип",
        t1.operation_name AS "Операция",
        sum(t0.cost_sum) AS "Сумма"
    FROM t_f_registry t0
    JOIN t_d_nomenclature t1 USING(nomenclature_id)
    JOIN t_d_row_type t2 USING(row_type_id)
    WHERE t0.financial_center_id = $1
        AND t0.period_id = $2
    GROUP BY t2.row_type_name, t1.operation_name
    ORDER BY t2.row_type_name, t1.operation_name
"""

GET_REPORT_BY_TYPE_BILL = """
    SELECT
        t2.row_type_name AS "Тип",
        t1.bill_name AS "Счет",
        sum(t0.cost_sum) AS "Сумма"
    FROM t_f_registry t0
    JOIN t_d_nomenclature t1 USING(nomenclature_id)
    JOIN t_d_row_type t2 USING(row_type_id)
    WHERE t0.financial_center_id = $1
        AND t0.period_id = $2
    GROUP BY t2.row_type_name, t1.bill_name
    ORDER BY t2.row_type_name, t1.bill_name
"""

GET_REPORT_BY_TYPE_ACCOUNT = """
    SELECT
        t2.row_type_name AS "Тип",
        t1.account_name AS "Статья",
        sum(t0.cost_sum) AS "Сумма"
    FROM t_f_registry t0
    JOIN t_d_nomenclature t1 USING(nomenclature_id)
    JOIN t_d_row_type t2 USING(row_type_id)
    WHERE t0.financial_center_id = $1
        AND t0.period_id = $2
    GROUP BY t2.row_type_name, t1.account_name
    ORDER BY t2.row_type_name, t1.account_name
"""

GET_BUDGET_TOTAL = """
    SELECT
        sum(t0.cost_sum) AS "Сумма"
    FROM t_f_registry t0
    WHERE t0.financial_center_id = $1
        AND t0.period_id = $2
        AND t0.row_type_id = 1
"""

GET_BUDGET_BY_BILL_ACCOUNT = """
    SELECT
        t1.bill_name AS "Счет",
        t1.account_name AS "Статья",
        sum(t0.cost_sum) AS "Сумма"
    FROM t_f_registry t0
    JOIN t_d_nomenclature t1 USING(nomenclature_id) 
    WHERE t0.financial_center_id = $1
        AND t0.period_id = $2
        AND t0.row_type_id = 1
    GROUP BY t1.bill_name, t1.account_name
    ORDER BY t1.bill_name, t1.account_name
"""