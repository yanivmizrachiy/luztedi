import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        meeting: {
          600: '#2563eb',
          700: '#1d4ed8',
        },
        training: {
          50: '#fff1f2',
          700: '#be185d',
        },
        trip: {
          600: '#16a34a',
          700: '#15803d',
        },
        holiday: {
          800: '#4c1d95',
          900: '#2e1065',
        },
        ink: {
          950: '#0b1220',
        },
      },
      fontFamily: {
        sans: ['Heebo', 'Assistant', 'system-ui', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(11, 18, 32, 0.06)',
        card: '0 10px 24px rgba(11, 18, 32, 0.08)',
      },
      keyframes: {
        fadeSlideIn: {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.99)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeSlideIn: 'fadeSlideIn 260ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config
