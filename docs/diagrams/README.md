# Family Budget Architecture Diagrams

Comprehensive set of Mermaid diagrams visualizing the Family Budget system architecture at all levels.

## Navigation Index

### System Level
- [**01. System Overview**](01-system-overview.md) - C4 Context Diagram показывающий основные компоненты системы и внешние интеграции
- [**07. CI/CD Pipeline**](07-cicd-pipeline.md) - GitHub Actions workflow от git push до production deployment

### Security & Authentication
- [**02. Authentication Flows**](02-authentication-flows.md) - Telegram OAuth, Email+Password+2FA, JWT, WebAuthn flows
- [**10. Security Architecture**](10-security-architecture.md) - Middleware chain, rate limiting, partition security

### Database & Data
- [**03. Database Schema**](03-database-schema.md) - ERD с 39 таблицами, Star Schema, Closure Table, SCD Type 2
- [**04. Data Flows**](04-data-flows.md) - Transaction creation, offline sync, transfers, WebSocket broadcasting

### Frontend & Backend
- [**05. Frontend Architecture**](05-frontend-architecture.md) - Components, modals, Service Worker, Dexie.js, multi-tab coordination
- [**06. Backend API**](06-backend-api.md) - REST endpoints, middleware, security layers, integrations
- [**09. Offline Architecture**](09-offline-architecture.md) - NetworkDetector, Dexie.js sync, conflict resolution

### Features
- [**08. Features Integration Map**](08-features-map.md) - Transfers, Recurring Plans, Shopping Lists, Notifications, CSV Import, Backups

## Diagram Conventions

### Colors
- **Blue** (#4A90E2): External actors/systems
- **Green** (#7CB342): Core application components
- **Orange** (#FF9800): Data storage/persistence
- **Purple** (#9C27B0): Real-time/async components
- **Red** (#E53935): Security/authentication layers

### Symbols
- **Rectangle**: Service/component
- **Cylinder**: Database/storage
- **Cloud**: External service
- **Diamond**: Decision point
- **Hexagon**: Security check

## How to Use

1. **Start with System Overview** to understand high-level architecture
2. **Dive into specific areas** using topic-specific diagrams
3. **Cross-reference with docs** - each diagram links to detailed architecture documentation

## Rendering

All diagrams use [Mermaid](https://mermaid.js.org/) syntax and render automatically in:
- GitHub (native support)
- VS Code (with Mermaid extension)
- GitLab, Notion, Obsidian, etc.

## Maintenance

When updating diagrams:
- Verify Mermaid syntax with preview
- Keep max 50 nodes per diagram (split if needed)
- Update cross-references in architecture docs
- Include version/date in diagram notes

---

**Last Updated**: 2026-02-07
**Version**: 11.4.4
