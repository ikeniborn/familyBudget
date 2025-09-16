# ADR-007: Field Mapping Strategy for Reference Data

## Status
Accepted

## Context
The application has evolved from using legacy field names (e.g., `financial_center_id`, `financial_center_name`) to modern standardized names (e.g., `id`, `name`). During this transition, frontend components encountered runtime errors when trying to access fields that might be undefined, particularly "Cannot read properties of undefined (reading 'toString')" errors.

## Decision
We will implement a defensive field mapping strategy that:
1. Supports both legacy and modern field names simultaneously
2. Uses optional chaining and fallback patterns to prevent runtime errors
3. Provides clear fallback display values when fields are missing
4. Maintains backward compatibility during the transition period

## Implementation

### Safe Field Access Pattern
```typescript
// For ID fields
<option value={(entity.legacy_id?.toString() || entity.id?.toString() || '')}>

// For display fields
{entity.name || entity.legacy_name || 'Unknown'}
```

### Affected Components
- FactForm.svelte - Fixed field access for Period, Financial Center, Cost Center, Nomenclature
- FactEditModal.svelte - Requires similar fixes
- BudgetForm.svelte - Requires similar fixes
- ReportFilters.svelte - Requires similar fixes

### Testing Strategy
All components must be tested with:
- New field structure only
- Legacy field structure only
- Mixed field structures
- Undefined/null fields
- Empty data scenarios

## Consequences

### Positive
- No runtime errors when fields are undefined
- Smooth transition from legacy to modern field names
- Better user experience with fallback display values
- Components work with various API response formats

### Negative
- Increased code complexity with fallback patterns
- Need to maintain compatibility code during transition
- Potential for inconsistent field access across components
- Additional testing burden for multiple scenarios

### Neutral
- Performance impact is negligible (simple null checks)
- Code can be simplified after full migration to modern fields

## Migration Timeline
1. **Phase 1 (Current)**: Defensive coding with fallbacks
2. **Phase 2 (Q1 2026)**: Standardize with helper functions
3. **Phase 3 (Q2 2026)**: Remove legacy field support

## Related
- [Field Mapping Guide](../api/field-mapping-guide.md)
- [Error Handling Guide](../api/error-handling.md)
- Issue: FactForm TypeError when creating operations