-- ============================================================================
-- Seed Test Data for Performance Testing
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE TEST USERS (10 users)
-- ============================================================================

INSERT INTO t_d_user (telegram_id, username, first_name, last_name, is_admin, is_current, valid_from, valid_to)
VALUES
    (111111111, 'test_user_1', 'Test', 'User 1', false, true, NOW(), '9999-12-31 23:59:59'),
    (222222222, 'test_user_2', 'Test', 'User 2', false, true, NOW(), '9999-12-31 23:59:59'),
    (333333333, 'test_user_3', 'Test', 'User 3', false, true, NOW(), '9999-12-31 23:59:59'),
    (444444444, 'test_user_4', 'Test', 'User 4', false, true, NOW(), '9999-12-31 23:59:59'),
    (555555555, 'test_user_5', 'Test', 'User 5', false, true, NOW(), '9999-12-31 23:59:59'),
    (666666666, 'test_user_6', 'Test', 'User 6', false, true, NOW(), '9999-12-31 23:59:59'),
    (777777777, 'test_user_7', 'Test', 'User 7', false, true, NOW(), '9999-12-31 23:59:59'),
    (888888888, 'test_user_8', 'Test', 'User 8', false, true, NOW(), '9999-12-31 23:59:59'),
    (999999999, 'test_user_9', 'Test', 'User 9', false, true, NOW(), '9999-12-31 23:59:59'),
    (123456789, 'test_admin', 'Test', 'Admin', true, true, NOW(), '9999-12-31 23:59:59');

-- ============================================================================
-- 2. CREATE GLOBAL ARTICLES (hierarchical structure)
-- ============================================================================

-- Root level: Income categories
INSERT INTO t_d_article (user_id, parent_id, code, name, type, is_global, is_current, valid_from, valid_to)
VALUES
    (NULL, NULL, 'INCOME_SALARY', 'Salary', 'income', true, true, NOW(), '9999-12-31 23:59:59'),
    (NULL, NULL, 'INCOME_FREELANCE', 'Freelance', 'income', true, true, NOW(), '9999-12-31 23:59:59'),
    (NULL, NULL, 'INCOME_INVESTMENT', 'Investments', 'income', true, true, NOW(), '9999-12-31 23:59:59'),
    (NULL, NULL, 'INCOME_OTHER', 'Other Income', 'income', true, true, NOW(), '9999-12-31 23:59:59');

-- Root level: Expense categories
INSERT INTO t_d_article (user_id, parent_id, code, name, type, is_global, is_current, valid_from, valid_to)
VALUES
    (NULL, NULL, 'EXPENSE_FOOD', 'Food', 'expense', true, true, NOW(), '9999-12-31 23:59:59'),
    (NULL, NULL, 'EXPENSE_TRANSPORT', 'Transportation', 'expense', true, true, NOW(), '9999-12-31 23:59:59'),
    (NULL, NULL, 'EXPENSE_HOUSING', 'Housing', 'expense', true, true, NOW(), '9999-12-31 23:59:59'),
    (NULL, NULL, 'EXPENSE_UTILITIES', 'Utilities', 'expense', true, true, NOW(), '9999-12-31 23:59:59'),
    (NULL, NULL, 'EXPENSE_HEALTH', 'Healthcare', 'expense', true, true, NOW(), '9999-12-31 23:59:59'),
    (NULL, NULL, 'EXPENSE_ENTERTAINMENT', 'Entertainment', 'expense', true, true, NOW(), '9999-12-31 23:59:59');

-- Child level: Food subcategories (parent_id will be filled dynamically)
DO $$
DECLARE
    food_id INT;
BEGIN
    SELECT id INTO food_id FROM t_d_article WHERE code = 'EXPENSE_FOOD' AND is_current = true;

    INSERT INTO t_d_article (user_id, parent_id, code, name, type, is_global, is_current, valid_from, valid_to)
    VALUES
        (NULL, food_id, 'EXPENSE_FOOD_GROCERIES', 'Groceries', 'expense', true, true, NOW(), '9999-12-31 23:59:59'),
        (NULL, food_id, 'EXPENSE_FOOD_RESTAURANT', 'Restaurants', 'expense', true, true, NOW(), '9999-12-31 23:59:59'),
        (NULL, food_id, 'EXPENSE_FOOD_DELIVERY', 'Food Delivery', 'expense', true, true, NOW(), '9999-12-31 23:59:59');
END $$;

-- Child level: Transport subcategories
DO $$
DECLARE
    transport_id INT;
BEGIN
    SELECT id INTO transport_id FROM t_d_article WHERE code = 'EXPENSE_TRANSPORT' AND is_current = true;

    INSERT INTO t_d_article (user_id, parent_id, code, name, type, is_global, is_current, valid_from, valid_to)
    VALUES
        (NULL, transport_id, 'EXPENSE_TRANSPORT_FUEL', 'Fuel', 'expense', true, true, NOW(), '9999-12-31 23:59:59'),
        (NULL, transport_id, 'EXPENSE_TRANSPORT_PUBLIC', 'Public Transport', 'expense', true, true, NOW(), '9999-12-31 23:59:59'),
        (NULL, transport_id, 'EXPENSE_TRANSPORT_TAXI', 'Taxi', 'expense', true, true, NOW(), '9999-12-31 23:59:59');
END $$;

-- ============================================================================
-- 3. CREATE USER-SPECIFIC ARTICLES (for first 3 users)
-- ============================================================================

DO $$
DECLARE
    user_id_var INT;
BEGIN
    FOR i IN 1..3 LOOP
        SELECT id INTO user_id_var FROM t_d_user WHERE telegram_id = (i * 111111111) AND is_current = true;

        INSERT INTO t_d_article (user_id, parent_id, code, name, type, is_global, is_current, valid_from, valid_to)
        VALUES
            (user_id_var, NULL, NULL, 'Personal Shopping', 'expense', false, true, NOW(), '9999-12-31 23:59:59'),
            (user_id_var, NULL, NULL, 'Hobbies', 'expense', false, true, NOW(), '9999-12-31 23:59:59'),
            (user_id_var, NULL, NULL, 'Gifts', 'expense', false, true, NOW(), '9999-12-31 23:59:59'),
            (user_id_var, NULL, NULL, 'Side Income', 'income', false, true, NOW(), '9999-12-31 23:59:59');
    END LOOP;
END $$;

-- ============================================================================
-- 4. CREATE FINANCIAL CENTERS
-- ============================================================================

-- Global financial centers
INSERT INTO t_d_financial_center (user_id, code, name, description, is_global, is_current, valid_from, valid_to)
VALUES
    (NULL, 'FC_SBER', 'Sberbank', 'Main bank account', true, true, NOW(), '9999-12-31 23:59:59'),
    (NULL, 'FC_TINKOFF', 'Tinkoff', 'Secondary bank', true, true, NOW(), '9999-12-31 23:59:59'),
    (NULL, 'FC_CASH', 'Cash', 'Physical cash', true, true, NOW(), '9999-12-31 23:59:59');

-- User-specific financial centers (for first 3 users)
DO $$
DECLARE
    user_id_var INT;
BEGIN
    FOR i IN 1..3 LOOP
        SELECT id INTO user_id_var FROM t_d_user WHERE telegram_id = (i * 111111111) AND is_current = true;

        INSERT INTO t_d_financial_center (user_id, code, name, description, is_global, is_current, valid_from, valid_to)
        VALUES
            (user_id_var, NULL, 'Personal Wallet', 'My personal wallet', false, true, NOW(), '9999-12-31 23:59:59'),
            (user_id_var, NULL, 'Savings Account', 'Savings', false, true, NOW(), '9999-12-31 23:59:59');
    END LOOP;
END $$;

-- ============================================================================
-- 5. CREATE COST CENTERS
-- ============================================================================

-- Global cost centers
INSERT INTO t_d_cost_center (user_id, code, name, description, is_global, is_current, valid_from, valid_to)
VALUES
    (NULL, 'CC_HOME', 'Home', 'Household expenses', true, true, NOW(), '9999-12-31 23:59:59'),
    (NULL, 'CC_WORK', 'Work', 'Work-related expenses', true, true, NOW(), '9999-12-31 23:59:59'),
    (NULL, 'CC_PERSONAL', 'Personal', 'Personal expenses', true, true, NOW(), '9999-12-31 23:59:59');

-- User-specific cost centers (for first 3 users)
DO $$
DECLARE
    user_id_var INT;
BEGIN
    FOR i IN 1..3 LOOP
        SELECT id INTO user_id_var FROM t_d_user WHERE telegram_id = (i * 111111111) AND is_current = true;

        INSERT INTO t_d_cost_center (user_id, code, name, description, is_global, is_current, valid_from, valid_to)
        VALUES
            (user_id_var, NULL, 'Project A', 'Personal project', false, true, NOW(), '9999-12-31 23:59:59'),
            (user_id_var, NULL, 'Vacation 2025', 'Vacation savings', false, true, NOW(), '9999-12-31 23:59:59');
    END LOOP;
END $$;

-- ============================================================================
-- 6. CREATE BUDGET FACTS (10,000 transactions across 2025)
-- ============================================================================

DO $$
DECLARE
    user_id_var INT;
    article_id_var INT;
    fc_id_var INT;
    cc_id_var INT;
    fact_date_var DATE;
    amount_var NUMERIC(15, 2);
    article_type VARCHAR(20);
BEGIN
    FOR i IN 1..10000 LOOP
        -- Random user (1-10)
        SELECT id INTO user_id_var FROM t_d_user
        WHERE is_current = true
        ORDER BY RANDOM()
        LIMIT 1;

        -- Random article (global + user-specific)
        SELECT id, type INTO article_id_var, article_type
        FROM t_d_article
        WHERE is_current = true
            AND (is_global = true OR user_id = user_id_var)
        ORDER BY RANDOM()
        LIMIT 1;

        -- Random financial center (50% chance of NULL)
        IF random() > 0.5 THEN
            SELECT id INTO fc_id_var FROM t_d_financial_center
            WHERE is_current = true
                AND (is_global = true OR user_id = user_id_var)
            ORDER BY RANDOM()
            LIMIT 1;
        ELSE
            fc_id_var := NULL;
        END IF;

        -- Random cost center (50% chance of NULL)
        IF random() > 0.5 THEN
            SELECT id INTO cc_id_var FROM t_d_cost_center
            WHERE is_current = true
                AND (is_global = true OR user_id = user_id_var)
            ORDER BY RANDOM()
            LIMIT 1;
        ELSE
            cc_id_var := NULL;
        END IF;

        -- Random date from 2025-01-01 to today (for 'fact' records, cannot be in future)
        fact_date_var := '2025-01-01'::DATE + (random() * (CURRENT_DATE - '2025-01-01'::DATE))::INT;

        -- Random amount based on article type
        IF article_type = 'income' THEN
            amount_var := 5000 + (random() * 45000)::NUMERIC(15, 2); -- Income: 5,000 - 50,000
        ELSE
            amount_var := -(50 + (random() * 4950)::NUMERIC(15, 2)); -- Expense: -50 to -5,000
        END IF;

        -- Insert fact
        INSERT INTO t_f_budget_fact (user_id, article_id, financial_center_id, cost_center_id, fact_date, amount, record_type, description)
        VALUES (
            user_id_var,
            article_id_var,
            fc_id_var,
            cc_id_var,
            fact_date_var,
            amount_var,
            'fact',
            'Test transaction ' || i
        );
    END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count records
SELECT 'Users' as table_name, COUNT(*) as count FROM t_d_user WHERE is_current = true
UNION ALL
SELECT 'Articles', COUNT(*) FROM t_d_article WHERE is_current = true
UNION ALL
SELECT 'Financial Centers', COUNT(*) FROM t_d_financial_center WHERE is_current = true
UNION ALL
SELECT 'Cost Centers', COUNT(*) FROM t_d_cost_center WHERE is_current = true
UNION ALL
SELECT 'Budget Facts', COUNT(*) FROM t_f_budget_fact;

-- Show sample data
SELECT 'Sample Fact Records:' as info;
SELECT
    f.id,
    u.username,
    a.name as article,
    a.type,
    f.fact_date,
    f.amount,
    fc.name as financial_center,
    cc.name as cost_center
FROM t_f_budget_fact f
JOIN t_d_user u ON f.user_id = u.id
JOIN t_d_article a ON f.article_id = a.id
LEFT JOIN t_d_financial_center fc ON f.financial_center_id = fc.id
LEFT JOIN t_d_cost_center cc ON f.cost_center_id = cc.id
WHERE u.is_current = true
    AND a.is_current = true
    AND (fc.is_current = true OR fc.id IS NULL)
    AND (cc.is_current = true OR cc.id IS NULL)
ORDER BY f.fact_date DESC
LIMIT 10;
