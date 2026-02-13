/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './frontend/web/templates/**/*.html',
    './frontend/web/static/js/**/*.js',
    './frontend/webapp/**/*.html',
    './frontend/webapp/static/js/**/*.js',
    './frontend/shared/**/*.js',
  ],
  // Safelist: Ensure fb-* classes are always included in the build
  // These classes are defined in daisyui-overrides.css for:
  // 1. Dynamic usage via JavaScript (classList.add/remove)
  // 2. Future template migrations from DaisyUI conflicting classes
  // 3. Consistent API for loading states and icon styling
  safelist: [
    // Loading states (daisyui-overrides.css Section 2)
    // Used: fb-loading-text (admin_dashboard.html)
    // Available for dynamic/future use:
    'fb-loading-text',
    'fb-loading-dots',     // Alternative to DaisyUI loading spinner
    'fb-chart-loading',    // Chart loading state
    'fb-loading-overlay',  // Full-screen loading overlay
    'fb-skeleton',         // Skeleton loading placeholder
    // SVG icon utilities (daisyui-overrides.css Section 4)
    // For explicit icon coloring to avoid DaisyUI color overrides
    'fb-icon',
    'fb-icon-primary',
    'fb-icon-success',
    'fb-icon-error',
    'fb-icon-warning',
    'fb-icon-info',
    'fb-icon-muted',
    'fb-icon-inherit',
    'fb-icon-sm',
    'fb-icon-md',
    'fb-icon-lg',
    'fb-icon-xl',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4CAF50',
        secondary: '#2196F3',
        accent: '#ff9800',
        neutral: '#333',
      }
    }
  },
  daisyui: {
    themes: [
      {
        light: {
          "primary": "#4CAF50",
          "secondary": "#2196F3",
          "accent": "#ff9800",
          "neutral": "#333333",
          "base-100": "#ffffff",
          "info": "#2196F3",
          "success": "#4CAF50",
          "warning": "#ff9800",
          "error": "#f44336",
        },
      },
      "dark",
    ],
  },
  plugins: [
    require('daisyui'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
  corePlugins: {
    preflight: true,
  }
}
