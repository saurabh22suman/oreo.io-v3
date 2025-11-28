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
        // Brand Colors - Purple Accent Theme
        primary: {
          DEFAULT: 'var(--primary)',
          light: '#8A63FF',
          dark: '#7B4BFF',
          glow: '#A87CFF',
          hover: '#9464FF',
        },
        secondary: '#A87CFF',
        accent: 'var(--primary)',
        
        // Dark Mode Surface Palette
        surface: {
          1: '#0D0F14',
          2: '#141720',
          3: '#1A1E28',
          4: '#212635',
          5: '#2C3245',
        },
        
        // Light Mode Surface (for explicit use)
        'light-surface': {
          1: '#F9F9FF',
          2: '#FFFFFF',
          3: '#F2F0FF',
        },
        
        // Status Colors
        success: '#4CD97F',
        warning: '#F4C84A',
        danger: '#FF5370',
        error: '#FF5370',
        info: '#3EA7FF',
        
        // Text Colors (use CSS variables for theme support)
        text: {
          DEFAULT: 'var(--text)',
          primary: 'var(--text)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          light: '#1A1A24',
          dark: '#F2F4FA',
        },
        
        // Border Colors
        border: {
          DEFAULT: 'var(--border-subtle)',
          subtle: 'var(--border-subtle)',
        },
        
        // Divider
        divider: 'var(--divider)',
        
        // Background
        page: 'var(--bg-page)',
      },
      
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        display: ['IBM Plex Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      
      fontSize: {
        'display-xl': ['48px', { lineHeight: '1.2' }],
        'display-l': ['36px', { lineHeight: '1.2' }],
        'headline-m': ['28px', { lineHeight: '1.2' }],
        'headline-s': ['22px', { lineHeight: '1.2' }],
        'body-m': ['16px', { lineHeight: '1.5' }],
        'body-s': ['14px', { lineHeight: '1.5' }],
      },
      
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      
      borderRadius: {
        'btn': '10px',
        'card': '16px',
        'input': '10px',
      },
      
      boxShadow: {
        'card': 'var(--shadow-card)',
        'hover': 'var(--shadow-hover)',
        'primary': '0 4px 12px rgba(123, 75, 255, 0.3)',
        'primary-lg': '0 6px 16px rgba(123, 75, 255, 0.4)',
        'glow': '0 0 20px rgba(123, 75, 255, 0.3)',
      },
      
      backgroundImage: {
        'primary-gradient': 'linear-gradient(90deg, #7B4BFF, #A87CFF)',
        'accent-gradient': 'linear-gradient(90deg, #7B4BFF, #A87CFF)',
      },
      
      animation: {
        'fade-in': 'fadeIn 180ms ease-out',
        'slide-up': 'slideUp 220ms ease-out',
        'slide-down': 'slideDown 220ms ease-out',
        'modal-open': 'modalOpen 260ms ease-out',
        'hover-lift': 'hoverLift 140ms ease-out',
        'press': 'press 96ms ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'gradient': 'gradient 8s ease infinite',
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
        },
        hoverLift: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-2px)' },
        },
        press: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.98)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      
      transitionDuration: {
        'fade': '180ms',
        'slide': '220ms',
        'hover': '140ms',
        'press': '96ms',
        'modal': '260ms',
        'theme': '250ms',
      },
      
      maxWidth: {
        'page': '1200px',
      },
    },
  },
  plugins: [],
}
