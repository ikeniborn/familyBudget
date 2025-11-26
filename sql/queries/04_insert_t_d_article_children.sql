-- ============================================================================
-- INSERT: t_d_article (Child articles)
-- Description: Child category articles from nomenclature_name
-- Generated: 2025-11-26 20:11:26
-- ============================================================================

-- Insert child articles (referencing parent via parent_id)
-- NOTE: parent_id references are resolved via code lookup
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-33', 'Аванс', 'income', (SELECT id FROM t_d_article WHERE code = 'ART-11' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-34', 'Аптека', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-15' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-35', 'Бензин', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-29' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-36', 'Вещи', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-4' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-37', 'Возврат', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-5' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-38', 'Детские товары', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-6' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-39', 'Дизель', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-29' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-40', 'ЖКХ', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-13' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-41', 'Запчасти', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-27' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-42', 'Зарплата', 'income', (SELECT id FROM t_d_article WHERE code = 'ART-11' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-43', 'Капремонт', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-13' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-44', 'Кафе', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-12' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-45', 'Квартира', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-1' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-46', 'Корм для животных', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-6' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-47', 'Косметика', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-14' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-48', 'Красота', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-14' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-49', 'Мебель', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-27' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-50', 'Медицина', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-15' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-51', 'Мобильная связь', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-16' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-52', 'Налоги', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-32' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-53', 'Обувь', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-19' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-54', 'Обучение', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-21' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-55', 'Одежда', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-19' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-56', 'Одежда и обувь', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-4' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-57', 'Отпускные', 'income', (SELECT id FROM t_d_article WHERE code = 'ART-11' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-58', 'Перевод на счет Семья', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-22' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-59', 'Платные подписки', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-21' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-60', 'Подарки', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-23' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-61', 'Пополнение', 'income', (SELECT id FROM t_d_article WHERE code = 'ART-5' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-62', 'Пополнение биржи', 'income', (SELECT id FROM t_d_article WHERE code = 'ART-2' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-63', 'Пополнение целей', 'income', (SELECT id FROM t_d_article WHERE code = 'ART-31' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-64', 'Праздники', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-26' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-65', 'Премия', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-11' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-66', 'Приход со счета Илья', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-9' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-67', 'Приход со счета Оксана', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-9' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-68', 'Программы', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-21' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-69', 'Продажа', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-24' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-70', 'Продукты', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-6' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-71', 'Проценты', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-7' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-72', 'Прочее', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-25' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-73', 'Развлечения', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-26' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-74', 'Ресторан', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-12' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-75', 'Сигареты', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-28' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-76', 'Столовая', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-6' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-77', 'Строительные материалы', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-27' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-78', 'Табак', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-28' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-79', 'Такси', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-18' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-80', 'Текущие остатки', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-20' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-81', 'Техника и электроника', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-3' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-82', 'Товары', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-6' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-83', 'Трамвай', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-18' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-84', 'Увеличение долга', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-8' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-85', 'Увеличение займа', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-10' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-86', 'Увеличение накоплений', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-17' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-87', 'Уменьшение долга', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-8' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-88', 'Уменьшение займа', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-10' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-89', 'Уменьшение накоплений', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-17' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-90', 'Услуги по обсуживанию', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-30' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-91', 'Услуги по ремонту', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-30' LIMIT 1), true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-92', 'Штрафы', 'expense', (SELECT id FROM t_d_article WHERE code = 'ART-32' LIMIT 1), true);

-- Total: 60 child articles