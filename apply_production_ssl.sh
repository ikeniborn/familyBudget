#!/bin/bash
# Скрипт для переключения на production Let's Encrypt

echo "=== Переключение Traefik на production Let's Encrypt ==="

# 1. Остановка Traefik
echo "Останавливаем Traefik..."
docker-compose down traefik

# 2. Удаление старых staging сертификатов
echo "Удаляем старые staging сертификаты..."
docker volume rm familybudget_traefik-certificates 2>/dev/null || true

# 3. Запуск Traefik с production конфигурацией
echo "Запускаем Traefik с production Let's Encrypt..."
docker-compose up -d traefik

# 4. Ожидание запуска
echo "Ожидаем запуска Traefik..."
sleep 10

# 5. Проверка логов
echo "Проверяем логи (нажмите Ctrl+C для выхода)..."
docker-compose logs -f traefik