# Family Budget - Карта зависимостей проекта

## Обзор архитектуры

Family Budget представляет собой микросервисную систему управления семейным бюджетом с четким разделением компонентов и зависимостей.

## Визуальная карта зависимостей

```mermaid
graph TB
    %% Основной проект
    FB[Family Budget Project<br/>Production v2025.01]
    
    %% Фронтенд слой
    FE[Frontend<br/>React 19 + TypeScript]
    FE_COMP[React Components]
    FE_STORES[Zustand Stores]
    FE_SERVICES[Frontend Services]
    
    %% Бэкенд слой
    BE[Backend API<br/>Node.js + Express]
    BE_SERVICES[API Services]
    BE_MW[Middleware]
    
    %% Инфраструктура
    DB[(PostgreSQL 13<br/>Partitioned Tables)]
    REDIS[(Redis 7<br/>Session Cache)]
    TRAEFIK[Traefik Proxy<br/>SSL/Routing]
    
    %% ORM и утилиты
    PRISMA[Prisma ORM<br/>Type-safe queries]
    
    %% Внешние библиотеки Frontend
    REACT_LIBS[React Libraries<br/>Router/Hook Form/Table]
    UI_LIBS[UI Libraries<br/>shadcn/Radix/Tailwind]
    CHART_LIBS[Recharts<br/>Data Visualization]
    
    %% Тестирование
    TEST[Testing Framework<br/>Jest/Playwright/RTL]
    
    %% Связи основные
    FB --> FE
    FB --> BE
    FB --> DB
    FB --> REDIS
    FB --> TRAEFIK
    
    %% Frontend зависимости
    FE --> FE_COMP
    FE --> FE_STORES
    FE --> FE_SERVICES
    FE --> REACT_LIBS
    FE --> UI_LIBS
    FE --> CHART_LIBS
    FE_SERVICES --> BE
    
    %% Backend зависимости
    BE --> BE_SERVICES
    BE --> BE_MW
    BE --> PRISMA
    BE_SERVICES --> PRISMA
    PRISMA --> DB
    BE --> REDIS
    
    %% Traefik маршрутизация
    TRAEFIK --> FE
    TRAEFIK --> BE
    
    %% Тестирование
    TEST --> FE
    TEST --> BE
    
    %% Стилизация
    style FB fill:#f9f,stroke:#333,stroke-width:4px
    style FE fill:#61dafb,stroke:#333,stroke-width:2px
    style BE fill:#68a063,stroke:#333,stroke-width:2px
    style DB fill:#336791,stroke:#333,stroke-width:2px
    style REDIS fill:#dc382d,stroke:#333,stroke-width:2px
    style TRAEFIK fill:#00a8e1,stroke:#333,stroke-width:2px
```

## Детальная карта зависимостей

### 1. Frontend зависимости

```mermaid
graph LR
    subgraph "Frontend Dependencies"
        VITE[Vite 7.0<br/>Build Tool]
        REACT[React 19]
        TS[TypeScript 5.8]
        
        subgraph "State Management"
            ZUSTAND[Zustand 5.0]
            RHF[React Hook Form 7.60]
        end
        
        subgraph "UI Components"
            SHADCN[shadcn/ui]
            RADIX[Radix UI]
            TAILWIND[TailwindCSS]
        end
        
        subgraph "Data & Routing"
            ROUTER[React Router 7]
            TABLE[TanStack Table 8]
            RECHARTS[Recharts 3.1]
            AXIOS[Axios 1.10]
        end
        
        VITE --> REACT
        REACT --> TS
        REACT --> ZUSTAND
        REACT --> RHF
        REACT --> SHADCN
        SHADCN --> RADIX
        SHADCN --> TAILWIND
        REACT --> ROUTER
        REACT --> TABLE
        REACT --> RECHARTS
        REACT --> AXIOS
    end
```

### 2. Backend зависимости

```mermaid
graph LR
    subgraph "Backend Dependencies"
        NODE[Node.js]
        EXPRESS[Express 4.21]
        TS_BE[TypeScript 5.8]
        
        subgraph "Database"
            PRISMA_BE[Prisma 6.11]
            PG[PostgreSQL Driver]
        end
        
        subgraph "Security"
            HELMET[Helmet 8.1]
            CORS[CORS 2.8]
            BCRYPT[bcryptjs 3.0]
            SESSION[express-session]
        end
        
        subgraph "Utils"
            COMPRESSION[Compression]
            MORGAN[Morgan Logger]
            DOTENV[dotenv]
        end
        
        NODE --> EXPRESS
        EXPRESS --> TS_BE
        EXPRESS --> PRISMA_BE
        PRISMA_BE --> PG
        EXPRESS --> HELMET
        EXPRESS --> CORS
        EXPRESS --> BCRYPT
        EXPRESS --> SESSION
        EXPRESS --> COMPRESSION
        EXPRESS --> MORGAN
        NODE --> DOTENV
    end
```

### 3. Компонентная архитектура

```mermaid
graph TB
    subgraph "Component Architecture"
        APP[App.tsx<br/>Entry Point]
        
        subgraph "Pages"
            LOGIN[Login Page]
            DASHBOARD[Dashboard]
            BUDGET[Budget Page]
            FACT[Fact Page]
            PRODUCTS[Products Page]
            REPORTS[Reports Page]
            SETTINGS[Settings Page]
        end
        
        subgraph "Core Components"
            LAYOUT[Layout]
            AUTH_GUARD[AuthGuard]
            ERROR_BOUNDARY[ErrorBoundary]
        end
        
        subgraph "Feature Components"
            AUTH_COMP[Auth Components]
            BUDGET_COMP[Budget Components]
            FACT_COMP[Fact Components]
            PRODUCT_COMP[Product Components]
            REPORT_COMP[Report Components]
            REF_COMP[Reference Components]
        end
        
        subgraph "UI Components"
            COMMON_UI[Common UI]
            CHARTS_UI[Charts]
            FORMS_UI[Forms]
            TABLES_UI[Tables]
        end
        
        APP --> LAYOUT
        LAYOUT --> AUTH_GUARD
        AUTH_GUARD --> ERROR_BOUNDARY
        ERROR_BOUNDARY --> LOGIN
        ERROR_BOUNDARY --> DASHBOARD
        ERROR_BOUNDARY --> BUDGET
        ERROR_BOUNDARY --> FACT
        ERROR_BOUNDARY --> PRODUCTS
        ERROR_BOUNDARY --> REPORTS
        ERROR_BOUNDARY --> SETTINGS
        
        LOGIN --> AUTH_COMP
        BUDGET --> BUDGET_COMP
        FACT --> FACT_COMP
        PRODUCTS --> PRODUCT_COMP
        REPORTS --> REPORT_COMP
        SETTINGS --> REF_COMP
        
        AUTH_COMP --> COMMON_UI
        BUDGET_COMP --> FORMS_UI
        FACT_COMP --> TABLES_UI
        REPORT_COMP --> CHARTS_UI
    end
```

### 4. Сервисная архитектура

```mermaid
graph TB
    subgraph "Service Layer Architecture"
        BASE[BaseService<br/>Abstract Class]
        
        subgraph "Core Services"
            USER_SVC[UserService]
            REF_SVC[ReferenceDataService]
            REG_SVC[RegistryService]
            PROD_SVC[ProductService]
            REPORT_SVC[ReportService]
        end
        
        subgraph "Support Services"
            CACHE_SVC[CachedService]
            AUTH_SVC[AuthService]
        end
        
        subgraph "Data Layer"
            PRISMA_CLIENT[Prisma Client]
            REDIS_CLIENT[Redis Client]
        end
        
        BASE --> USER_SVC
        BASE --> REF_SVC
        BASE --> REG_SVC
        BASE --> PROD_SVC
        BASE --> REPORT_SVC
        
        CACHE_SVC --> BASE
        USER_SVC --> AUTH_SVC
        
        USER_SVC --> PRISMA_CLIENT
        REF_SVC --> PRISMA_CLIENT
        REG_SVC --> PRISMA_CLIENT
        PROD_SVC --> PRISMA_CLIENT
        REPORT_SVC --> PRISMA_CLIENT
        
        CACHE_SVC --> REDIS_CLIENT
        AUTH_SVC --> REDIS_CLIENT
    end
```

### 5. База данных - схема зависимостей

```mermaid
graph LR
    subgraph "Database Schema"
        subgraph "Dimensions"
            USER[t_d_user]
            PERIOD[t_d_period]
            FC[t_d_financial_center]
            CC[t_d_cost_center]
            NOM[t_d_nomenclature]
            RT[t_d_row_type]
        end
        
        subgraph "Facts"
            REG[t_f_registry<br/>Partitioned]
            PRICE[t_f_product_price]
        end
        
        subgraph "Products"
            PROD[t_d_product]
            PROD_NOM[t_l_product_nomenclature]
        end
        
        REG --> USER
        REG --> PERIOD
        REG --> FC
        REG --> CC
        REG --> NOM
        REG --> RT
        
        PRICE --> PROD
        PRICE --> USER
        
        PROD_NOM --> PROD
        PROD_NOM --> NOM
    end
```

## Технологические зависимости

### Frontend технологии
| Технология | Версия | Назначение |
|------------|--------|------------|
| React | 19.1.0 | UI фреймворк |
| TypeScript | 5.8.3 | Типизация |
| Vite | 7.0.0 | Сборщик |
| Zustand | 5.0.6 | State management |
| React Router | 7.6.3 | Маршрутизация |
| TanStack Table | 8.21.3 | Таблицы данных |
| Recharts | 3.1.0 | Графики |
| TailwindCSS | 3.4.17 | Стилизация |
| shadcn/ui | latest | UI компоненты |

### Backend технологии
| Технология | Версия | Назначение |
|------------|--------|------------|
| Node.js | 18+ | Runtime |
| Express | 4.21.2 | Web framework |
| Prisma | 6.11.1 | ORM |
| TypeScript | 5.8.3 | Типизация |
| bcryptjs | 3.0.2 | Хеширование |
| Helmet | 8.1.0 | Безопасность |
| express-session | 1.18.1 | Сессии |

### Инфраструктура
| Технология | Версия | Назначение |
|------------|--------|------------|
| PostgreSQL | 13 | База данных |
| Redis | 7-alpine | Кэш |
| Docker | latest | Контейнеризация |
| Docker Compose | latest | Оркестрация |
| Traefik | latest | Reverse proxy |
| Nginx | latest | Web server |

## Сетевая архитектура

```
Internet
    ↓
[Traefik :443/:80]
    ├─→ [Frontend :80] → Static files (Nginx)
    └─→ [Backend API :4000] → REST API
            ├─→ [PostgreSQL :5432] → Data storage
            └─→ [Redis :6379] → Session cache

Docker Network: app_network (10.5.0.0/24)
- Traefik: 10.5.0.1
- PostgreSQL: 10.5.0.2  
- Redis: 10.5.0.7
- Frontend: dynamic
- Backend API: dynamic
```

## NPM зависимости

### Frontend (91 packages)
- **Production**: 33 основных зависимостей
- **Development**: 36 dev зависимостей
- **Peer**: 22 peer зависимости

### Backend (36 packages)
- **Production**: 12 основных зависимостей
- **Development**: 13 dev зависимостей
- **Prisma generated**: 11 автогенерированных модулей

## Критические зависимости

⚠️ **Критические для работы системы:**
1. PostgreSQL - основное хранилище данных
2. Prisma ORM - управление схемой БД
3. Redis - хранение сессий
4. Traefik - SSL и маршрутизация

⚠️ **Важные для разработки:**
1. TypeScript - типобезопасность
2. Vite - сборка frontend
3. Jest/Playwright - тестирование
4. Docker Compose - локальная разработка

## Обновление зависимостей

Рекомендуемая частота обновления:
- **Security patches**: немедленно
- **Minor updates**: ежемесячно
- **Major updates**: квартально с тестированием

## Заключение

Проект Family Budget имеет хорошо структурированную архитектуру с четким разделением зависимостей. Микросервисный подход обеспечивает масштабируемость и поддерживаемость системы.

---
*Документ сгенерирован: 2025-08-21*
*Версия проекта: Production Ready (January 2025)*