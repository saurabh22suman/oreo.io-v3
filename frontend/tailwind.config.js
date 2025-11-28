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
        // Brand Colors
        primary: {
          DEFAULT: '#7B4BFF', // Dark mode primary
          light: '#8A63FF',   // Light mode primary
          glow: '#A87CFF',    // Secondary glow
        },
        // Dark Mode Palette
        surface: {
          1: '#0D0F14',
          2: '#141720',
          3: '#1A1E28',
          4: '#212635',
          5: '#2C3245',
        },
        // Light Mode Palette (aliased for semantic usage in CSS variables)
        light: {
          surface: {
            1: '#F9F9FF',
            2: '#FFFFFF',
            3: '#F2F0FF',
          }
        },
        // Status Colors
        success: '#4CD97F',
        warning: '#F4C84A',
        danger: '#FF5370',
        info: '#3EA7FF',
        
        // Text Colors
        text: {
          primary: '#F2F4FA',
          secondary: '#9CA3AF', // Tailwind gray-400 equivalent
          light: '#1A1A24',     // Light mode text
        }
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        display: ['IBM Plex Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'btn': '10px',
        'card': '16px',
        'input': '10px',
      },
      animation: {
        'fade-in': 'fadeIn 180ms ease-out',
        'slide-up': 'slideUp 220ms ease-out',
        'modal-open': 'modalOpen 260ms ease-out',
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
        modalOpen: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
