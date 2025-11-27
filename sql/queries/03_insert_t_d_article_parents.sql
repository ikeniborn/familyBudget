-- ============================================================================
-- INSERT: t_d_article (Parent articles)
-- Description: Parent category articles from account_name
-- Generated: 2025-11-26 20:11:26
-- ============================================================================

-- Insert parent articles (root level categories)
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-1', 'Аренда', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-2', 'Биржа', 'income', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-3', 'Бытовая техника, электроника', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-4', 'Вещи', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-5', 'Возврат', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-6', 'Гипермаркет', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-7', 'Депозит', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-8', 'Долги', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-9', 'Доходы', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-10', 'Займы', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-11', 'Зарплата', 'income', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-12', 'Кафе и рестораны', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-13', 'Коммунальные платежи', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-14', 'Красота и здоровье', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-15', 'Медицина, аптека', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-16', 'Мобильная связь, интернет, ТВ', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-17', 'Накопления', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-18', 'Общественный транспорт', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-19', 'Одежда и обувь', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-20', 'Остатки', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-21', 'ПО, книги и журналы, игры, музыка, фильмы', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-22', 'Перевод на счет Семья', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-23', 'Подарки', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-24', 'Продажа', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-25', 'Прочее', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-26', 'Развлечения и праздники', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-27', 'Ремонт и обсуживание', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-28', 'Сигареты и табак', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-29', 'Топливо', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-30', 'Услуги', 'expense', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-31', 'Цели', 'income', NULL, true);
INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_active) VALUES (1, 'ART-32', 'Штрафы, налоги, комиссии', 'expense', NULL, true);

-- Total: 32 parent articles