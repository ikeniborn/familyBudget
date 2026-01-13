# 💰 Family Budget

> Семейный бюджет под контролем! Простой учёт доходов и расходов для всей семьи.

**Family Budget** — это веб-приложение для управления семейными финансами с поддержкой офлайн-режима, автоматическими напоминаниями и интеграцией с Telegram.

---

## ✨ Что умеет

### 📊 Учёт и планирование
- **Быстрый ввод транзакций** — добавляйте доходы и расходы за секунды
- **Планирование бюджета** — устанавливайте лимиты по категориям
- **Списки покупок** — планируйте покупки с offline sync и категоризацией товаров
- **Регулярные платежи** — настройте автонапоминания для аренды, ЖКХ, кредитов, подписок
- **Переводы между счетами** — учитывайте перемещение денег между картами и кошельками

### 📈 Аналитика
- **Дашборд с метриками** — баланс, доходы, расходы — всё на одном экране
- **График план vs факт** — видите отклонения в реальном времени
- **Статистика по категориям** — понимайте куда уходят деньги

### 🔔 Напоминания
- **Уведомления о превышении бюджета** — получайте алерты когда расходы достигают 90% от плана
- **Telegram напоминания** — о регулярных платежах (аренда, кредиты, подписки)
- **Web Push уведомления** — мгновенные алерты в браузере/PWA
- **Управление каналами** — настройте Web Push и Telegram независимо
- **Еженедельный отчёт** — итоги недели автоматически в Telegram

### 📥 Импорт данных
- **Банковские выписки** — загружайте CSV из банков (Тинькофф, Сбербанк, Альфа-Банк, ВТБ)
- **Google Sheets** — импортируйте таблицы расходов одним кликом
- **Автоматическая категоризация** — умное сопоставление операций с категориями
- **Bulk операции** — массовое редактирование импортированных записей

### 📱 Мобильная версия (PWA)
- **Работает офлайн** — добавляйте транзакции без интернета
- **Установка как приложение** — на главный экран iPhone/Android
- **Синхронизация** — автоматическая отправка данных при подключении
- **Web Workers** — быстрая обработка импорта и расчетов в фоне
- **Биометрия** — вход по TouchID/FaceID (WebAuthn)
- **Push уведомления** — работают даже когда приложение закрыто

### 🤖 Telegram интеграция
- **Web Apps в боте** — веб-интерфейс прямо в Telegram (кнопка меню)
- **Push-уведомления** — о превышении бюджета и важных событиях
- **Команды бота** — /start для регистрации, /help для справки

---

## ⚡ Технические преимущества

**Что отличает Family Budget от других budget trackers:**

- **⚡ Offline-First архитектура** — работает без интернета, синхронизация автоматическая при подключении
- **🔄 Real-Time обновления** — WebSocket с Long Polling fallback, данные обновляются мгновенно во всех вкладках
- **🚀 Web Workers** — обработка импорта CSV, расчеты категорий и синхронизация не замедляют интерфейс
- **📦 Агрессивное кэширование** — Redis + Service Worker + HTTP cache = молниеносная загрузка страниц
- **📚 Полная история изменений** — SCD Type 2, каждое изменение записи сохраняется навечно
- **🌳 Closure Table** — быстрые иерархические запросы по категориям любой вложенности
- **🔒 Deduplication** — защита от дубликатов при offline sync и network retries
- **🎯 Write-Behind паттерн** — мгновенная запись в IndexedDB, асинхронная отправка на сервер

---

## 🎯 Почему Family Budget

| Проблема | Решение |
|----------|---------|
| 😓 Забываете вносить расходы | **Офлайн-режим** — вводите сразу, синхронизация потом |
| 📊 Не понимаете куда уходят деньги | **Визуальная аналитика** — графики, категории, тренды |
| 💸 Превышаете бюджет незаметно | **Автоматические уведомления** — алерты в Telegram/браузере |
| ⏰ Забываете про регулярные платежи | **Напоминания** — за день до аренды, кредита, подписок |
| 🏦 Много времени на импорт выписок | **CSV импорт** — загрузили файл, проверили, готово |
| 👨‍👩‍👧‍👦 Трудно вести общий бюджет | **Shared модель** — все видят все транзакции |

---

## 🔐 Безопасность

- **Telegram OAuth** — вход без пароля через мессенджер (рекомендуется)
- **Email + 2FA** — двухфакторная аутентификация (Google Authenticator, Authy)
- **WebAuthn биометрия** — быстрый вход по TouchID/FaceID на iPhone/Mac
- **Защита данных** — JWT в httpOnly cookies, шифрование паролей Argon2id
- **Админ доступ** — emergency-вход для восстановления если потеряли 2FA-устройство
- **Comprehensive audit** — полное логирование всех операций с IP и User-Agent
- **Sign count validation** — автоматическое обнаружение клонированных WebAuthn устройств

---

## 🚀 Быстрый старт

Для развёртывания на своём сервере:

```bash
# 1️⃣ Клонировать репозиторий
git clone https://github.com/ikeniborn/familyBudget.git ~/familyBudget
cd ~/familyBudget

# 2️⃣ Установить зависимости (Docker, Node.js, PostgreSQL)
sudo bash install.sh

# 3️⃣ Настроить окружение (интерактивно)
sudo bash setup.sh

# 4️⃣ Запустить! 🎉
sudo bash deploy.sh --profile full
```

**Требования:**
- Сервер Ubuntu 20.04+ / Debian 11+
- 1 CPU, 2 GB RAM, 20 GB диск
- Домен с SSL (для Telegram OAuth и HTTPS)

📖 Подробнее: [START.md](START.md)

---

## 🛠 Технологии

**Backend**: FastAPI 0.121, SQLModel, PostgreSQL 16, Redis 7
**Frontend**: HTMX, Tailwind CSS 3, DaisyUI 4, ECharts
**Mobile**: PWA (Service Worker, Web Workers, Push API, WebAuthn)
**Realtime**: WebSocket (primary) + Long Polling (fallback)
**Deployment**: Docker Compose, Nginx, Let's Encrypt
**Bot**: python-telegram-bot 21, Telegram Web Apps

---

## 📚 Документация

| Документ | Для кого |
|----------|----------|
| [START.md](START.md) | 🔧 Администраторы — установка и настройка |
| [CLAUDE.md](CLAUDE.md) | 👨‍💻 Разработчики — архитектура и API |
| [docs/architecture/](docs/architecture/) | 🏗 Архитекторы — технические детали (85 файлов) |
| `/docs` (Swagger) | 🔌 Интеграторы — REST API |

---

## 🤖 Claude Code Skill: pr-automation

**Автоматизация создания Pull Request с мониторингом CI/CD и автоматическим исправлением ошибок.**

Скилл находится в проекте [claude](https://github.com/ikeniborn/claude) и автоматически доступен при работе с familyBudget через Claude Code.

### Возможности

- ✅ **Auto-detection** технологического стека из `/docs/architecture`
- ✅ **Draft PR creation** с auto-generated описанием
- ✅ **Real-time CI/CD monitoring** через GitHub Actions
- ✅ **Автоматическое исправление** 4 типов ошибок (TypeScript, ESLint, Vitest, Build)
- ✅ **Ralph-loop integration** для итеративных фиксов до успеха
- ✅ **Conventional Commits** для всех автокоммитов

### Предварительные требования

#### gh CLI в изолированном окружении

```bash
cd /home/ikeniborn/Documents/Project/claude
./iclaude.sh --install-gh
gh auth login
```

### Использование

```
Создать PR из feature/transaction-filters в test
```

Скилл автоматически:
1. Определит стек из `/docs/architecture/index.yaml` (TypeScript + Vite + HTMX + Tailwind)
2. Проанализирует `.github/workflows/` (frontend-tests, typescript-check, release-drafter)
3. Создаст Draft PR с описанием
4. Будет мониторить CI/CD checks
5. Исправит найденные ошибки (TypeScript, ESLint, tests)
6. Отметит PR как ready for review

### Документация

**См. полную документацию в проекте claude:**
- Основное: [claude/.nvm-isolated/.claude-isolated/skills/pr-automation/SKILL.md](https://github.com/ikeniborn/claude/blob/master/.nvm-isolated/.claude-isolated/skills/pr-automation/SKILL.md)
- Примеры: [examples/](https://github.com/ikeniborn/claude/tree/master/.nvm-isolated/.claude-isolated/skills/pr-automation/examples)
- Стратегии: [rules/](https://github.com/ikeniborn/claude/tree/master/.nvm-isolated/.claude-isolated/skills/pr-automation/rules)

---

## 🆘 Поддержка

- 🐛 **Нашли баг?** → [GitHub Issues](https://github.com/ikeniborn/familyBudget/issues)
- 💬 **Вопросы по установке?** → [START.md](START.md)
- 📚 **Документация** → [docs/](docs/)

---

## 📄 Лицензия

MIT License — делайте что хотите! 🎉

---

Made with ❤️ for families who want to save money 💰
