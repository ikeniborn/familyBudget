-- Инициализация базовых данных для t_d_row_type
-- Добавляет типы строк: 1=Plan (План), 2=Fact (Факт)

INSERT INTO t_d_row_type (row_type_id, row_type_name) 
VALUES 
    (1, 'Plan'), 
    (2, 'Fact')
ON CONFLICT (row_type_id) DO NOTHING;

-- Убеждаемся что sequence учитывает вставленные значения
SELECT setval('t_d_row_type_row_type_id_seq', 
    (SELECT GREATEST(2, MAX(row_type_id)) FROM t_d_row_type), 
    true);