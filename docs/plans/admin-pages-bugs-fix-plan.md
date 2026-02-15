# План исправления проблем на админских страницах

## Контекст

На основе исследования `docs/explore/admin-pages-investigation.md` обнаружено **6 критических проблем** на админских страницах, блокирующих функциональность и ухудшающих UX:

### Обнаруженные проблемы

1. **Backend ошибка** (🔴 Критическая): `PUT /api/v1/articles/16` → 400 Bad Request - `"Article" object has no field "financial_center_ids"`
2. **UI проблема** (🟢 Средняя): Кнопка удаления смещена вправо в модальных окнах
3. **UX проблема** (🟡 Высокая): Модальное окно закрывается ДО завершения операции удаления
4. **JS ошибка** (🔴 Критическая): `TypeError: Cannot read properties of undefined (reading 'name')` при удалении магазина
5. **JS ошибка** (🔴 Критическая): `TypeError: Cannot read properties of undefined (reading 'name')` при удалении товарной группы
6. **UI проблема** (🟢 Средняя): Иконка корзины не отцентрирована в кнопке удаления

**Цель:** Исправить все 6 проблем через 3 фазы с независимым rollback для каждой.

**Стратегия:** Фазированный подход - сначала критические баги (блокируют функциональность), затем UX (плохой пользовательский опыт), затем UI polish (визуальные дефекты).

---

## Фаза 1: Критические Backend + Frontend баги

### Проблемы

- **#1**: Backend ошибка - `financial_center_ids` не обрабатывается в endpoint
- **#4**: JS undefined при удалении магазина (type mismatch + нет проверки)
- **#5**: JS undefined при удалении товарной группы (type mismatch + нет проверки)

### Решения

#### Задача 1.1: Backend - Обработка `financial_center_ids` в Article Update

**Файл:** `backend/app/api/v1/endpoints/articles.py`

**Root Cause:**
- Endpoint НЕ извлекает `financial_center_ids` из `update_data` перед вызовом `has_changes()`
- Функция `update_article_profile()` пытается установить через `setattr()` несуществующий атрибут на модели Article
- Модель Article использует Many-to-Many связь через таблицу `t_article_financial_center`

**Изменения:**

**1. После строки ~432** (после `update_data = article_data.model_dump(exclude_unset=True)`):
```python
# Извлечь financial_center_ids ДО проверки изменений
financial_center_ids = update_data.pop('financial_center_ids', None)
logger.info(f"[UPDATE_ARTICLE] Extracted financial_center_ids: {financial_center_ids}")
```

**2. Перед строкой ~537** (перед `return updated_article`):
```python
# Обработка financial_center_ids (Many-to-Many связь)
if financial_center_ids is not None:
    from sqlalchemy import delete
    from backend.app.models.article_financial_center import ArticleFinancialCenter

    logger.info(f"[UPDATE_ARTICLE] Updating financial center links for article_id={article_id}")

    # Удалить существующие связи
    delete_stmt = delete(ArticleFinancialCenter).where(
        ArticleFinancialCenter.article_id == article_id
    )
    await session.execute(delete_stmt)
    logger.info(f"[UPDATE_ARTICLE] Deleted existing FC links")

    # Вставить новые связи (если список не пустой)
    if financial_center_ids:
        for fc_id in financial_center_ids:
            link = ArticleFinancialCenter(
                article_id=article_id,
                financial_center_id=fc_id
            )
            session.add(link)
        logger.info(f"[UPDATE_ARTICLE] Created {len(financial_center_ids)} new FC links")
    else:
        logger.info("[UPDATE_ARTICLE] Cleared all FC links (available for all FCs)")

    await session.commit()
    await session.refresh(updated_article)

# Invalidate cache ПОСЛЕ обновления M2M связей
await cache_service.invalidate_articles()
```

**Критерии успеха:**
- ✅ `PUT /api/v1/articles/{id}` возвращает 200 OK без AttributeError
- ✅ `financial_center_ids` корректно обновляются в БД
- ✅ Пустой список `[]` очищает все связи (доступно для всех ФЦ)

---

#### Задача 1.2: Frontend - ID нормализация + проверка undefined

**Файлы (5 изменений):**
1. `frontend/web/templates/admin_stores.html` - функция `deleteStore()` (~строка 433-460)
2. `frontend/web/templates/admin_product_groups.html` - функция `deleteProductGroup()` (~строка 536-563)
3. `frontend/web/templates/admin_cost_centers.html` - функция `deleteCenter()`
4. `frontend/web/templates/admin_financial_centers.html` - функция `deleteCenter()`
5. `frontend/web/templates/admin_articles.html` - функция `deactivateArticle()` (~строка 841-911)

**Root Cause:**
- **Type mismatch**: `storeId` из HTML input - string, `s.id` из API - number → `'123' === 123` → false
- **Нет проверки**: `storesData.find()` может вернуть `undefined`, попытка доступа к `.name` → TypeError

**Паттерн для всех 5 функций:**

```javascript
async function deleteStore(storeId) {
    // ✅ Нормализуем ID к integer для корректного сравнения
    const storeIdInt = typeof storeId === 'string' ? parseInt(storeId, 10) : storeId;

    // ✅ Поиск с нормализованным ID
    const store = storesData.find(s => s.id === storeIdInt);

    // ✅ Проверка на undefined ПЕРЕД использованием
    if (!store) {
        console.error(`Store with ID ${storeId} not found in storesData`);
        showToast('❌ Магазин не найден', 'error');
        return;
    }

    const confirmed = await showConfirmDialog(
        'Удалить магазин?',
        `⚠️ ВНИМАНИЕ: Вы уверены, что хотите УДАЛИТЬ "${store.name}"?\n\n` +
        `Это действие НЕОБРАТИМО и удалит все связанные данные:\n` +
        `• Все товары в списках покупок для этого магазина\n\n` +
        `Рекомендуется использовать архивирование вместо удаления.`
    );

    if (!confirmed) return;

    try {
        const response = await fetch(`/api/v1/stores/${storeIdInt}`, {
            method: 'DELETE',
            credentials: 'include',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete store');
        }

        await loadStores();
        showToast('✅ Магазин удален', 'success');
    } catch (error) {
        console.error('Failed to delete store:', error);
        showToast(`❌ Ошибка: ${error.message}`, 'error');
    }
}
```

**Повторить аналогичный паттерн для:**

**deleteProductGroup():**
```javascript
const groupIdInt = typeof groupId === 'string' ? parseInt(groupId, 10) : groupId;
const group = productGroupsData.find(g => g.id === groupIdInt);
if (!group) {
    console.error(`Product group with ID ${groupId} not found in productGroupsData`);
    showToast('❌ Группа товаров не найдена', 'error');
    return;
}

const confirmed = await showConfirmDialog(
    'Удалить группу товаров?',
    `⚠️ ВНИМАНИЕ: Вы уверены, что хотите УДАЛИТЬ "${group.name}"?\n\n` +
    `Это действие НЕОБРАТИМО и удалит все связанные данные:\n` +
    `• Все дочерние группы\n` +
    `• Все товары в списках покупок для этой группы\n\n` +
    `Рекомендуется использовать архивирование вместо удаления.`
);
```

**deleteCenter() для cost centers и financial centers:**
- Аналогично, но с соответствующими именами переменных (`costCentersData`, `financialCentersData`)
- Текст confirmDialog адаптировать под тип сущности

**deactivateArticle():**
- Аналогично, но работает с `articlesData` и использует деактивацию вместо удаления

**Критерии успеха:**
- ✅ Нет консольных ошибок "Cannot read properties of undefined"
- ✅ String ID из HTML корректно сравнивается с number ID из API
- ✅ Toast показывает "Entity not found" для невалидных ID

---

## Фаза 2: UX - Async Modal Close

### Проблема

**#3**: Модальное окно закрывается ДО завершения операции удаления

**Root Cause:**
- `closeEditModal()` вызывается **синхронно**
- `deleteEntity()` **async**, но не ожидается через `await`
- Пользователь не видит loading indicator во время операции

### Решение

#### Задача 2.1: Добавить async/await + overlay loader

**Файлы (5 изменений):**
1. `frontend/web/templates/admin_stores.html` - `deleteStoreFromEditModal()` (~строка 334-339)
2. `frontend/web/templates/admin_product_groups.html` - `deleteProductGroupFromEditModal()` (~строка 437-442)
3. `frontend/web/templates/admin_cost_centers.html` - `deleteCenterFromEditModal()`
4. `frontend/web/templates/admin_financial_centers.html` - `deleteCenterFromEditModal()`
5. `frontend/web/templates/admin_articles.html` - `deleteArticleFromEditModal()` (~строка 756-760)

**Паттерн для всех 5 функций:**

```javascript
async function deleteStoreFromEditModal() {
    const storeId = document.getElementById('edit-id').value;
    const modal = document.getElementById('edit-modal');

    // ✅ Создать overlay loader
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-base-300/80 flex items-center justify-center z-50 rounded-lg';
    overlay.innerHTML = `
        <div class="flex flex-col items-center gap-4">
            <span class="loading loading-spinner loading-lg text-primary"></span>
            <p class="text-lg font-semibold">Удаление магазина...</p>
        </div>
    `;

    // Добавить overlay к модальному окну
    const modalBox = modal.querySelector('.modal-box');
    modalBox.style.position = 'relative';
    modalBox.appendChild(overlay);

    try {
        // ✅ Ждем завершения удаления
        await deleteStore(storeId);

        // ✅ Закрываем модальное окно ПОСЛЕ успешного удаления
        closeEditModal();
    } catch (error) {
        // Ошибка уже обработана в deleteStore()
        // Убрать overlay
        overlay.remove();
    }
}
```

**Изменения:**
1. Сделать функцию `async`
2. Создать overlay элемент с loading spinner
3. Добавить overlay в `.modal-box`
4. Обернуть в `try/catch` для обработки ошибок
5. Использовать `await deleteStore()` вместо просто `deleteStore()`
6. Вызвать `closeEditModal()` ПОСЛЕ успешного удаления
7. При ошибке - убрать overlay (модальное окно остается открытым)

**Критерии успеха:**
- ✅ Модальное окно показывает loading spinner во время операции
- ✅ Модальное окно закрывается ТОЛЬКО после получения ответа от сервера
- ✅ При ошибке модальное окно остается открытым (overlay удаляется)
- ✅ Пользователь не может взаимодействовать с формой во время удаления (overlay блокирует)

---

## Фаза 3: UI Polish

### Проблемы

- **#2**: Кнопка удаления смещена вправо (должна быть слева)
- **#6**: Иконка корзины не отцентрирована в кнопке

### Решения

#### Задача 3.1: Исправить позицию кнопки удаления

**Файлы (5 изменений):**
1. `frontend/web/templates/admin_articles.html` (~строка 174)
2. `frontend/web/templates/admin_stores.html` (~строка 102)
3. `frontend/web/templates/admin_product_groups.html` (~строка 118)
4. `frontend/web/templates/admin_cost_centers.html` (~строка 118)
5. `frontend/web/templates/admin_financial_centers.html` (~строка 96)

**Root Cause:**
- Разделитель `<div class="flex-1 md:hidden"></div>` идет ПОСЛЕ кнопки удаления
- На desktop разделитель скрывается через `md:hidden`, но визуально кнопка выглядит смещенной

**Изменение:**

**Было:**
```html
<div class="modal-action mt-3 flex flex-row gap-2">
    {{ delete_button_mobile('deleteStoreFromEditModal()') }}
    <div class="flex-1 md:hidden"></div>  <!-- ❌ -->
    <button type="button" class="btn btn-sm sm:btn-md flex-1 sm:flex-initial" onclick="closeEditModal()">❌ Отмена</button>
    <button type="submit" class="btn btn-sm sm:btn-md btn-primary flex-1 sm:flex-initial">💾 Сохранить</button>
</div>
```

**Стало:**
```html
<div class="modal-action mt-3 flex flex-row gap-2">
    {{ delete_button_mobile('deleteStoreFromEditModal()') }}
    <div class="flex-1"></div>  <!-- ✅ Убрали md:hidden -->
    <button type="button" class="btn btn-sm sm:btn-md flex-1 sm:flex-initial" onclick="closeEditModal()">❌ Отмена</button>
    <button type="submit" class="btn btn-sm sm:btn-md btn-primary flex-1 sm:flex-initial">💾 Сохранить</button>
</div>
```

**Критерии успеха:**
- ✅ Кнопка удаления выровнена слева на всех размерах экрана
- ✅ Нет layout shift между responsive breakpoints

---

#### Задача 3.2: Исправить центрирование иконки корзины

**Файл:** `frontend/web/templates/components/macros/delete_buttons.html` (~строка 107-116)

**Root Cause:**
- `style="display: block !important;"` переопределяет DaisyUI flexbox (`display: inline-flex`)
- Flexbox центрирование (`align-items: center`, `justify-content: center`) перестает работать
- Дублирующий класс `block` добавляет путаницу

**Изменение:**

**Было:**
```html
{% macro delete_button_mobile(onclick_handler, title='Удалить', extra_classes='') %}
<button type="button"
        class="btn btn-sm sm:btn-md btn-error btn-square md:hidden block {{ extra_classes }}"
        onclick="{{ onclick_handler }}"
        title="{{ title }}"
        aria-label="{{ title }}"
        style="display: block !important;">  <!-- ❌ -->
    {{ delete_icon_svg('h-5 w-5') }}
</button>
{% endmacro %}
```

**Стало:**
```html
{% macro delete_button_mobile(onclick_handler, title='Удалить', extra_classes='') %}
<button type="button"
        class="btn btn-sm sm:btn-md btn-error btn-square md:hidden {{ extra_classes }}"
        onclick="{{ onclick_handler }}"
        title="{{ title }}"
        aria-label="{{ title }}">
    {{ delete_icon_svg('h-5 w-5') }}
</button>
{% endmacro %}
```

**Изменения:**
1. ✅ Убрали `style="display: block !important;"`
2. ✅ Убрали класс `block` из class attribute
3. ✅ DaisyUI `btn` класс теперь использует `display: inline-flex` с центрированием

**Критерии успеха:**
- ✅ Иконка корзины отцентрирована вертикально в кнопке
- ✅ Нет визуальной регрессии в других кнопках, использующих макрос

---

## Git Workflow

### Branch Strategy
```bash
git checkout explore
git pull origin explore
git checkout -b fix/admin-pages-issues
```

### Commit Strategy

**4 атомарных коммита (по одному на каждую задачу):**

```bash
# Commit 1: Backend fix
git add backend/app/api/v1/endpoints/articles.py
git commit -m "fix(backend): extract financial_center_ids before has_changes

- Extract M2M field from update_data after model_dump()
- Handle Many-to-Many links after profile update
- Clear existing links, insert new links if provided
- Add logging for FC operations

Fixes: Bug #1 (AttributeError: Article has no field financial_center_ids)"

# Commit 2: Frontend JS critical fixes
git add frontend/web/templates/admin_*.html
git commit -m "fix(frontend): normalize IDs and add null checks in delete functions

- Add parseInt() to normalize string/number IDs
- Add null check after .find() to prevent undefined errors
- Apply pattern to all 5 admin delete functions

Fixes: Bug #4 (deleteStore undefined), Bug #5 (deleteProductGroup undefined)"

# Commit 3: Frontend UX fix
git add frontend/web/templates/admin_*.html
git commit -m "fix(frontend): async modal close with overlay loader

- Convert deleteXXXFromEditModal to async functions
- Add loading overlay during delete operation
- Await deleteEntity before closing modal
- Add error handling to remove overlay on failure

Fixes: Bug #3 (Modal closes before delete completes)"

# Commit 4: Frontend UI polish
git add frontend/web/templates/admin_*.html frontend/web/templates/components/macros/delete_buttons.html
git commit -m "fix(ui): align delete button and center trash icon

- Remove md:hidden from flex spacer (button stays left-aligned)
- Remove display:block style from icon SVG (restore flex centering)

Fixes: Bug #2 (Delete button misaligned), Bug #6 (Icon not centered)"
```

### PR Strategy
```bash
git push origin fix/admin-pages-issues
gh pr create --base explore --title "Fix admin pages bugs (6 issues)" --body "
Fixes 6 bugs on admin pages based on investigation in docs/explore/admin-pages-investigation.md

**Critical bugs:**
- Backend: financial_center_ids AttributeError
- Frontend: deleteStore/deleteProductGroup undefined errors

**UX improvements:**
- Modal closes after delete completes (with loading indicator)

**UI polish:**
- Delete button alignment
- Trash icon centering

**Testing:**
- Backend: pytest tests/api/test_articles.py
- Frontend: Manual testing + E2E via @skill:test-code
"
```

---

## Verification & Testing

### Backend Tests

```bash
# Unit tests для Article update endpoint
cd backend
.venv/bin/pytest tests/api/test_articles.py::test_update_article_financial_centers -v

# Проверка 304 Not Modified для unchanged M2M
.venv/bin/pytest tests/api/test_articles.py::test_update_article_no_changes -v
```

### Frontend Tests (Manual)

**Фаза 1 - Критические баги:**
1. Открыть https://fbd.ikeniborn.ru/admin/articles
2. Редактировать любую категорию, изменить financial centers
3. Сохранить → Проверить: нет 400 Bad Request ✅
4. Открыть https://fbd.ikeniborn.ru/admin/stores
5. Удалить любой магазин → Проверить: нет консольной ошибки "undefined" ✅
6. Повторить для product groups, cost centers, financial centers ✅

**Фаза 2 - UX:**
1. Открыть модальное окно редактирования любой сущности
2. Нажать кнопку удаления в модальном окне
3. Проверить: появляется loading spinner ✅
4. Проверить: модальное окно закрывается ПОСЛЕ toast уведомления ✅
5. Проверить: нельзя кликнуть на элементы формы во время удаления ✅

**Фаза 3 - UI:**
1. Открыть модальное окно редактирования на mobile (375px)
2. Проверить: кнопка удаления слева, пространство в центре, Cancel/Save справа ✅
3. Повторить на tablet (768px) и desktop (1920px) ✅
4. Проверить: иконка корзины отцентрирована вертикально в кнопке ✅

### Automated Testing

**После коммита использовать @skill:test-code для автоматического выбора тестов:**
```bash
# @skill:test-code автоматически запустит:
# - pytest (backend/tests/api/test_articles.py)
# - TypeScript type checking (frontend)
# - Playwright E2E (если затронуты admin страницы)
```

---

## Критические файлы для изменения

### Backend (1 файл)
- `backend/app/api/v1/endpoints/articles.py` (строки ~432, ~537)

### Frontend Templates (7 файлов)
- `frontend/web/templates/admin_articles.html` (строки 174, 756-760, 776-782, 841-911)
- `frontend/web/templates/admin_stores.html` (строки 102, 334-339, 433-460)
- `frontend/web/templates/admin_product_groups.html` (строки 118, 437-442, 536-563)
- `frontend/web/templates/admin_cost_centers.html` (аналогичные локации)
- `frontend/web/templates/admin_financial_centers.html` (аналогичные локации)

### Component Macros (1 файл)
- `frontend/web/templates/components/macros/delete_buttons.html` (строка 107-116)

---

## Риски и Mitigation

### Риск 1: M2M обновление ломает другие endpoints
**Вероятность:** Низкая (изменения изолированы в Articles endpoint)
**Impact:** Высокий (все обновления статей перестанут работать)

**Mitigation:**
- Добавить pytest тесты для M2M update сценариев
- Тестировать unchanged M2M (должен вернуть 304)
- Мониторить Sentry на AttributeError после деплоя

**Rollback:**
```bash
git revert <commit-hash>
git push origin fix/admin-pages-issues --force
# Redeploy через CI/CD (~2 min downtime)
```

### Риск 2: Overlay блокирует модальное окно навсегда
**Вероятность:** Средняя (error handling может пропустить edge cases)
**Impact:** Средний (пользователь должен refresh страницу)

**Mitigation:**
- Добавить try/catch вокруг deleteEntity
- Тестировать network failure в DevTools
- Добавить timeout для overlay (fallback cleanup через 30s)

**Rollback:**
```bash
git revert <commit-hash>
git push origin fix/admin-pages-issues --force
# Nginx container redeploy (~30s)
```

### Риск 3: CSS specificity конфликты после удаления `block`
**Вероятность:** Низкая (DaisyUI использует low-specificity utility классы)
**Impact:** Низкий (только визуальная проблема)

**Mitigation:**
- Проверить computed styles в DevTools до/после
- Тестировать на Safari (WebKit имеет другое flexbox поведение)
- Проверить использование макроса `delete_buttons.html` в других файлах

**Rollback:**
```bash
git revert <commit-hash>
git push origin fix/admin-pages-issues --force
# Nginx redeploy (~30s)
```

---

## Успешные критерии

### Функциональные метрики
- ✅ Ноль AttributeError логов в Sentry (Bug #1)
- ✅ Ноль "undefined entity" консольных ошибок (Bug #4, #5)
- ✅ 100% модальных окон закрываются после завершения удаления (Bug #3)

### Performance метрики
- ✅ Modal delete operation <500ms (P95)
- ✅ Нет layout shift (CLS score) после Фазы 3

### UX метрики
- ✅ Ноль bug reports от админ пользователей в течение 7 дней после деплоя
- ✅ Delete success rate 100% (нет retry попыток)

---

## Оценка времени

| Фаза | Разработка | Тестирование | Review | Deploy | Итого |
|------|-----------|-------------|--------|--------|-------|
| Фаза 1 | 1h | 30min | 30min | 15min | 2h 15min |
| Фаза 2 | 1h | 30min | 20min | 10min | 2h |
| Фаза 3 | 30min | 20min | 15min | 10min | 1h 15min |
| **ВСЕГО** | **2.5h** | **1h 20min** | **1h 5min** | **35min** | **5h 30min** |

---

## Deployment Strategy

### Подход: Single PR с 4 атомарными коммитами

**Преимущества:**
- ✅ Легче code review (видно полный контекст)
- ✅ Деплоим все исправления вместе
- ✅ Rollback целого PR если любая фаза фейлится
- ✅ Меньше overhead на review (1 PR вместо 3)

**Deployment шаги:**
1. Merge PR в `explore` branch
2. CI/CD собирает Docker images (backend, nginx)
3. Deploy на dev environment (https://fbd.ikeniborn.ru)
4. Smoke testing всех 5 админских страниц
5. Deploy на production (https://fb.ikeniborn.ru)

**Smoke Test Checklist:**
- [ ] Articles update работает без AttributeError
- [ ] Все 5 delete buttons работают без консольных ошибок
- [ ] Entity names корректно отображаются в confirmations
- [ ] Modal delete показывает loading spinner
- [ ] Modal закрывается только после завершения операции
- [ ] Delete button выровнена слева на mobile/desktop
- [ ] Trash icon отцентрирована в кнопке

---

## Next Steps After Plan Approval

1. ✅ Создать branch `fix/admin-pages-issues` от `explore`
2. ✅ Реализовать Фазу 1 (backend + critical JS fixes)
3. ✅ Запустить backend tests (`pytest tests/api/test_articles.py`)
4. ✅ Реализовать Фазу 2 (UX - async modal close)
5. ✅ Реализовать Фазу 3 (UI polish)
6. ✅ Создать 4 атомарных коммита
7. ✅ Запустить `@skill:test-code` для автоматического тестирования
8. ✅ Создать PR в `explore` branch
9. ✅ Code review + QA approval
10. ✅ Deploy на dev → smoke test → deploy на production
