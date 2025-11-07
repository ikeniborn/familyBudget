/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './frontend/web/templates/**/*.html',
    './frontend/web/static/js/**/*.js',
    './frontend/webapp/**/*.html',
    './frontend/webapp/static/js/**/*.js',
    './frontend/shared/**/*.js',
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
