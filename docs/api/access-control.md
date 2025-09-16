# Access Control Documentation

## Overview

The Family Budget application implements role-based access control (RBAC) to restrict administrative functions to authorized users only.

## User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `admin` | Administrator | Full access to all features including settings and references |
| `user` | Regular User | Access to core functionality (budget, facts, reports, products) |

## Protected Features

### Admin-Only Features
- ✅ Reference Data Management (Справочники)
  - Periods (Периоды)
  - Financial Centers (ЦФО)
  - Cost Centers (МВЗ)
  - Nomenclatures (Номенклатуры)
  - Articles (Статьи)
- ✅ System Settings
  - User Management
  - Security Settings
  - Import/Export
  - Sharing Configuration

### Regular User Features
- ✅ Dashboard (Главная)
- ✅ Facts Entry (Факт)
- ✅ Budget Management (Бюджет)
- ✅ Reports (Отчеты)
- ✅ Products (Продукты)

## Implementation

### Frontend Protection

#### Navigation Filtering
```typescript
// Layout.svelte
const referenceNavItem: NavItem = {
  name: 'Справочники',
  path: '/settings',
  icon: Database,
  adminOnly: true  // Only shown to admins
};

$: navItems = $isAdmin
  ? [...baseNavItems, referenceNavItem]
  : baseNavItems;
```

#### Settings Icon Visibility
```svelte
<!-- Header Settings Button -->
{#if $isAdmin}
  <Button on:click={() => goto('/settings')} title="Настройки">
    <Settings class="h-5 w-5" />
  </Button>
{/if}
```

### Server-Side Protection

#### Route Guard Implementation
```typescript
// +layout.server.ts
export const load: LayoutServerLoad = async ({ cookies, locals, url }) => {
  // Check authentication
  if (!locals.user) {
    throw error(401, 'Authentication required');
  }

  // Check admin role
  if (locals.user.role !== 'admin') {
    throw error(403, 'Admin access required');
  }

  return {
    user: locals.user
  };
};
```

### Client-Side Fallback

```svelte
<!-- +layout.svelte -->
{#if !data.user || data.user.role !== 'admin'}
  <Card class="max-w-md mx-auto mt-20">
    <Alert variant="error">
      <h2>Доступ запрещен</h2>
      <p>У вас недостаточно прав для просмотра этой страницы.</p>
    </Alert>
    <Button on:click={() => goto('/dashboard')}>
      Вернуться на главную
    </Button>
  </Card>
{:else}
  <slot />
{/if}
```

## Testing

### Test Coverage
- **UI Filtering Tests**: 19 tests in `access-control-simple.test.ts`
- **Route Protection Tests**: 20 tests in `settings-route-protection.test.ts`
- **Total Coverage**: >95% of access control logic

### Running Tests
```bash
# Run all access control tests
docker exec budget-frontend npm run test access-control

# Run with coverage
docker exec budget-frontend npm run test -- --coverage access-control
```

## Security Best Practices

1. **Never Trust Client-Side Only**: Always validate on server
2. **Use Proper HTTP Codes**: 401 for unauthenticated, 403 for unauthorized
3. **Minimize Information Exposure**: Don't reveal admin features to regular users
4. **Session-Based Authentication**: Use secure session cookies
5. **Defense in Depth**: Multiple layers of protection

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Admin features visible to regular users | Check `isAdmin` store subscription |
| Settings pages accessible via URL | Verify `+layout.server.ts` is working |
| 404 on settings pages | Ensure route files exist |
| Session not persisting | Check Redis connection and cookies |

### Debug Commands

```bash
# Check user role in database
docker exec budget-postgres psql -U budget -d budgetdb -c \
  "SELECT id, username, role FROM t_d_user WHERE id = <user_id>;"

# Monitor authentication logs
docker logs -f budget-backend --tail=100 | grep -i auth

# Test role assignment
curl -X GET http://localhost:4000/api/auth/me \
  -H "Cookie: connect.sid=<session_id>"
```

## API Endpoints

### Authentication Check
```http
GET /api/auth/me
Response: {
  "id": 1,
  "username": "user@example.com",
  "role": "admin" | "user"
}
```

### Protected Settings Endpoints
All endpoints under `/api/` require authentication.
Admin-only endpoints return 403 for regular users:
- `/api/periods/`
- `/api/financial_centers/`
- `/api/cost_centers/`
- `/api/nomenclatures/`
- `/api/articles/`

## Migration Guide

### Adding Admin Role to Existing User
```sql
-- Update user to admin
UPDATE t_d_user
SET role = 'admin'
WHERE username = 'admin@example.com';

-- Verify update
SELECT id, username, role
FROM t_d_user
WHERE role = 'admin';
```

### Default Role Assignment
New users are assigned `role = 'user'` by default.
Only database administrators can promote users to admin role.

## Future Enhancements

- [ ] Add role management UI for super admins
- [ ] Implement more granular permissions (read, write, delete)
- [ ] Add audit logging for admin actions
- [ ] Create viewer role with read-only access
- [ ] Implement temporary admin elevation