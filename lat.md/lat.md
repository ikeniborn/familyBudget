This directory defines the high-level concepts, business logic, and architecture of this project using markdown. It is managed by [lat.md](https://www.npmjs.com/package/lat.md) — a tool that anchors source code to these definitions. Install the `lat` command with `npm i -g lat.md` and run `lat --help`.

## Index

Top-level navigation for all lat.md documentation sections in this project.

- [[architecture]] — system overview, components, deployment pipeline
- [[domain]] — budget domain: articles, facts, cost centers, financial centers
- [[database]] — star schema, SCD Type 1/2, Closure Table, partitioning
- [[auth]] — Telegram OAuth, Email+Password, WebAuthn, JWT, 2FA
- [[api]] — REST endpoints, WebSocket, sync protocol, import pipeline
- [[frontend]] — HTMX + Tailwind, TypeScript bundles, PWA
- [[realtime]] — WebSocket + Redis Pub/Sub, write-behind cache
- [[bot]] — Telegram bot commands, scheduled jobs, Web App auth
