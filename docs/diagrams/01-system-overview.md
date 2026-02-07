# System Architecture Overview

**Type**: C4 Context Diagram
**Purpose**: High-level view of Family Budget system components and external integrations
**Last Updated**: 2026-02-07

## System Context

```mermaid
graph TB
    subgraph "External Actors"
        User([User<br>Web Browser])
        TelegramUser([User<br>Telegram App])
        Bank([Bank Systems<br>CSV Exports])
    end

    subgraph "Family Budget System"
        subgraph "Frontend Layer"
            PWA[Progressive Web App<br>HTMX + Tailwind + DaisyUI]
            SW[Service Worker<br>Offline Caching]
            Dexie[Dexie.js<br>IndexedDB Storage]
        end

        subgraph "Backend Layer"
            API[FastAPI Backend<br>REST API + WebSocket]
            Auth[Authentication Service<br>JWT + OAuth + WebAuthn]
            Bot[Telegram Bot<br>python-telegram-bot]
            Scheduler[APScheduler<br>Recurring Tasks]
        end

        subgraph "Data Layer"
            PG[(PostgreSQL 16<br>39 Tables + Partitions)]
            Redis[(Redis<br>Pub/Sub + Session)]
        end

        subgraph "Infrastructure"
            Docker[Docker Compose<br>5 Services]
            Nginx[Nginx<br>Reverse Proxy]
            Backup[Backup System<br>Automated Snapshots]
        end
    end

    subgraph "External Services"
        TelegramAPI[Telegram Bot API<br>OAuth + Messaging]
        WebPush[Web Push Service<br>VAPID Notifications]
        GitHub[GitHub Registry<br>ghcr.io Images]
    end

    %% User interactions
    User -->|HTTPS| Nginx
    Nginx -->|Proxy| PWA
    PWA -->|REST API| API
    PWA -->|WebSocket| API
    PWA -->|Offline| SW
    SW -->|Cache| Dexie

    TelegramUser -->|Telegram| TelegramAPI
    TelegramAPI -->|Webhook| Bot
    Bot -->|API Calls| API

    %% Backend interactions
    API -->|Auth| Auth
    API -->|SQL| PG
    API -->|Pub/Sub| Redis
    API -->|Push| WebPush
    Bot -->|SQL| PG
    Scheduler -->|Cron| API

    %% Data flows
    Bank -->|CSV Upload| User
    User -->|Import| API
    API -->|Backup| Backup
    Backup -->|Store| PG

    %% Infrastructure
    Docker -.->|Container| API
    Docker -.->|Container| Bot
    Docker -.->|Container| PG
    Docker -.->|Container| Redis
    Docker -.->|Container| Nginx
    GitHub -->|Pull Images| Docker

    %% Styling
    classDef external fill:#4A90E2,stroke:#1565C0,color:#fff
    classDef frontend fill:#7CB342,stroke:#558B2F,color:#fff
    classDef backend fill:#FF9800,stroke:#E65100,color:#fff
    classDef data fill:#9C27B0,stroke:#6A1B9A,color:#fff
    classDef infra fill:#607D8B,stroke:#37474F,color:#fff

    class User,TelegramUser,Bank,TelegramAPI,WebPush,GitHub external
    class PWA,SW,Dexie frontend
    class API,Auth,Bot,Scheduler backend
    class PG,Redis data
    class Docker,Nginx,Backup infra
```

## Component Descriptions

### Frontend Layer
- **Progressive Web App**: HTMX-based SPA with Tailwind CSS + DaisyUI styling
- **Service Worker**: Offline-first caching strategy (cache-first for static, network-first for API)
- **Dexie.js**: IndexedDB wrapper for offline data storage and sync queue

### Backend Layer
- **FastAPI Backend**: Async REST API + WebSocket server (Python 3.11)
- **Authentication Service**: Multi-method auth (Telegram OAuth, Email+Password+2FA, WebAuthn)
- **Telegram Bot**: Command-based bot with Web Apps integration
- **APScheduler**: Daily recurring payment processing and cleanup tasks

### Data Layer
- **PostgreSQL 16**: 39 tables with Star Schema, SCD Type 2 history, 96 monthly partitions
- **Redis**: Pub/Sub for WebSocket broadcasting + session storage

### Infrastructure
- **Docker Compose**: 5 containerized services (app, bot, postgres, redis, nginx)
- **Nginx**: Reverse proxy with SSL termination and static file serving
- **Backup System**: Automated PostgreSQL snapshots with retention policy

## Communication Protocols

| Protocol | Usage | Port |
|----------|-------|------|
| HTTPS | User → Nginx → PWA | 443 |
| WebSocket | PWA ↔ API (real-time updates) | 443/ws |
| HTTP/2 | API ↔ PostgreSQL | 5432 |
| Redis Protocol | API ↔ Redis | 6379 |
| Telegram Bot API | Bot ↔ Telegram | HTTPS |
| Web Push Protocol | API → User Browser | HTTPS |

## Data Flows

### Primary Flows
1. **Transaction Creation**: User → PWA → API → PostgreSQL → Redis Pub/Sub → WebSocket → All Clients
2. **Offline Sync**: Dexie.js Queue → Sync Manager → API → Conflict Resolution → PostgreSQL
3. **Telegram Bot**: User → Telegram → Bot → API → PostgreSQL → Response
4. **Recurring Payments**: Scheduler → API → PostgreSQL → Notifications

## Security Layers

- **Authentication**: JWT tokens (7 days access + 30 days refresh) with rotation
- **Authorization**: User/Family/Admin roles with row-level security
- **Rate Limiting**: 5 attempts/minute per endpoint
- **Partition Pruning**: Mandatory fact_date filter for queries
- **HTTPS Only**: All external communication encrypted

## Scalability Considerations

- **Horizontal Scaling**: Stateless API allows multiple instances behind load balancer
- **Database Partitioning**: 96 monthly partitions reduce query cost
- **Redis Caching**: Session and frequently accessed data cached
- **Offline-First**: Reduces server load with client-side caching
- **WebSocket Fanout**: Redis Pub/Sub enables multi-instance WebSocket broadcasting

## References

- [Authentication Architecture](../architecture/core/authentication.md)
- [Database Schema](../architecture/backend/database/)
- [Offline Architecture](09-offline-architecture.md)
- [CI/CD Pipeline](07-cicd-pipeline.md)

---

**Version**: 11.4.4
**Created**: 2026-02-07
