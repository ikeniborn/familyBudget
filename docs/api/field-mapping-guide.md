# Field Mapping Guide

## Overview
This guide documents the field mapping strategy for reference data entities (Period, Financial Center, Cost Center, Nomenclature) and how to handle backward compatibility between legacy and modern field names.

## Field Mapping Table

### Period Entity
| Legacy Field | Modern Field | Usage in Frontend |
|-------------|--------------|-------------------|
| `period_id` | `id` | Use `period_id` for value (still exists) |
| `period_name` | `period_name` | Display field (unchanged) |

### Financial Center Entity
| Legacy Field | Modern Field | Usage in Frontend |
|-------------|--------------|-------------------|
| `financial_center_id` | `id` | Use `financial_center_id` for value |
| `financial_center_name` | `name` | Use `name || financial_center_name` for display |

### Cost Center Entity
| Legacy Field | Modern Field | Usage in Frontend |
|-------------|--------------|-------------------|
| `cost_center_id` | `id` | Use `cost_center_id` for value |
| `cost_center_name` | `name` | Use `name || cost_center_name` for display |

### Nomenclature Entity
| Legacy Field | Modern Field | Usage in Frontend |
|-------------|--------------|-------------------|
| `nomenclature_id` | `id` | Use `nomenclature_id` for value |
| `nomenclature_name` | `name` | Use `name || nomenclature_name` for display |

## Best Practices

### 1. Safe Field Access Pattern
Always use optional chaining and fallbacks when accessing ID fields:

```typescript
// ❌ BAD - Can throw "Cannot read properties of undefined"
<option value={entity.field_id.toString()}>

// ✅ GOOD - Safe with fallback
<option value={(entity.field_id?.toString() || '')}>
```

### 2. Display Name Fallback Pattern
Always provide multiple fallback options for display names:

```typescript
// ❌ BAD - Might display undefined
{entity.financial_center_name}

// ✅ GOOD - Multiple fallbacks
{entity.name || entity.financial_center_name || 'Unknown'}
```

### 3. Form Submission Pattern
When submitting forms, parse IDs safely:

```typescript
// ✅ GOOD - Safe parsing with fallback
const payload = {
  financial_center_id: formData.financial_center_id ? parseInt(formData.financial_center_id) : undefined,
  // ... other fields
};
```

## Common Pitfalls and Solutions

### Pitfall 1: toString() on Undefined
**Problem**: Calling `.toString()` on undefined fields causes runtime errors.
**Solution**: Use optional chaining: `field?.toString() || ''`

### Pitfall 2: Missing Display Names
**Problem**: Using only one field name without fallbacks shows "undefined" in UI.
**Solution**: Use fallback pattern: `entity.name || entity.legacy_name || 'Unknown'`

### Pitfall 3: Inconsistent Field Access
**Problem**: Different components use different field names.
**Solution**: Standardize on patterns documented above.

## Migration Strategy

### Phase 1: Defensive Coding (Current)
- Add safe navigation operators to all field access
- Implement fallback patterns for display names
- Maintain backward compatibility

### Phase 2: Helper Functions (Planned)
- Create centralized helper functions for field access
- Standardize field mapping across all components
- Reduce code duplication

### Phase 3: API Standardization (Future)
- Migrate backend to use only modern field names
- Remove legacy field support after full migration
- Update all frontend components to use standard fields

## Testing Requirements

All components using reference data must be tested for:
1. Handling of undefined/null fields
2. Support for both legacy and modern field names
3. Proper fallback display values
4. Safe form submission with correct IDs

## Related Documentation
- [ADR-007: Field Mapping Strategy](../architecture/adr-007-field-mapping-strategy.md)
- [Error Handling Guide](./error-handling.md)
- [Test Coverage Report](../testing/test-coverage.md)