# 💰 Family Budget

> 🎯 Семейный бюджет под контролем! Удобный учёт расходов для всей семьи.

## ✨ Что умеет

- 🏠 **Dashboard** — все метрики на одном экране
- 📊 **Аналитика** — план vs факт с красивыми графиками
- 💳 **Транзакции** — быстрый ввод расходов и доходов
- 🔄 **Переводы** — между счетами одним кликом
- 🛒 **Списки покупок** — группы товаров с иерархией
- 📥 **Импорт** — загрузка банковских выписок
- 📱 **PWA** — работает даже без интернета
- 🤖 **Telegram** — уведомления + Web Apps прямо в боте

## 🔐 Авторизация

Два способа входа:

| Способ | Описание |
|--------|----------|
| 📱 **Telegram** | Мгновенный вход без пароля (рекомендуется) |
| 📧 **Email** | Регистрация с активацией администратором |

**Дополнительно:**
- 🔒 **2FA** — двухфакторная аутентификация (Google Authenticator)
- 🍪 **JWT в httpOnly cookies** — защита от XSS

## 📋 Требования к инфраструктуре

### 🔴 Обязательно

| Что нужно | Зачем |
|-----------|-------|
| 🖥 **Сервер** | Ubuntu 20.04+ / Debian 11+ |
| 💾 **Ресурсы** | 1 CPU, 2 GB RAM, 20 GB диск |
| 🐳 **Docker** | Docker + Compose v2.24+ |
| 🌐 **Домен** | Для HTTPS и Telegram OAuth |
| 🔐 **SSL** | Let's Encrypt (бесплатно!) |

### 🟡 Опционально

| Что | Зачем |
|-----|-------|
| ☁️ **S3 хранилище** | Облачные бэкапы (Yandex/AWS) |
| 🤖 **Telegram Bot** | Уведомления о превышении бюджета |

## 🚀 Быстрый старт

```bash
# 1️⃣ Клонировать репозиторий
git clone https://github.com/ikeniborn/familyBudget.git ~/familyBudget
cd ~/familyBudget

# 2️⃣ Установить зависимости
sudo bash install.sh

# 3️⃣ Настроить окружение (интерактивно)
sudo bash setup.sh

# 4️⃣ Запустить! 🎉
sudo bash deploy.sh --profile full
```

> 💡 **Совет:** Все скрипты поддерживают `--help` для справки:
> ```bash
> sudo bash deploy.sh --help
> sudo bash logs.sh --help
> ```

📖 Подробнее: [START.md](START.md)

## 🤖 Telegram: уведомления + Web Apps

### Что работает

- ✅ **Уведомления** — бот предупредит когда расходы достигнут 90% от плана
- ✅ **Web Apps** — веб-интерфейс прямо в Telegram (кнопка меню)
- ⏳ **Учёт через бота** — пока не реализован, используйте веб

### Настройка бота

1. Создайте бота через [@BotFather](https://t.me/BotFather)
2. Получите токен: `123456789:ABCdef...`
3. Добавьте в `.env`:
   ```
   TELEGRAM_BOT_TOKEN=ваш_токен
   ```
4. Перезапустите: `sudo bash deploy.sh --profile full`

### Примеры уведомлений

```
⚠️ Продукты: использовано 90% бюджета (45 000 из 50 000 ₽)
🚨 Развлечения: бюджет превышен на 500 ₽!
```

## 🛠 Технологии

| Слой | Стек |
|------|------|
| Backend | FastAPI, SQLModel, PostgreSQL 16 |
| Frontend | HTMX, Tailwind CSS, DaisyUI, ECharts |
| Инфра | Docker Compose, Nginx, Let's Encrypt |
| Бот | python-telegram-bot, Web Apps |

## 📚 Документация

| Документ | Для кого |
|----------|----------|
| [START.md](START.md) | 🔧 Администраторы (установка) |
| [CLAUDE.md](CLAUDE.md) | 👨‍💻 Разработчики |
| [docs/prd/](docs/prd/) | 📋 Product Requirements |
| [docs/guides/](docs/guides/) | 📖 Руководства пользователя |
| `/docs` (Swagger) | 🔌 API документация |

## 🆘 Помощь

- 🐛 Проблемы: [GitHub Issues](https://github.com/ikeniborn/familyBudget/issues)
- 📖 Установка: [START.md](START.md)
- 📚 Документация: [docs/](docs/)

## 📄 Лицензия

MIT License — делайте что хотите! 🎉

---

Made with ❤️ for families who want to save money 💰
