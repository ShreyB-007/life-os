/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        void: {
          950: '#080c18',
          900: '#0f1627',
          850: '#131d35',
          800: '#182040',
          750: '#1e2a50',
          700: '#243259',
          600: '#2f4275',
        },
      },
      keyframes: {
        'pulse-streak': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.12)', opacity: '0.85' },
        },
        boop: {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'glow-breathe': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.04)' },
        },
        'legendary-ring': {
          '0%': { opacity: '0.6', transform: 'scale(0.9)' },
          '100%': { opacity: '0', transform: 'scale(1.6)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-2px)' },
        },
        'slide-up-fade': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-warm': 'pulse-streak 2s ease-in-out infinite',
        'pulse-hot': 'pulse-streak 1.6s ease-in-out infinite',
        'pulse-legendary': 'glow-breathe 1.1s ease-in-out infinite',
        boop: 'boop 250ms ease-out',
        'slide-down': 'slide-down 300ms ease-out',
        shimmer: 'shimmer 2.5s linear infinite',
        'legendary-ring': 'legendary-ring 1.4s ease-out infinite',
        float: 'float 3s ease-in-out infinite',
        'slide-up-fade': 'slide-up-fade 400ms ease-out both',
      },
    },
  },
  plugins: [],
}
