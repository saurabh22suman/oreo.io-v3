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
        primary: {
          DEFAULT: '#0078D4', // Azure Blue
          dark: '#005A9E',
          light: '#50E6FF',
        },
        neutral: {
          50: '#F3F2F1',
          100: '#EDEBE9',
          200: '#E1DFDD',
          300: '#D2D0CE',
          400: '#C8C6C4',
          500: '#A19F9D',
          600: '#8A8886',
          700: '#605E5C',
          800: '#484644',
          900: '#201F1E', // Primary text
        },
        azure: {
          blue: '#0078D4',
          lightGray: '#F3F2F1',
        },
        'azure-blue': '#0078D4', // Explicit alias for landing page
      },
      fontFamily: {
        sans: ['"Segoe UI"', '"Segoe UI Web (West European)"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Helvetica Neue', 'sans-serif'],
      },
      boxShadow: {
        'azure-card': '0 1.6px 3.6px 0 rgba(0,0,0,0.132), 0 0.3px 0.9px 0 rgba(0,0,0,0.108)',
        'azure-hover': '0 3.2px 7.2px 0 rgba(0,0,0,0.132), 0 0.6px 1.8px 0 rgba(0,0,0,0.108)',
      }
    },
  },
  plugins: [],
}
