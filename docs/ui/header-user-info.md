# Header User Information Component

## Overview

This document describes the header user information component structure and implementation details for the Family Budget Application layout update (v3.3.0).

## Component Location

**File**: `frontend-svelte/src/lib/components/layout/Layout.svelte`

## Design Change Summary

The user information section has been moved from the sidebar bottom position to the header top-right corner, providing a more modern and intuitive user experience.

### Before vs After

| Aspect | Before (Sidebar) | After (Header) |
|--------|------------------|----------------|
| **Location** | Bottom of left sidebar | Top-right corner of header |
| **Visibility** | Always visible in sidebar | Header integration with responsive hiding |
| **Space Usage** | Consumed sidebar space | Frees up sidebar for navigation |
| **UX Pattern** | Non-standard placement | Industry-standard header placement |

## Implementation Details

### HTML Structure

```html
<!-- Header with user info in top-right -->
<header class="header">
  <div class="header-content">
    <h1 class="header-title">Family Budget</h1>

    <!-- User information section -->
    <div class="user-info">
      <div class="user-details" class:hidden={isMobile}>
        <span class="user-name">{$user.firstName}</span>
        <span class="user-role">{$user.role}</span>
      </div>
      <button class="logout-btn" on:click={handleLogout}>
        Выход
      </button>
    </div>
  </div>
</header>
```

### CSS Styling

```css
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-details {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  color: white;
  font-size: 0.875rem;
}

.user-name {
  font-weight: 600;
}

.user-role {
  opacity: 0.8;
  font-size: 0.75rem;
}

.logout-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Responsive Design */
@media (max-width: 768px) {
  .user-details.hidden {
    display: none;
  }

  .header-content {
    padding: 0.5rem 1rem;
  }
}
```

### JavaScript Logic

```javascript
import { onMount } from 'svelte';
import { authStore } from '$lib/stores/auth.store';

let isMobile = false;

onMount(() => {
  // Detect mobile viewport
  const checkMobile = () => {
    isMobile = window.innerWidth < 768;
  };

  checkMobile();
  window.addEventListener('resize', checkMobile);

  return () => {
    window.removeEventListener('resize', checkMobile);
  };
});

const handleLogout = async () => {
  await authStore.logout();
  // Redirect handled by auth store
};
```

## Responsive Behavior

### Desktop (≥768px)
- Full user information displayed (name + role)
- Logout button positioned rightmost
- Clear visual hierarchy with geometric styling

### Mobile (<768px)
- User details (name/role) hidden to save space
- Only logout button remains visible
- Maintains functionality while optimizing screen real estate

## Design System Integration

### Colors
- **Header Background**: Gradient from `#667eea` to `#764ba2`
- **Text Color**: White with opacity variations
- **Button**: Semi-transparent white with hover effects

### Typography
- **User Name**: Font weight 600, standard size
- **User Role**: Font weight normal, smaller size (0.75rem)
- **Consistent**: Matches application typography scale

### Spacing
- **Gap**: 1rem between user details and logout button
- **Padding**: Responsive padding (1rem desktop, 0.5rem mobile)
- **Alignment**: Flex-end alignment for right positioning

## Benefits

### User Experience
1. **Familiar Pattern**: Users expect account info in header top-right
2. **Better Navigation**: More space in sidebar for menu items
3. **Quick Access**: Logout button easily accessible
4. **Mobile Optimized**: Smart hiding of non-essential details

### Development
1. **Consistent Layout**: Follows modern web application patterns
2. **Responsive Design**: Adapts to different screen sizes
3. **Maintainable Code**: Clear component structure
4. **Accessible**: Proper semantic HTML and keyboard navigation

## Integration Points

### Auth Store
The component integrates with the application's authentication store to:
- Display current user information (`$user.firstName`, `$user.role`)
- Handle logout functionality through `authStore.logout()`
- React to authentication state changes

### Responsive Store
Uses responsive design patterns to:
- Detect viewport changes
- Conditionally show/hide user details
- Maintain consistent experience across devices

## Future Enhancements

### Potential Improvements
1. **User Avatar**: Add profile picture support
2. **Dropdown Menu**: Expand to include profile settings
3. **Notifications**: Integrate notification badge
4. **Theme Toggle**: Add dark/light mode switcher

### Accessibility Enhancements
1. **ARIA Labels**: Add proper labeling for screen readers
2. **Keyboard Navigation**: Improve tab order and focus management
3. **Color Contrast**: Ensure WCAG compliance for all text

## Testing Considerations

### Unit Tests
- Component rendering with different user states
- Responsive behavior validation
- Logout functionality testing

### Integration Tests
- Auth store integration
- Mobile/desktop responsive switching
- User information display accuracy

### Visual Tests
- Cross-browser compatibility
- Mobile device testing
- Accessibility validation

## Version History

- **v3.3.0 (2025-09-16)**: Initial implementation of header user info
  - Moved from sidebar to header
  - Added responsive behavior
  - Maintained geometric design style
  - Integrated logout functionality

## Related Documentation

- [Layout Component Architecture](../components/layout-architecture.md)
- [Authentication System](../api/authentication.md)
- [Responsive Design Guidelines](../ui/responsive-design.md)
- [Design System](../ui/design-system.md)