/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors - Purple Accent Theme per UI_revamp-spec.md
        primary: {
          DEFAULT: '#7B4BFF',
          light: '#8A63FF',
          glow: '#A87CFF',
          hover: '#6B3BEF',
        },
        secondary: {
          DEFAULT: '#A87CFF',
        },
        // Surface colors - Static values for build compatibility
        surface: {
          1: 'var(--bg-page)',
          2: 'var(--bg-surface)',
          3: 'var(--bg-surface-2)',
          4: 'var(--bg-surface-3)',
          5: 'var(--bg-surface-4)',
        },
        // Status Colors per spec
        success: '#4CD97F',
        warning: '#F4C84A',
        danger: '#FF5370',
        info: '#3EA7FF',
        error: '#FF5370',
        accent: '#A87CFF',
        
        // Text Colors using CSS variables
        text: {
          DEFAULT: 'var(--text)',
          primary: 'var(--text)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        // Border Colors
        border: {
          DEFAULT: 'var(--border-subtle)',
          subtle: 'var(--border-subtle)',
        },
        divider: 'var(--divider)',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'IBM Plex Mono', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Typography scale per spec (1.25 ratio)
        'display-xl': ['48px', { lineHeight: '1.2', fontWeight: '700' }],
        'display-lg': ['36px', { lineHeight: '1.2', fontWeight: '700' }],
        'headline-md': ['28px', { lineHeight: '1.2', fontWeight: '600' }],
        'headline-sm': ['22px', { lineHeight: '1.2', fontWeight: '600' }],
        'body-md': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
      },
      spacing: {
        // Material-style spacing grid per spec
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      borderRadius: {
        'btn': '10px',
        'card': '16px',
        'input': '10px',
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(123, 75, 255, 0.1), 0 4px 6px -2px rgba(123, 75, 255, 0.05)',
        'elevated': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'glow': '0 0 20px rgba(123, 75, 255, 0.3)',
        'glow-lg': '0 0 40px rgba(123, 75, 255, 0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 180ms ease-out',
        'slide-up': 'slideUp 220ms ease-out',
        'slide-down': 'slideDown 220ms ease-out',
        'modal-open': 'modalOpen 260ms ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        modalOpen: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        }
      },
      maxWidth: {
        'content': '1200px',
      },
      transitionDuration: {
        'hover': '140ms',
        'press': '96ms',
      }
    },
  },
  plugins: [],
}
