# Оптимизированный Workflow для Family Budget

<context>
Система: Family Budget - веб-приложение управления бюджетом
Stack: SvelteKit 2, FastAPI, PostgreSQL, Docker
Контейнеры: budget-frontend (5173), budget-backend (4000), budget-postgres, budget-redis
</context>

<workflow>
## 🎯 ФАЗА 1: АНАЛИЗ (5-10 мин)
<actions>
- Grep: поиск связанных компонентов
- Read: понимание текущей реализации  
- Glob: поиск существующих тестов (*test*.py, *.test.ts)
- TodoWrite: декомпозиция задачи
</actions>

<checkpoint>✓ Список затронутых файлов и план действий</checkpoint>

## 🚀 ФАЗА 2: ПАРАЛЛЕЛЬНОЕ ВЫПОЛНЕНИЕ
<agent-matrix>
API → api-developer
UI → frontend-developer  
DB → database-designer
Types → typescript-developer
Logic → backend-developer
Tests → test-engineer
Security → code-security-auditor
</agent-matrix>

<parallel-execution>
Запускать независимые задачи одновременно через Task tool
</parallel-execution>

<checkpoint>✓ Все агенты завершили задачи</checkpoint>

## 🔧 ФАЗА 3: ИНТЕГРАЦИЯ
<container-management>
# Проверка перед запуском
docker ps | grep budget-

# Убить дубликаты если есть
docker exec budget-frontend pkill -f "npm run dev" || true
docker exec budget-backend pkill -f uvicorn || true

# Перезапуск (НЕ новые процессы!)
docker restart budget-frontend budget-backend
# ИЛИ
docker-compose restart
</container-management>

<code-application>
- MultiEdit для batch изменений
- Проверка типов: npm run check  
- Тесты: pytest, npm run test
</code-application>

<checkpoint>✓ Код компилируется, линтинг пройден</checkpoint>

## ✅ ФАЗА 4: ВАЛИДАЦИЯ
<parallel-validation>
1. Unit тесты (coverage ≥ 80%)
2. Type checking  
3. Security audit (user_id изоляция)
4. Performance check
</parallel-validation>

<final-checklist>
□ Все todo completed
□ Тесты зеленые
□ Нет дублирующих процессов
□ Контейнеры работают корректно
</final-checklist>
</workflow>

<critical-rules>
❌ НИКОГДА не запускать npm/pip на хосте
❌ НИКОГДА не создавать дубликаты процессов в контейнерах
✅ ВСЕГДА проверять docker ps перед операциями
✅ ВСЕГДА использовать docker restart вместо нового exec
✅ ВСЕГДА фильтровать по user_id в запросах
✅ ВСЕГДА использовать MultiEdit для множественных правок
</critical-rules>

<efficiency-patterns>
# Вместо последовательного чтения
Read file1 → Read file2 → Read file3

# Используй параллельное
[Read file1, Read file2, Read file3] - одним вызовом

# Вместо отдельных Edit
Edit file1 → Edit file2 → Edit file3  

# Используй MultiEdit
MultiEdit file1 [edit1, edit2, edit3]
</efficiency-patterns>

<quick-commands>
# Статус системы
docker ps | grep budget-

# Логи для отладки  
docker logs budget-backend --tail=50
docker logs budget-frontend --tail=50

# Быстрый рестарт
docker-compose restart

# Проверка качества
docker exec budget-backend python -m pytest --tb=short
docker exec budget-frontend npm run check
</quick-commands>