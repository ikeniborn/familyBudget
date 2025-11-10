# Manual Testing Checklist: Изменение типа категории

## Дата: 2025-11-07
## Feature: Возможность изменения типа категории (income/expense)
## Branch: feature/article-type-change

---

## Подготовка

- [ ] Backend запущен и доступен (http://localhost:8000)
- [ ] Админ панель открыта (https://budget-dev.ikeniborn.ru/admin/articles)
- [ ] Авторизован как администратор

---

---

## Тест 10: КРИТИЧНЫЙ - Обновление транзакций при изменении типа

### Подготовка:
1. [ ] Создать категорию "TestTransactions" (expense, id=X)
2. [ ] Создать 3 транзакции для этой категории:
   ```sql
   INSERT INTO t_f_budget_fact (user_id, article_id, fact_date, amount, description)
   VALUES
     (1, X, '2025-10-01', 100.00, 'Transaction 1'),
     (1, X, '2025-10-02', 200.00, 'Transaction 2'),
     (1, X, '2025-10-03', 300.00, 'Transaction 3');
   ```
3. [ ] Запомнить старый article_id (X)

### Шаги:
1. [ ] Изменить тип "TestTransactions" с "expense" на "income"
2. [ ] Получить новый article_id (Y) из ответа API

### Проверка БД:
```sql
-- Проверить что ВСЕ транзакции перенаправлены на новый article_id
SELECT article_id, COUNT(*) as count
FROM t_f_budget_fact
WHERE article_id IN (X, Y)
GROUP BY article_id;

-- Должно быть:
-- article_id = Y, count = 3  (все транзакции перенаправлены)
-- article_id = X, count = 0  (старых транзакций нет)
```

### Проверка аналитики:
```sql
-- Проверить что транзакции доступны в аналитике по новому типу
SELECT f.id, f.amount, a.name, a.type
FROM t_f_budget_fact f
JOIN t_d_article a ON f.article_id = a.id
WHERE a.name = 'TestTransactions' AND a.is_current = true;

-- Должно вернуть все 3 транзакции с type='income'
```

### Ожидаемый результат:
- ✅ Все 3 транзакции имеют `article_id = Y` (новая версия)
- ✅ НЕТ транзакций с `article_id = X` (старая версия)
- ✅ Аналитика по типу "income" включает все 3 транзакции
- ✅ Backend логи содержат: "Updated transactions: article_id X → Y"

### CRITICAL: Без этого теста аналитика будет некорректной!

---

## Баги и проблемы

### Найденные баги:
| № | Описание | Серьезность | Статус |
|---|----------|-------------|--------|
| 1 |  |  |  |
| 2 |  |  |  |

### Примечания:
-
-

---

## Итоговый статус

- [ ] Все тесты пройдены
- [ ] Критические баги отсутствуют
- [ ] Feature готова к merge

**Тестировщик:** _________________
**Дата:** ___________
