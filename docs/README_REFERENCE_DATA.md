# Reference Data Management Module

## Overview

The Reference Data Management module is a comprehensive system for managing core reference entities in the Family Budget application. It provides a unified interface for managing periods, financial centers, cost centers, nomenclatures, and products with advanced features like hierarchical structures, audit trails, and bulk operations.

## Features

### Core Functionality
- ✅ **CRUD Operations** - Complete Create, Read, Update, Delete functionality
- ✅ **Hierarchical Data** - Support for nested structures (Financial Centers, Nomenclatures)
- ✅ **Soft Delete** - Data recovery and audit trail maintenance
- ✅ **Multi-tenancy** - User-isolated data with row-level security
- ✅ **Real-time Sync** - Cross-tab synchronization using BroadcastChannel API

### Advanced Features
- ✅ **Bulk Operations** - Import/Export (CSV, Excel, JSON), batch updates, archiving
- ✅ **Audit & History** - Complete change tracking with diff view and recovery
- ✅ **Search & Filter** - Full-text search with fuzzy matching, advanced filters
- ✅ **Undo/Redo** - Multi-level undo with history management
- ✅ **Conflict Resolution** - Automatic detection and resolution options
- ✅ **Offline Support** - LocalStorage persistence with sync queue

### UI/UX Enhancements
- ✅ **Keyboard Navigation** - Full keyboard support with shortcuts
- ✅ **Drag & Drop** - Reorder items and reorganize hierarchies
- ✅ **Context Menus** - Right-click actions for quick operations
- ✅ **Inline Help** - Contextual help and guided tours
- ✅ **Responsive Design** - Mobile-friendly interface
- ✅ **Accessibility** - WCAG 2.1 AA compliant

### Performance Optimizations
- ✅ **Virtual Scrolling** - Handle 10,000+ items efficiently
- ✅ **Lazy Loading** - Load data on demand
- ✅ **Debounced Search** - Optimized search requests
- ✅ **Optimistic Updates** - Instant UI feedback
- ✅ **Background Sync** - Non-blocking data synchronization

## Architecture

```
frontend/
├── src/
│   ├── components/
│   │   ├── reference-data/      # UI components
│   │   ├── advanced/            # Advanced features UI
│   │   ├── ui/                  # Reusable UI components
│   │   ├── help/                # Help system components
│   │   └── tour/                # Guided tour components
│   ├── services/
│   │   ├── referenceDataService.ts    # API layer
│   │   ├── bulkOperationsService.ts   # Bulk operations
│   │   ├── auditService.ts            # Audit logging
│   │   └── searchService.ts           # Search functionality
│   ├── stores/
│   │   └── referenceDataStore.ts      # State management
│   ├── hooks/                         # Custom React hooks
│   └── utils/
│       └── validation.ts              # Validation utilities
└── tests/
    ├── unit/                          # Unit tests
    ├── e2e/                           # End-to-end tests
    ├── performance/                   # Performance tests
    └── accessibility/                 # Accessibility tests
```

## Technology Stack

- **Frontend Framework**: React 19 with TypeScript
- **State Management**: Zustand with persistence
- **UI Components**: Radix UI + Tailwind CSS
- **Data Grid**: TanStack Table v8
- **Forms**: React Hook Form + Zod validation
- **Testing**: Jest, Playwright, axe-core
- **Build Tool**: Vite

## Getting Started

### Prerequisites

```bash
node >= 18.0.0
npm >= 9.0.0
```

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

### Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Performance tests
npm run test:performance

# Accessibility tests
npm run test:a11y

# All tests
npm run test:all
```

### Building

```bash
npm run build
```

## Usage Examples

### Basic CRUD Operations

```typescript
// Using the service layer
import { periodService } from '@/services/referenceDataService';

// Create a period
const newPeriod = await periodService.create({
  period_name: 'Январь 2024',
  period_year: 2024,
  period_month: 1
}, userId);

// Update a period
await periodService.update(periodId, {
  period_name: 'Январь 2024 (обновлен)'
}, userId);

// Delete (soft) a period
await periodService.delete(periodId, userId);
```

### Using Stores

```typescript
import { usePeriodStore } from '@/stores/referenceDataStore';

function PeriodsComponent() {
  const {
    items,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
    undo,
    redo,
    canUndo,
    canRedo
  } = usePeriodStore();

  // Add with optimistic update
  const handleAdd = async (data) => {
    addItem(data, true); // Optimistic
    try {
      const saved = await periodService.create(data, userId);
      updateItem(data.period_id, saved);
    } catch (error) {
      undo(); // Rollback on error
    }
  };
}
```

### Bulk Operations

```typescript
import { periodBulkService } from '@/services/bulkOperationsService';

// Import from file
const file = new File([csvContent], 'periods.csv');
const result = await periodBulkService.importFromFile(file, userId, {
  updateExisting: true,
  skipValidation: false
});

// Export to Excel
const blob = await periodBulkService.exportToFile(periods, {
  format: 'excel',
  includeHeaders: true
});

// Batch update
await periodBulkService.bulkUpdate([
  { id: 1, updates: { is_active: false } },
  { id: 2, updates: { is_active: false } }
], userId);
```

### Advanced Search

```typescript
import { searchService } from '@/services/searchService';

// Full-text search
const results = await searchService.fullTextSearch('январь', {
  entityTypes: ['periods', 'nomenclatures'],
  fuzzyMatch: true,
  limit: 50
});

// Complex filters
const filtered = await searchService.applyFilters(data, {
  conditions: [
    { field: 'period_year', operator: 'equals', value: 2024 },
    { field: 'is_active', operator: 'equals', value: true }
  ],
  logic: 'AND'
});
```

## Configuration

### Environment Variables

```env
VITE_API_URL=http://localhost:8000/api
VITE_ENABLE_MOCK=false
VITE_SYNC_INTERVAL=5000
VITE_CACHE_TTL=300000
```

### Feature Flags

```typescript
const features = {
  enableBulkOperations: true,
  enableAuditTrail: true,
  enableOfflineMode: true,
  enableRealTimeSync: true,
  maxUndoLevels: 50,
  virtualScrollThreshold: 1000
};
```

## Best Practices

### Performance
1. Use virtual scrolling for large datasets
2. Implement pagination for API requests
3. Debounce search inputs (300ms recommended)
4. Cache reference data with appropriate TTL
5. Use optimistic updates for better UX

### Accessibility
1. Always provide keyboard navigation
2. Include proper ARIA labels
3. Ensure sufficient color contrast
4. Test with screen readers
5. Support high contrast mode

### Data Integrity
1. Validate on client and server
2. Use transactions for bulk operations
3. Implement proper error handling
4. Maintain audit trail for all changes
5. Test edge cases thoroughly

## Troubleshooting

### Common Issues

**Issue**: Data not syncing across tabs
- **Solution**: Check BroadcastChannel support in browser
- **Fallback**: Use polling with localStorage

**Issue**: Import failing for large files
- **Solution**: Increase chunk size or use streaming
- **Limit**: 10,000 records per import

**Issue**: Virtual scroll jumping
- **Solution**: Ensure consistent row heights
- **Alternative**: Use fixed height rows

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

## License

This module is part of the Family Budget application and follows the same license terms.

## Support

For issues and questions:
1. Check the [User Guide](./USER_GUIDE_REFERENCE_DATA.md)
2. Review [API Documentation](./API_REFERENCE_DATA.md)
3. Consult [Business Rules](./BUSINESS_RULES_REFERENCE_DATA.md)
4. Create an issue in the repository

## Changelog

### Version 1.0.0 (2024-01-20)
- Initial release with full CRUD functionality
- Hierarchical data support
- Bulk operations (import/export)
- Audit trail and history
- Advanced search and filtering
- Keyboard navigation and accessibility
- Performance optimizations
- Comprehensive test coverage