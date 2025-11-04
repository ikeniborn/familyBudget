# 07. API Specification

## Обзор документа

Данный документ описывает REST API endpoints системы Family Budget, включая новый endpoint интеллектуальных рекомендаций сумм.

**Версия:** 1.0
**Дата:** 2025-11-04
**Статус:** Утверждено

---

## 7.1 Analytics API

### 7.1.1 GET /api/v1/analytics/recommended-amounts

Получение рекомендуемых сумм для кнопок быстрого выбора в формах транзакций и планов.

#### Описание

Endpoint возвращает 4 рекомендуемые суммы, рассчитанные на основе исторических данных пользователя с использованием алгоритма K-means кластеризации. При недостатке данных возвращаются дефолтные значения.

#### Authentication

Требуется JWT token (httpOnly cookie \`access_token\`).

#### HTTP Request

\`\`\`
GET /api/v1/analytics/recommended-amounts
\`\`\`

#### Query Parameters

| Parameter       | Type    | Required | Default   | Description                                                    |
|-----------------|---------|----------|-----------|----------------------------------------------------------------|
| article_id      | integer | No       | null      | ID категории для category-specific рекомендаций. Null = global |
| type            | string  | No       | null      | Тип транзакции: \`income\` или \`expense\`. Null = все типы    |
| record_type     | string  | Yes      | \`fact\`  | Тип записи: \`fact\` (транзакции) или \`plan\` (планы)         |
| period          | string  | No       | \`quarter\`| Период анализа: \`week\`, \`month\`, \`quarter\`, \`year\`    |
| min_sample_size | integer | No       | 20        | Минимальное количество транзакций для K-means (fallback если <)|

#### Response 200 (OK)

\`\`\`json
{
  "amounts": [100.00, 500.00, 1000.00, 5000.00],
  "algorithm": "k_means",
  "metadata": {
    "source": "k_means",
    "sample_size": 47,
    "min_amount": 50.00,
    "max_amount": 8000.00,
    "avg_amount": 1234.56,
    "period_days": 90,
    "algorithm_version": "1.0",
    "convergence_iterations": 8,
    "article_id": 5,
    "article_name": "Продукты"
  }
}
\`\`\`

#### Response Fields

| Field                          | Type            | Description                                              |
|--------------------------------|-----------------|----------------------------------------------------------|
| amounts                        | array[Decimal]  | Массив из 4 рекомендуемых сумм в порядке возрастания     |
| algorithm                      | string          | Используемый алгоритм: \`k_means\` или \`default\`       |
| metadata.source                | string          | Источник данных: \`k_means\`, \`cached\`, \`default\`    |
| metadata.sample_size           | integer         | Количество проанализированных транзакций (0 = default)   |
| metadata.min_amount            | Decimal | null  | Минимальная сумма в выборке (null для default)           |
| metadata.max_amount            | Decimal | null  | Максимальная сумма в выборке (null для default)          |
| metadata.avg_amount            | Decimal | null  | Средняя сумма в выборке (null для default)               |
| metadata.period_days           | integer         | Период анализа в днях (7/30/90/365)                      |
| metadata.algorithm_version     | string | null   | Версия алгоритма K-means                                 |
| metadata.convergence_iterations| integer | null  | Количество итераций до сходимости K-means                |
| metadata.article_id            | integer | null  | ID категории (null = global)                             |
| metadata.article_name          | string | null   | Название категории (null = global)                       |

#### Error Responses

**401 Unauthorized**
\`\`\`json
{
  "detail": "Authentication required"
}
\`\`\`

**422 Unprocessable Entity**
\`\`\`json
{
  "detail": [
    {
      "loc": ["query", "record_type"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
\`\`\`

#### Examples

##### Example 1: Global expense recommendations

**Request:**
\`\`\`bash
curl -X GET "https://api.example.com/api/v1/analytics/recommended-amounts?type=expense&record_type=fact" \\
  -H "Cookie: access_token=<jwt_token>"
\`\`\`

**Response:**
\`\`\`json
{
  "amounts": [100.00, 500.00, 1000.00, 5000.00],
  "algorithm": "default",
  "metadata": {
    "source": "default",
    "sample_size": 0,
    "min_amount": null,
    "max_amount": null,
    "avg_amount": null,
    "period_days": 90,
    "algorithm_version": null,
    "convergence_iterations": null,
    "article_id": null,
    "article_name": null
  }
}
\`\`\`

##### Example 2: Category-specific recommendations (Groceries)

**Request:**
\`\`\`bash
curl -X GET "https://api.example.com/api/v1/analytics/recommended-amounts?article_id=5&type=expense&record_type=fact&period=quarter" \\
  -H "Cookie: access_token=<jwt_token>"
\`\`\`

**Response:**
\`\`\`json
{
  "amounts": [300.00, 800.00, 1500.00, 3000.00],
  "algorithm": "k_means",
  "metadata": {
    "source": "k_means",
    "sample_size": 47,
    "min_amount": 200.00,
    "max_amount": 5000.00,
    "avg_amount": 1234.56,
    "period_days": 90,
    "algorithm_version": "1.0",
    "convergence_iterations": 8,
    "article_id": 5,
    "article_name": "Продукты"
  }
}
\`\`\`

##### Example 3: Plan recommendations (income)

**Request:**
\`\`\`bash
curl -X GET "https://api.example.com/api/v1/analytics/recommended-amounts?type=income&record_type=plan&period=month" \\
  -H "Cookie: access_token=<jwt_token>"
\`\`\`

**Response:**
\`\`\`json
{
  "amounts": [10000.00, 20000.00, 50000.00, 100000.00],
  "algorithm": "default",
  "metadata": {
    "source": "default",
    "sample_size": 0,
    "period_days": 30,
    "article_id": null,
    "article_name": null
  }
}
\`\`\`

#### Implementation Details

**Backend Components:**
- **Endpoint:** \`backend/app/api/v1/analytics.py\`
- **Schema:** \`backend/app/schemas/analytics.py\`
- **Database:** PostgreSQL функции в migration 013:
  - \`k_means_clustering_1d()\` - K-means алгоритм
  - \`round_to_nice()\` - округление до "красивых" чисел
  - \`calculate_recommended_amounts()\` - расчет рекомендаций
  - \`recalculate_recommended_amounts()\` - batch пересчет (scheduler)

**Frontend Integration:**
- **Telegram Web Apps:** 
  - \`webapp/add.html\` - динамические кнопки для фактов
  - \`webapp/addplan.html\` - динамические кнопки для планов
  - \`webapp/edit.html\` - динамические кнопки для редактирования
- **Debounce:** 300ms delay + AbortController
- **Trigger points:** смена типа, смена категории, инициализация страницы

**Caching Strategy:**
1. Check \`t_recommended_amounts\` table (TTL 24h)
2. On-demand calculation via \`calculate_recommended_amounts()\`
3. Fallback to hardcoded defaults

**Scheduler Job:**
- **Frequency:** Daily at 02:00 UTC
- **Function:** \`recalculate_recommended_amounts()\`
- **Purpose:** Pre-calculate recommendations for popular categories
- **Implementation:** \`backend/app/scheduler.py\`

#### Performance

| Operation                  | Time (avg) | Notes                                      |
|----------------------------|------------|--------------------------------------------|
| Cache lookup               | ~5ms       | Indexed SELECT on t_recommended_amounts    |
| On-demand K-means          | ~50-200ms  | PostgreSQL PL/pgSQL function               |
| Batch recalculation (all)  | ~1-5s      | Scheduler job (02:00 UTC)                  |

#### Rate Limiting

No explicit rate limiting на этот endpoint (защищено debounce на клиенте + authentication).

---

## 7.2 Other API Endpoints

*(Здесь могут быть добавлены другие API endpoints по мере развития проекта)*

---

## История изменений

| Версия | Дата       | Автор          | Описание                                           |
|--------|------------|----------------|----------------------------------------------------|
| 1.0    | 2025-11-04 | Claude + User  | Первая версия: GET /api/v1/analytics/recommended-amounts |

---

**Ссылки на связанные документы:**
- [04. Functional Requirements](./04-functional-requirements.md)
- [06. Database Design](./06-database-design.md) (migration 013)
- [README.md](../../README.md)
