# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

**NEVER**: 
- Edit CLAUDE.md. Only user can add or delete tgis file.
- Delete volume docker. Only after approve user.
- Никогда не запускай сборку на сервере. Все изменения доставляются на сервер через cicd после обновления VERSION. Автоматически подымается версия на один шаг в рамках патча major.minor.patch (0.0.1>0.0.2)

## Project Overview

Family Budget is a family budget management system with Telegram bot and web interface. Built on FastAPI (backend), PostgreSQL (database), Docker deployment.

**Key Features:**
- 🔐 Authentication: Telegram OAuth, Email+Password, WebAuthn biometrics
- 📊 Hierarchical budget categories (Closure Table pattern)
- 💰 Transaction tracking with offline sync support
- 🤖 Telegram bot with Web Apps
- 🌐 Progressive Web App (HTMX + Tailwind CSS + DaisyUI)
- 📈 Real-time updates via WebSocket + Redis Pub/Sub
- 🔄 Change history (SCD Type 1 + History tables)

**Stack:** FastAPI 0.121.2 | PostgreSQL 16 | python-telegram-bot 21.10 | Docker Compose | Dexie.js 4.0+ (offline)

## Core Rules

**1. Multi-Perspective Analysis**

При решении любой задачи рассматривай проблему с точки зрения:
- **Системный архитектор**: Инфраструктурные решения, масштабируемость, отказоустойчивость
- **Frontend разработчик**: UX/UI эффективность, производительность клиента, доступность
- **Backend разработчик**: Оптимальная обработка данных, нагрузка на ресурсы, эффективность API
- **Security специалист**: Потенциальные уязвимости, защита данных, соответствие best practices
- **Технический писатель**: Актуальность и корректность документации, синхронизация с кодом

**2. Validation Loop**

После разработки решения:
- Проводить повторную проверку архитектурных решений
- Верифицировать соответствие требованиям из всех перспектив
- Задавать уточнющие вопросы на этапе анализа и планирования

## Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Production** | https://fb.ikeniborn.ru/ | Live users |
| **Development** | https://fbd.ikeniborn.ru/ | Feature testing |

- For analysis logs connect to test server via "ssh budget-test".
- Work directory "/opt/budget"
- Git directory "~/familyBudget"

## Git requests
- Only create requets to test branch from dev/* branches 

## UXUI

- Все решения по веб функционалльности должны тестироваться для мобильных, планшетов, десктопов
- Веб должен поддерживать PWA и браузерную версию для Yandex Browser, Chrome, Safary 14+

