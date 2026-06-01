# Intent: Waterfall Chart — Transfers as Line Chart

**Date:** 2026-06-01
**Status:** draft

## Objective

Исправить отображение "Списание" и "Пополнение" в каскадной диаграмме (`chart-waterfall`):
- Текущее состояние: `type: 'bar'` со `stack: 'flow'` → создаёт отдельные столбцы рядом с waterfall-столбцами (два столбца на одно значение X)
- В режиме `without_balance` оба ряда скрываются полностью (`[]`)
- Несоответствие ТЗ: должны быть линейные диаграммы-оверлей без горизонтального расширения

## Desired Outcomes

- "Пополнение" и "Списание" отображаются как `type: 'line'` поверх waterfall-столбцов (без `stack`)
- Каждое значение X имеет один столбец (waterfall) + две линии (transfers)
- Оба режима (`with_balance` и `without_balance`) показывают линии
- В `with_balance`: линии включают padding-нули `[0, ...data, 0]` для выравнивания с метками Начало/Итого
- В `without_balance`: линии используют `transfersIn`/`transfersOut` напрямую без padding

## Health Metrics

- Основная waterfall-логика (чистый поток, кумулятив, drill-down по категориям) не меняется
- Tooltip остаётся как есть (уже показывает Пополнение/Списание текстом)
- Смещение `dataIndex` (+1 только в `with_balance`) сохраняется

## Strategic Context

- Interacts with: `analytics.html` → `updateWaterfallChart()`, backend `/api/v1/analytics/waterfall`
- Backend уже возвращает `transfers_in`/`transfers_out` во всех режимах — изменения backend не нужны
- Priority trade-off: скорость (срочно, несоответствие ТЗ)

## Constraints

### Steering (behavioral guidance)

- Цвета сохранить: Пополнение `#60a5fa`, Списание `#fbbf24`
- Легенда не меняется
- Только `analytics.html`, series-блок в `updateWaterfallChart`

### Hard (architectural enforcement)

- Backend не трогать без явного согласования
- Tooltip formatter не менять
- `dataIndex` offset-логика (±1 для `with_balance`) не трогать

## Autonomy Zones

- Full autonomy (reversible, low risk): изменение `type: 'bar'` → `type: 'line'`, удаление `stack: 'flow'`, добавление серий в `without_balance`
- Proposal-first (needs approval): любые изменения backend
- No autonomy (human only): изменения tooltip formatter, drill-down логики

## Stop Rules

- Halt if: изменения затрагивают tooltip formatter или drill-down click handler
- Escalate if: backend нужно менять для корректных данных
- Done when: в обоих режимах (`with_balance` / `without_balance`) Списание и Пополнение отображаются линиями поверх столбцов без горизонтального расширения
