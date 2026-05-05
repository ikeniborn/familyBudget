---
wiki_sources: ["docs/architecture/core/build-system.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["CI/CD", "incremental-build", "cache-busting"]
aliases: ["Incremental Builds", "Hash-Based Rebuild"]
---

# Incremental Build

Паттерн сборки фронтенда, при котором пересобираются только те JS-бандлы, исходные файлы которых изменились. Обнаружение изменений основано на MD5-хешировании входного файла. Введён в v11.1.0.

## Основные характеристики

- **41 bundle** обрабатывается `build-all.js`
- При изменении 1 файла: 0.5–2 с (против 13–17 с при полной сборке)
- Переменная `FORCE_REBUILD=true` отключает incremental mode

### Алгоритм

```javascript
// 1. Вычислить MD5 входного файла
function getFileHash(filepath) {
  return crypto.createHash('md5').update(fs.readFileSync(filepath)).digest('hex');
}

// 2. Сравнить с сохранённым хешем
function shouldRebuild(build) {
  const currentHash = getFileHash(build.input);
  const previousHash = fs.readFileSync(`.build-cache/${build.name}.hash`);
  return currentHash !== previousHash;
}

// 3. Собрать только изменённые бандлы
const toBuild = builds.filter(shouldRebuild);
for (const build of toBuild) {
  await runBuild(build);
  saveHash(build); // сохранить новый хеш
}
```

### Кеш в GitHub Actions

```yaml
- uses: actions/cache@v4
  with:
    path: |
      node_modules
      .vite
      .build-cache
    key: ${{ runner.os }}-build-${{ hashFiles('package-lock.json', 'config/vite.config*.ts', 'build-all.js') }}
```

**Ключ кеша инвалидируется** при изменении зависимостей, Vite-конфига или логики сборки. При изменении только `.ts`-файлов — кеш валиден.

### Производительность

| Сценарий | Время |
|----------|-------|
| Полная сборка (холодная) | 13–17 с |
| 1 файл изменён | 0.5–2 с |
| 5 файлов изменено | 2–5 с |
| CI warm (cache hit) | 8–12 с |
| CI warm + 1 файл | 10–15 с |

## Важное ограничение

`.build-cache` хранит хеш только **entry-point** файла бандла. Если изменился импортируемый модуль (не entry-point), incremental build его не обнаружит. Для таких случаев: `FORCE_REBUILD=true npm run build`.

## Связанные концепции

- [[registry-first]]
- [[cache-busting]]
