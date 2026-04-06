## 13. Appendices

### 13.1 Appendix A: Glossary

| Термин | Определение |
|--------|-------------|
| **SCD2** | Slowly Changing Dimension Type 2 - подход к версионированию справочников, при котором история изменений сохраняется через создание новых записей |
| **Счет** | Финансовый центр (в коде: `FinancialCenter`) - банковский счет, кошелек, наличные или другой источник/хранилище денежных средств |
| **Место затрат** | Центр затрат (в коде: `CostCenter`) - проект, отдел или категория, к которой относятся расходы |
| **Closure Table** | Паттерн проектирования БД для представления иерархических структур через таблицу с ancestor_id, descendant_id, depth |
| **HTMX** | JavaScript библиотека для создания динамических веб-интерфейсов через HTML-атрибуты |
| **ECharts** | Apache ECharts - JavaScript библиотека для интерактивных графиков |
| **Long Polling** | Техника получения обновлений от сервера через длинные HTTP-запросы |
| **JWT** | JSON Web Token - стандарт токенов для авторизации |
| **RBAC** | Role-Based Access Control - контроль доступа на основе ролей |
| **UFW** | Uncomplicated Firewall - упрощенный firewall для Linux |
| **S3** | Simple Storage Service - объектное хранилище (Amazon/Yandex compatible) |

### 13.2 Appendix B: References

**Технологии и документация:**

- **FastAPI:** https://fastapi.tiangolo.com/
- **Telegram Bot API:** https://core.telegram.org/bots/api
- **Telegram Login Widget:** https://core.telegram.org/widgets/login
- **python-telegram-bot:** https://python-telegram-bot.org/
- **Apache ECharts:** https://echarts.apache.org/
- **PostgreSQL 16:** https://www.postgresql.org/docs/16/
- **HTMX:** https://htmx.org/
- **Docker:** https://docs.docker.com/

**Паттерны и best practices:**

- **Closure Table Pattern:** https://www.slideshare.net/billkarwin/models-for-hierarchical-data
- **SCD Type 2:** https://en.wikipedia.org/wiki/Slowly_changing_dimension
- **JWT Best Practices:** https://tools.ietf.org/html/rfc8725

### 13.3 Appendix C: Sample Data

**Статьи расходов (иерархия):**

```
Продукты (PROD)
  ├─ Еда (FOOD)
  │   ├─ Молочные (DAIRY)
  │   ├─ Мясо (MEAT)
  │   └─ Овощи (VEG)
  ├─ Напитки (DRINK)
  └─ Хозяйственные товары (HOUSE)

Транспорт (TRANS)
  ├─ Бензин (FUEL)
  ├─ Парковка (PARK)
  └─ Общественный транспорт (PUBLIC)

Развлечения (ENT)
  ├─ Кино (CINEMA)
  ├─ Рестораны (REST)
  └─ Спорт (SPORT)
```

**Счета (FinancialCenter):**
- Сбербанк (SBER)
- Тинькофф (TINK)
- Наличные (CASH)

**Места затрат (CostCenter):**
- Дом (HOME)
- Транспорт (CAR)
- Образование (EDU)

**Периоды:**
- 2025-10 (Октябрь 2025, 01.10.2025-31.10.2025)
- 2025-11 (Ноябрь 2025, 01.11.2025-30.11.2025)

**Факты (примеры):**
- user_id=1, type=plan, amount=15000, article="Продукты", period="2025-10"
- user_id=1, type=fact, amount=1500, article="Молочные", period="2025-10", date=2025-10-15

### 13.4 Appendix D: Environment Variables

**Полный список переменных окружения:**

| Переменная | Обязательность | Описание | Пример |
|------------|----------------|----------|--------|
| `TELEGRAM_BOT_TOKEN` | Required | Telegram Bot API token | `123456789:ABCdef...` |
| `JWT_SECRET_KEY` | Required | Ключ для подписи JWT токенов | `random_32_chars` |
| `POSTGRES_USER` | Required | PostgreSQL username | `familybudget` |
| `POSTGRES_PASSWORD` | Required | PostgreSQL password | `strong_password` |
| `POSTGRES_DB` | Required | PostgreSQL database name | `familybudget` |
| `ADMIN_TELEGRAM_ID` | Required | Telegram ID администратора | `123456789` |
| `BACKEND_API_URL` | Required | URL FastAPI backend для бота | `http://backend:8000/api/v1` |
| `POSTGRES_EXTERNAL_ACCESS` | Optional | Разрешить внешний доступ к PostgreSQL | `false` |
| `POSTGRES_ALLOWED_IP` | Optional | IP адрес для внешнего доступа | `192.168.1.100` |
| `AWS_ACCESS_KEY_ID` | Optional | Яндекс Object Storage access key | - |
| `AWS_SECRET_ACCESS_KEY` | Optional | Яндекс Object Storage secret key | - |
| `S3_BUCKET_NAME` | Optional | Имя S3 bucket для бэкапов | `familybudget-backups` |

**Template file:** `.env.template`

### 13.5 Appendix E: Change Log

| Версия | Дата | Изменения |
|--------|------|-----------|
| **1.0** | 2025-10-08 | Первичная версия PRD. Полное покрытие всех 21 FR, 7 NFR, 7 рисков. Детализация архитектуры, API, БД, deployment. |

---

## Заключение

Данный PRD представляет собой полную техническую спецификацию системы управления семейным бюджетом "FamilyBudget". Документ охватывает все аспекты разработки:

- ✅ **100% покрытие функциональных требований** (21 FR)
- ✅ **100% покрытие нефункциональных требований** (7 NFR)
- ✅ **Детальная архитектура** с 7 компонентами
- ✅ **Полная спецификация БД** с SCD2 и Closure Table
- ✅ **API спецификация** с примерами
- ✅ **UI/UX дизайн** с 5 типами графиков
- ✅ **Security & Authentication** с критическими мерами
- ✅ **Deployment & Operations** с bash скриптами
- ✅ **Risk Management** с 7 идентифицированными рисками

**Готовность к реализации:** ✅ **READY**

**Следующие шаги:**
1. Утверждение PRD
2. Начало Phase 1 разработки: Database schema
3. Phase 2: Backend API implementation
4. Phase 3: Telegram Bot development
5. Phase 4: Web Interface & Analytics
6. Phase 5: Testing & Deployment

---

**Документ создан:** 2025-10-08  
**Версия:** 1.0  
**Статус:** Final  
**Автор:** AI System

