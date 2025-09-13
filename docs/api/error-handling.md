# Обработка ошибок в API Family Budget

## Обзор

Система Family Budget реализует комплексную обработку ошибок как на backend (FastAPI), так и на frontend (SvelteKit). Этот документ описывает стандарты обработки ошибок, коды ошибок и примеры их обработки.

## Архитектура обработки ошибок

### Backend (FastAPI)

Backend возвращает стандартизированные HTTP коды ошибок с детальными сообщениями:

```python
from fastapi import HTTPException, status

# Пример возврата ошибки 409 (Conflict)
if existing_period:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"Период на дату {date.strftime('%Y-%m-%d')} уже существует"
    )
```

### Frontend (SvelteKit)

Frontend извлекает детальные сообщения об ошибках и отображает их пользователю:

```typescript
// Обработка ошибок в API запросах
try {
    const response = await api.post('/periods/', periodData);
    return response.data;
} catch (error: any) {
    let errorMessage = 'Произошла ошибка при сохранении периода';

    if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
    } else if (error.response?.status === 409) {
        errorMessage = 'Период с такой датой уже существует';
    } else if (error.message) {
        errorMessage = error.message;
    }

    throw new Error(errorMessage);
}
```

## Стандартные коды ошибок

### 400 - Bad Request
**Описание:** Некорректные данные запроса или нарушение валидации

**Примеры использования:**
- Неверный формат даты
- Пустые обязательные поля
- Нарушение бизнес-логики

**Backend:**
```python
# Валидация данных периода
if not period_data.name.strip():
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Название периода не может быть пустым"
    )
```

**Frontend обработка:**
```typescript
if (error.response?.status === 400) {
    toast.error(`Ошибка валидации: ${error.response.data.detail}`);
}
```

### 404 - Not Found
**Описание:** Запрашиваемый ресурс не найден

**Примеры использования:**
- Попытка получить несуществующий период
- Обращение к удаленной записи
- Неверный ID ресурса

**Backend:**
```python
period = db.query(Period).filter(
    Period.id == period_id,
    Period.user_id == current_user.id
).first()

if not period:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Период не найден"
    )
```

### 409 - Conflict
**Описание:** Конфликт данных, например, нарушение уникальности

**Примеры использования:**
- Дублирующиеся периоды (дата)
- Дублирующиеся коды ЦФО/МВЗ
- Дублирующиеся коды номенклатур

**Backend реализация:**

#### Периоды
```python
# Проверка уникальности периода
existing_period = db.query(Period).filter(
    Period.date == date,
    Period.user_id == current_user.id
).first()

if existing_period:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"Период на дату {date.strftime('%Y-%m-%d')} уже существует"
    )
```

#### Номенклатуры
```python
# Проверка уникальности кода номенклатуры
existing_nomenclature = db.query(Nomenclature).filter(
    Nomenclature.code == nomenclature.code,
    Nomenclature.user_id == current_user.id
).first()

if existing_nomenclature:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"Номенклатура с кодом '{nomenclature.code}' уже существует"
    )
```

#### Финансовые центры (ЦФО)
```python
# Проверка уникальности кода ЦФО
existing_center = db.query(FinancialCenter).filter(
    FinancialCenter.code == financial_center.code,
    FinancialCenter.user_id == current_user.id
).first()

if existing_center:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"ЦФО с кодом '{financial_center.code}' уже существует"
    )
```

### 500 - Internal Server Error
**Описание:** Внутренняя ошибка сервера

**Backend:**
```python
try:
    # Операции с БД
    db.add(new_period)
    db.commit()
except Exception as e:
    db.rollback()
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Ошибка при сохранении данных"
    )
```

## Frontend паттерны обработки ошибок

### Унифицированная обработка в компонентах

Все компоненты справочников используют единообразную обработку ошибок:

```typescript
async function handleSubmit(data: any) {
    try {
        loading = true;

        if (editingItem) {
            await api.put(`/endpoint/${editingItem.id}/`, data);
            toast.success('Запись успешно обновлена');
        } else {
            await api.post('/endpoint/', data);
            toast.success('Запись успешно создана');
        }

        await loadData();
        closeModal();

    } catch (error: any) {
        let errorMessage = 'Произошла ошибка при сохранении';

        // Извлечение детального сообщения
        if (error.response?.data?.detail) {
            errorMessage = error.response.data.detail;
        } else if (error.response?.status === 409) {
            errorMessage = 'Запись с такими данными уже существует';
        } else if (error.response?.status === 400) {
            errorMessage = 'Проверьте корректность введенных данных';
        } else if (error.message) {
            errorMessage = error.message;
        }

        toast.error(errorMessage);
        console.error('Error:', error);

    } finally {
        loading = false;
    }
}
```

### Обработка сетевых ошибок

```typescript
// Обработка отсутствия соединения
if (!error.response) {
    toast.error('Ошибка соединения с сервером. Проверьте подключение к интернету.');
    return;
}

// Обработка таймаута
if (error.code === 'ECONNABORTED') {
    toast.error('Превышено время ожидания. Попробуйте позже.');
    return;
}
```

## Логирование ошибок

### Backend логирование

```python
import logging

logger = logging.getLogger(__name__)

try:
    # Операции
    pass
except Exception as e:
    logger.error(f"Ошибка при создании периода: {str(e)}", exc_info=True)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Внутренняя ошибка сервера"
    )
```

### Frontend логирование

```typescript
// Логирование для отладки
console.error('API Error Details:', {
    status: error.response?.status,
    statusText: error.response?.statusText,
    data: error.response?.data,
    url: error.config?.url,
    method: error.config?.method
});
```

## Пользовательские уведомления

### Toast уведомления

Система использует toast уведомления для информирования пользователя:

```typescript
import { toast } from '$lib/stores/toast';

// Успешные операции
toast.success('Период успешно создан');

// Ошибки
toast.error('Период с такой датой уже существует');

// Предупреждения
toast.warning('Заполните все обязательные поля');

// Информация
toast.info('Загрузка данных...');
```

## Тестирование обработки ошибок

### Backend тесты

```python
# Тест ошибки 409 для периодов
def test_create_duplicate_period_returns_409(client, test_user, auth_headers):
    # Создаем период
    period_data = {
        "date": "2024-01",
        "name": "Январь 2024"
    }
    response = client.post("/api/periods/", json=period_data, headers=auth_headers)
    assert response.status_code == 200

    # Пытаемся создать дубликат
    response = client.post("/api/periods/", json=period_data, headers=auth_headers)
    assert response.status_code == 409
    assert "уже существует" in response.json()["detail"]
```

### Frontend тесты

```typescript
// Тест обработки ошибки 409
test('handles 409 conflict error correctly', async () => {
    // Mock API response with 409 error
    vi.mocked(api.post).mockRejectedValue({
        response: {
            status: 409,
            data: { detail: 'Период на дату 2024-01-01 уже существует' }
        }
    });

    // Trigger the error
    await handleSubmit(duplicateData);

    // Check error message
    expect(screen.getByText(/уже существует/)).toBeInTheDocument();
});
```

## Мониторинг и метрики

### Отслеживание ошибок

- Все ошибки API логируются в централизованную систему
- Метрики количества ошибок по кодам
- Уведомления при критических ошибках

### Доступные метрики

- Количество 4xx ошибок по эндпоинтам
- Время ответа при ошибках
- Частота конкретных ошибок (например, 409 дубликатов)

## Лучшие практики

### Backend

1. **Используйте специфичные коды ошибок** для каждого типа проблемы
2. **Предоставляйте детальные сообщения** в поле `detail`
3. **Логируйте все ошибки** для отладки
4. **Не раскрывайте внутреннюю логику** в сообщениях ошибок

### Frontend

1. **Извлекайте детальные сообщения** из `error.response.data.detail`
2. **Предоставляйте fallback сообщения** для неизвестных ошибок
3. **Используйте toast уведомления** для информирования пользователя
4. **Логируйте полную информацию об ошибке** в консоль для разработчиков

### Пользовательский интерфейс

1. **Сообщения на русском языке** с понятными объяснениями
2. **Избегайте технических деталей** в пользовательских сообщениях
3. **Предлагайте решения** когда это возможно
4. **Поддерживайте консистентность** в стиле уведомлений

## Заключение

Комплексная система обработки ошибок обеспечивает лучший пользовательский опыт и упрощает диагностику проблем. Все компоненты системы следуют единым стандартам обработки ошибок, что гарантирует консистентность и надежность приложения.