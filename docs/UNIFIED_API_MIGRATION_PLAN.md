# Unified API Migration Plan - Node.js Consolidation

## Overview

This document outlines the migration strategy from the current dual-API architecture (Node.js BFF + Python FastAPI) to a unified Node.js API with TypeScript.

## Current Architecture Analysis

### Frontend API (Node.js BFF)
- **Purpose**: Authentication proxy, session management
- **Technology**: Express.js + TypeScript
- **Responsibilities**: 
  - Telegram OAuth handling
  - Session management
  - Request proxying to Python API
  - User context validation

### Backend API (Python FastAPI)
- **Purpose**: Database operations, business logic
- **Technology**: FastAPI + asyncpg
- **Responsibilities**:
  - Database CRUD operations
  - Report generation
  - Product management
  - Data validation

### Problems with Current Architecture
1. **Network overhead**: Extra HTTP hop between APIs
2. **Complexity**: Two different technology stacks
3. **Maintenance**: Duplicate error handling, logging
4. **Development velocity**: Changes require updates in both APIs
5. **Deployment**: Multiple containers and dependencies

## Migration Strategy

### Phase 1: ORM Selection and Setup (1-2 weeks)

#### ORM Comparison: Prisma vs TypeORM

**Prisma Advantages:**
- Type-safe database client
- Excellent TypeScript integration
- Auto-generated types from schema
- Powerful migration system
- Great developer experience
- Built-in connection pooling

**TypeORM Advantages:**
- More mature ecosystem
- Decorator-based models
- Flexible query builder
- Better for complex queries
- Active Record pattern support

**Recommendation: Prisma**
- Better TypeScript integration
- Simpler migration from Python models
- More suitable for our PostgreSQL partitioned tables
- Better developer experience

#### Setup Steps
1. Initialize Prisma in frontend-api project
2. Create schema from existing PostgreSQL structure
3. Generate client and types
4. Test connection and basic operations

### Phase 2: Database Layer Migration (2-3 weeks)

#### 2.1 Schema Definition
```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           Int      @id @default(autoincrement()) @map("user_id")
  userName     String   @map("user_name")
  userEmail    String?  @map("user_email")
  telegramId   String   @unique @map("user_telegram_id")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_dttm")
  
  registries   Registry[]
  productPrices ProductPrice[]
  
  @@map("t_d_user")
}

model Period {
  id         Int      @id @default(autoincrement()) @map("period_id")
  date       DateTime @map("period_dt")
  ruName     String   @map("period_ru_name")
  
  registries Registry[]
  
  @@map("t_d_period")
}

model FinancialCenter {
  id   Int    @id @default(autoincrement()) @map("financial_center_id")
  name String @map("financial_center_name")
  
  registries Registry[]
  
  @@map("t_d_financial_center")
}

model CostCenter {
  id   Int    @id @default(autoincrement()) @map("cost_center_id")
  name String @map("cost_center_name")
  
  registries Registry[]
  
  @@map("t_d_cost_center")
}

model Nomenclature {
  id          Int     @id @default(autoincrement()) @map("nomenclature_id")
  name        String  @map("nomenclature_name")
  accountName String  @map("account_name")
  billName    String  @map("bill_name")
  operation   String  @map("operation_name")
  isBudget    Boolean @map("is_budget")
  isFact      Boolean @map("is_fact")
  
  registries  Registry[]
  products    ProductNomenclature[]
  
  @@map("t_d_nomenclature")
}

model RowType {
  id   Int    @id @default(autoincrement()) @map("row_type_id")
  name String @map("row_type_name")
  
  registries Registry[]
  
  @@map("t_d_row_type")
}

model Registry {
  id                 Int             @id @default(autoincrement()) @map("registry_id")
  operationDate      DateTime        @map("operation_dttm")
  userId             Int             @map("user_id")
  periodId           Int             @map("period_id")
  financialCenterId  Int             @map("financial_center_id")
  costCenterId       Int             @map("cost_center_id")
  nomenclatureId     Int             @map("nomenclature_id")
  rowTypeId          Int             @map("row_type_id")
  costSum            Decimal         @map("cost_sum")
  comment            String?         @map("comment_description")
  
  user               User            @relation(fields: [userId], references: [id])
  period             Period          @relation(fields: [periodId], references: [id])
  financialCenter    FinancialCenter @relation(fields: [financialCenterId], references: [id])
  costCenter         CostCenter      @relation(fields: [costCenterId], references: [id])
  nomenclature       Nomenclature    @relation(fields: [nomenclatureId], references: [id])
  rowType            RowType         @relation(fields: [rowTypeId], references: [id])
  
  @@map("t_f_registry")
}

model Product {
  id          Int       @id @default(autoincrement()) @map("product_id")
  name        String    @map("product_name")
  category    String?   @map("category_name")
  unit        String?   @map("unit_measure")
  barcode     String?   @map("barcode")
  description String?
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_dttm")
  updatedAt   DateTime  @updatedAt @map("updated_dttm")
  
  prices        ProductPrice[]
  nomenclatures ProductNomenclature[]
  
  @@map("t_d_product")
}

model ProductPrice {
  id           Int      @id @default(autoincrement()) @map("price_id")
  productId    Int      @map("product_id")
  supplierName String?  @map("supplier_name")
  priceValue   Decimal  @map("price_value")
  priceDate    DateTime @map("price_date")
  userId       Int      @map("user_id")
  createdAt    DateTime @default(now()) @map("created_dttm")
  
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id])
  
  @@map("t_f_product_price")
}

model ProductNomenclature {
  productId      Int @map("product_id")
  nomenclatureId Int @map("nomenclature_id")
  
  product      Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  nomenclature Nomenclature @relation(fields: [nomenclatureId], references: [id], onDelete: Cascade)
  
  @@id([productId, nomenclatureId])
  @@map("t_l_product_nomenclature")
}
```

#### 2.2 Service Layer Architecture
```typescript
// services/BaseService.ts
export abstract class BaseService {
  constructor(protected prisma: PrismaClient) {}
  
  protected async withUser<T>(
    userId: string,
    operation: (userId: number) => Promise<T>
  ): Promise<T> {
    return operation(parseInt(userId));
  }
}

// services/UserService.ts
export class UserService extends BaseService {
  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { registries: true }
    });
  }
  
  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { telegramId }
    });
  }
}

// services/RegistryService.ts
export class RegistryService extends BaseService {
  async create(data: CreateRegistryInput, userId: string): Promise<Registry> {
    return this.withUser(userId, async (userIdInt) => {
      return this.prisma.registry.create({
        data: {
          ...data,
          userId: userIdInt
        },
        include: {
          period: true,
          financialCenter: true,
          costCenter: true,
          nomenclature: true,
          rowType: true
        }
      });
    });
  }
  
  async getLastRows(
    userId: string,
    rowTypeId?: number,
    limit: number = 5
  ): Promise<Registry[]> {
    return this.withUser(userId, async (userIdInt) => {
      return this.prisma.registry.findMany({
        where: {
          userId: userIdInt,
          ...(rowTypeId && { rowTypeId })
        },
        include: {
          period: true,
          financialCenter: true,
          costCenter: true,
          nomenclature: true
        },
        orderBy: { id: 'desc' },
        take: limit
      });
    });
  }
}
```

### Phase 3: API Endpoint Migration (3-4 weeks)

#### 3.1 Migration Priority
1. **Reference Data** (Week 1)
   - Users, Periods, Financial Centers
   - Cost Centers, Nomenclatures, Row Types
   - Simple GET operations

2. **Core Operations** (Week 2)
   - Registry CRUD operations
   - User-specific data filtering
   - Basic validation

3. **Products Module** (Week 3)
   - Product CRUD operations
   - Price management
   - CSV import functionality

4. **Reports and Analytics** (Week 4)
   - Report generation
   - Complex aggregations
   - Performance optimization

#### 3.2 Endpoint Implementation Strategy

**Step 1: Create Unified Routes**
```typescript
// routes/api/index.ts
import express from 'express';
import userRoutes from './users';
import registryRoutes from './registry';
import productRoutes from './products';
import reportRoutes from './reports';

const router = express.Router();

router.use('/users', userRoutes);
router.use('/registry', registryRoutes);
router.use('/products', productRoutes);
router.use('/reports', reportRoutes);

export default router;
```

**Step 2: Implement Services with Caching**
```typescript
// services/CachedService.ts
export class CachedService extends BaseService {
  constructor(
    protected prisma: PrismaClient,
    protected cache: RedisClient
  ) {
    super(prisma);
  }
  
  protected async getCached<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 3600,
    userId?: string
  ): Promise<T> {
    const cacheKey = userId ? `user:${userId}:${key}` : key;
    
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached as T;
    
    const result = await fetcher();
    await this.cache.set(cacheKey, result, ttl);
    return result;
  }
}
```

### Phase 4: Feature Parity and Testing (2-3 weeks)

#### 4.1 Feature Comparison Matrix
| Feature | Python API | Node.js API | Status |
|---------|------------|-------------|--------|
| User Management | ✅ | 🔄 | In Progress |
| Registry CRUD | ✅ | 🔄 | In Progress |
| Products API | ✅ | ⏳ | Planned |
| Reports | ✅ | ⏳ | Planned |
| Caching | ✅ | ⏳ | Planned |
| Security | ✅ | ⏳ | Planned |

#### 4.2 Testing Strategy
1. **Unit Tests**: Each service and route
2. **Integration Tests**: Database operations
3. **Performance Tests**: Response times vs Python API
4. **Security Tests**: SQL injection, user isolation
5. **Load Tests**: Concurrent users, cache performance

### Phase 5: Gradual Cutover (1-2 weeks)

#### 5.1 Feature Flags Implementation
```typescript
// config/featureFlags.ts
export const FEATURE_FLAGS = {
  USE_NODE_API_USERS: process.env.NODE_API_USERS === 'true',
  USE_NODE_API_REGISTRY: process.env.NODE_API_REGISTRY === 'true',
  USE_NODE_API_PRODUCTS: process.env.NODE_API_PRODUCTS === 'true',
  USE_NODE_API_REPORTS: process.env.NODE_API_REPORTS === 'true',
};

// middleware/apiRouter.ts
export const apiRouter = (req: Request, res: Response, next: NextFunction) => {
  const feature = getFeatureForEndpoint(req.path);
  
  if (FEATURE_FLAGS[feature]) {
    // Route to Node.js implementation
    return nodeApiHandler(req, res, next);
  } else {
    // Route to Python API
    return pythonApiProxy(req, res, next);
  }
};
```

#### 5.2 Monitoring and Rollback
- Real-time error rate monitoring
- Performance comparison dashboards
- Automatic rollback triggers
- User experience metrics

### Phase 6: Python API Decommission (1 week)

#### 6.1 Validation Checklist
- [ ] All endpoints migrated and tested
- [ ] Performance meets or exceeds Python API
- [ ] Security tests pass
- [ ] User acceptance testing complete
- [ ] Monitoring and alerting configured

#### 6.2 Decommission Steps
1. Remove Python API from docker-compose
2. Remove Python dependencies
3. Update documentation
4. Remove feature flags
5. Clean up unused code

## Implementation Timeline

### Week 1-2: Foundation
- [x] Create migration plan
- [ ] Setup Prisma and database schema
- [ ] Create service architecture
- [ ] Setup testing framework

### Week 3-4: Reference Data
- [ ] Migrate users, periods, centers
- [ ] Implement caching layer
- [ ] Add comprehensive tests
- [ ] Performance benchmarking

### Week 5-6: Core Operations
- [ ] Registry CRUD operations
- [ ] User isolation and security
- [ ] Error handling and validation
- [ ] Integration testing

### Week 7-8: Products and Reports
- [ ] Product management endpoints
- [ ] Report generation system
- [ ] Complex query optimization
- [ ] Load testing

### Week 9-10: Gradual Cutover
- [ ] Feature flags implementation
- [ ] A/B testing setup
- [ ] Monitoring and alerting
- [ ] User training and documentation

### Week 11-12: Finalization
- [ ] Complete migration
- [ ] Python API decommission
- [ ] Performance optimization
- [ ] Documentation updates

## Risk Management

### Technical Risks
1. **Performance Degradation**
   - *Mitigation*: Comprehensive benchmarking, query optimization
2. **Data Consistency Issues**
   - *Mitigation*: Transaction management, thorough testing
3. **Security Vulnerabilities**
   - *Mitigation*: Security audits, penetration testing

### Business Risks
1. **User Experience Impact**
   - *Mitigation*: Gradual rollout, rollback procedures
2. **Development Velocity**
   - *Mitigation*: Feature flags, parallel development

## Success Metrics

### Performance
- API response time: ≤ Python API baseline
- Database query efficiency: ≥ 95% of Python performance
- Cache hit ratio: ≥ 80%

### Reliability
- Uptime: ≥ 99.9%
- Error rate: ≤ 0.1%
- Data consistency: 100%

### Development Velocity
- Feature delivery: 20% faster with unified API
- Bug resolution: 30% faster with single codebase
- Code maintenance: 40% reduction in complexity

## Post-Migration Benefits

### Immediate Benefits
- Simplified architecture (one API instead of two)
- Reduced network latency (no proxy layer)
- Unified technology stack (TypeScript throughout)
- Simplified deployment and monitoring

### Long-term Benefits
- Faster feature development
- Easier debugging and troubleshooting
- Better code reusability
- Simplified team onboarding
- Lower infrastructure costs

## Conclusion

The migration to a unified Node.js API will significantly simplify the architecture while maintaining all current functionality and performance. The gradual migration approach minimizes risk while ensuring business continuity.