# Dashboard API Integration Documentation

## Overview

This document describes the comprehensive dashboard integration that replaces static mock data with real-time API integration. The implementation provides a robust, performant, and user-friendly dashboard experience with full error handling and loading states.

## Architecture

### Dashboard Service (`dashboard.service.ts`)

The `DashboardService` class serves as the central integration point for all dashboard-related API calls, providing:

- **Centralized API Management**: Single service for all dashboard data operations
- **Type Safety**: Full TypeScript interfaces for all data structures
- **Error Handling**: Comprehensive error catching and user-friendly messages
- **Data Transformation**: API response transformation for UI consumption
- **Performance Optimization**: Efficient API call patterns and data caching

### Service Structure

```typescript
class DashboardService {
  // Core dashboard statistics
  async getDashboardStats(periodId?: number): Promise<DashboardStats>

  // Comprehensive dashboard data
  async getDashboardData(periodId?: number): Promise<DashboardData>

  // Category analysis for progress cards
  async getCategoryAnalysis(periodId?: number): Promise<CategoryAnalysisResponse[]>

  // Recent transactions from registry
  async getRecentTransactions(limit: number, periodId?: number): Promise<Registry[]>

  // Historical spending patterns
  async getSpendingTrends(months: number, nomenclatureId?: number): Promise<SpendingTrendsResponse>

  // Transformed summary for UI components
  async getDashboardSummary(periodId?: number): Promise<DashboardSummary>

  // Period-wise statistics
  async getPeriodStats(): Promise<PeriodStats[]>

  // Analytics data for charts
  async getAnalyticsData(periodId?: number): Promise<AnalyticsData>
}
```

## API Endpoints Integration

### 1. Dashboard Statistics (`/reports/dashboard-stats`)

**Purpose**: Core budget statistics for the main dashboard cards

**Request**:
```typescript
GET /api/reports/dashboard-stats?period_id=123
```

**Response**:
```typescript
interface DashboardStats {
  total_budget: number;           // Total planned budget amount
  total_actual: number;           // Total actual spending
  variance: number;               // Budget vs actual variance
  variance_percent: number | null; // Percentage variance
  budget_transactions: number;     // Number of budget entries
  actual_transactions: number;     // Number of actual transactions
  total_transactions: number;      // Total transaction count
  active_categories: number;       // Number of active categories
  period_id: number | null;       // Current period ID
}
```

**Integration**: Used for main dashboard statistics cards (Total Budget, Total Spent, Remaining)

### 2. Category Analysis (`/reports/category-analysis`)

**Purpose**: Category-wise breakdown for progress visualization

**Request**:
```typescript
GET /api/reports/category-analysis?period_id=123&financial_center_id=456&cost_center_id=789
```

**Response**:
```typescript
interface CategoryAnalysisResponse {
  nomenclature_id: number;        // Category ID
  nomenclature_name: string;      // Category name
  budget_amount: number;          // Planned budget for category
  actual_amount: number;          // Actual spending in category
  variance: number;               // Category variance
  variance_percent: number | null; // Percentage variance
  transaction_count: number;       // Number of transactions
}
```

**Integration**: Transformed into progress cards with color coding and over-budget indicators

### 3. Recent Transactions (`/registry/`)

**Purpose**: Latest user transactions for activity feed

**Request**:
```typescript
GET /api/registry/?limit=5&offset=0&filters[period_id]=123
```

**Response**:
```typescript
interface Registry {
  id: number;
  comment_description: string;
  cost_sum: number;
  row_type_id: number;           // 1=Plan, 2=Fact
  operation_dttm: string;
  nomenclature_name: string;
  financial_center_name: string;
  // ... other fields
}
```

**Integration**: Transformed into user-friendly transaction display with proper formatting

### 4. Dashboard Data (`/reports/dashboard`)

**Purpose**: Comprehensive dashboard overview with top categories

**Request**:
```typescript
GET /api/reports/dashboard?period_id=123
```

**Response**:
```typescript
interface DashboardData {
  total_income: number;
  total_expense: number;
  budget_utilization: number;
  top_categories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}
```

**Integration**: Used for overview analytics and category breakdowns

### 5. Spending Trends (`/reports/spending-trends`)

**Purpose**: Historical spending patterns for trend analysis

**Request**:
```typescript
GET /api/reports/spending-trends?months=6&nomenclature_id=123
```

**Response**:
```typescript
interface SpendingTrendsResponse {
  trends: Array<{
    period_id: number;
    period_name: string;
    period_date: string | null;
    budget_amount: number;
    actual_amount: number;
    variance: number;
  }>;
}
```

**Integration**: Powers historical trend charts and analytics

## Data Transformation Layer

### Dashboard Summary Transformation

The `getDashboardSummary()` method combines data from multiple endpoints to create a unified interface:

```typescript
interface DashboardSummary {
  totalBudget: number;              // From dashboard-stats
  totalSpent: number;               // From dashboard-stats
  remaining: number;                // Calculated: budget - spent
  categories: CategoryProgress[];    // From category-analysis
  recentTransactions: RecentTransaction[]; // From registry
}

interface CategoryProgress {
  id: number;
  name: string;
  budget: number;
  spent: number;
  color: string;                    // Auto-assigned color scheme
}

interface RecentTransaction {
  id: number;
  description: string;              // Generated from available data
  amount: number;                   // Formatted with sign convention
  date: string;                     // ISO date format
  category: string;
}
```

### Color Assignment System

Categories are automatically assigned colors from a predefined palette:

```typescript
const colors = [
  'bg-blue-500',    // Primary categories
  'bg-green-500',   // Secondary categories
  'bg-purple-500',  // Tertiary categories
  'bg-orange-500',  // Additional categories
  'bg-red-500',     // Over-budget warnings
  'bg-teal-500',    // Utility categories
  'bg-indigo-500',  // System categories
  'bg-pink-500'     // Special categories
];
```

## Error Handling Strategy

### Service-Level Error Handling

Each service method includes comprehensive error handling:

```typescript
try {
  const response = await api.get<DashboardStats>(`${this.endpoint}/dashboard-stats`, { params });
  return response;
} catch (error: any) {
  throw new Error(error.message || 'Ошибка при получении статистики дашборда');
}
```

### Component-Level Error Handling

Components implement graceful error recovery:

```typescript
// Loading states
let isLoading = true;
let error: string | null = null;

// Error recovery
const handleRetry = async () => {
  error = null;
  isLoading = true;
  await loadDashboardData();
};
```

### User Experience During Errors

- **Loading indicators**: Skeleton components during data loading
- **Error messages**: Clear, actionable error descriptions
- **Retry functionality**: Users can retry failed operations
- **Graceful degradation**: Partial data display when some APIs fail

## Performance Optimizations

### Efficient API Calling

- **Batch requests**: Multiple related data requests in parallel
- **Parameter optimization**: Only request necessary data
- **Response caching**: Client-side caching for frequently accessed data
- **Lazy loading**: Load detailed data only when needed

### Data Processing Optimization

```typescript
// Efficient data transformation
const categories: CategoryProgress[] = categoryAnalysis
  .slice(0, 4)  // Limit to top 4 for performance
  .map((cat, index) => ({
    id: cat.nomenclature_id,
    name: cat.nomenclature_name,
    budget: cat.budget_amount,
    spent: cat.actual_amount,
    color: colors[index % colors.length]
  }));
```

### Loading State Management

Smart loading state management prevents UI flicker:

```typescript
// Coordinated loading states
const loadDashboardData = async () => {
  isLoading = true;
  error = null;

  try {
    // Parallel API calls for performance
    const [stats, categories, transactions] = await Promise.all([
      dashboardService.getDashboardStats(currentPeriod),
      dashboardService.getCategoryAnalysis(currentPeriod),
      dashboardService.getRecentTransactions(4, currentPeriod)
    ]);

    // Update UI in single batch
    dashboardData = transformData(stats, categories, transactions);
  } catch (err) {
    error = err.message;
  } finally {
    isLoading = false;
  }
};
```

## Testing Strategy

### Service Testing (`dashboard.service.test.ts`)

- **Method coverage**: All service methods tested
- **Parameter handling**: Various parameter combinations
- **Error scenarios**: Network failures, API errors, invalid responses
- **Data transformation**: Accuracy of data transformation logic
- **Edge cases**: Empty data, null values, over-budget scenarios

### Component Testing (`dashboard.component.test.ts`)

- **Rendering**: Proper component rendering with various data states
- **Loading states**: Loading indicators and transitions
- **Error handling**: Error display and retry functionality
- **User interactions**: Navigation and action handling
- **Responsive design**: Multi-device compatibility

### Integration Testing (`test_dashboard_api.py`)

- **API accuracy**: Correct data retrieval and calculation
- **Security**: User data isolation and access control
- **Performance**: Response times and data limits
- **Consistency**: Cross-endpoint data consistency

### End-to-End Testing (`dashboard.e2e.test.ts`)

- **User workflows**: Complete dashboard usage scenarios
- **Cross-browser compatibility**: Multiple browser testing
- **Performance benchmarking**: Load times and responsiveness
- **Accessibility**: Screen reader and keyboard navigation

## Migration from Mock Data

### Removed Mock Components

1. **Static dashboard data** - Replaced with API calls
2. **Hardcoded categories** - Now dynamically loaded from database
3. **Fake transactions** - Real transaction data from registry
4. **Mock calculations** - Server-side calculations for accuracy

### Database Cleanup

- Removed test/mock data entries from database
- Cleaned up development artifacts
- Reset auto-increment sequences
- Validated data integrity post-cleanup

### Benefits of Real Data Integration

1. **Accuracy**: Real-time data reflects actual user budget state
2. **Performance**: Optimized API calls reduce unnecessary data transfer
3. **Reliability**: Robust error handling and retry mechanisms
4. **Maintainability**: Single source of truth for dashboard data
5. **Testability**: Comprehensive test coverage ensures quality

## Development Guidelines

### Adding New Dashboard Features

1. **Extend Service**: Add new methods to `DashboardService`
2. **Define Interfaces**: Create TypeScript interfaces for new data types
3. **Error Handling**: Implement comprehensive error catching
4. **Testing**: Add tests for new functionality
5. **Documentation**: Update this documentation

### API Integration Best Practices

1. **Type Safety**: Always define TypeScript interfaces
2. **Error Boundaries**: Wrap API calls in try-catch blocks
3. **User Feedback**: Provide loading states and error messages
4. **Performance**: Optimize API calls and data processing
5. **Testing**: Test all API integration scenarios

### Code Quality Standards

- **ESLint compliance**: Follow project linting rules
- **TypeScript strict mode**: No `any` types without justification
- **Documentation**: Document complex logic and APIs
- **Testing**: Maintain high test coverage
- **Performance**: Profile and optimize critical paths

## Conclusion

The dashboard API integration provides a robust, performant, and maintainable solution for real-time budget data display. The comprehensive testing suite ensures reliability, while the service architecture provides flexibility for future enhancements.

The migration from mock data to real API integration significantly improves the user experience by providing accurate, up-to-date budget information with proper error handling and loading states.