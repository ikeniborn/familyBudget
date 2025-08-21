/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        
        // Design system colors
        navy: {
          DEFAULT: 'hsl(var(--navy-dark))',
          dark: 'hsl(var(--navy-dark))',
          50: '#f0f4f8',
          100: '#d9e6f2',
          200: '#b3ccde',
          300: '#7fb3d5',
          400: '#6ba3d0',
          500: '#4a90c2',
          600: '#3b82b5',
          700: '#2c5f8b',
          800: '#1e3a5f',
          900: '#172e47'
        },
        sky: {
          DEFAULT: 'hsl(var(--sky-light))',
          light: 'hsl(var(--sky-light))',
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7fb3d5',
          400: '#7fb3d5',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e'
        },
        beige: {
          DEFAULT: 'hsl(var(--beige))',
          50: '#fefcf9',
          100: '#fef7f0',
          200: '#fdeee1',
          300: '#fbe0c4',
          400: '#f7ce9f',
          500: '#d4b896',
          600: '#c9a876',
          700: '#b4935f',
          800: '#a17d4a',
          900: '#8b6a3a'
        },
        steel: {
          DEFAULT: 'hsl(var(--steel))',
          50: '#f8fafb',
          100: '#f1f5f7',
          200: '#e4ebf0',
          300: '#d1dbe3',
          400: '#a8c0d0',
          500: '#9cb4c7',
          600: '#7a9bb5',
          700: '#5f8aa8',
          800: '#4a6c82',
          900: '#3d5a6e'
        },
        
        // Theme semantic colors
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        'warm-accent': {
          DEFAULT: 'hsl(var(--warm-accent))',
          foreground: 'hsl(var(--warm-accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
};