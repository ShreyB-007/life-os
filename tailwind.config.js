/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
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
      },
      animation: {
        'pulse-warm': 'pulse-streak 2s ease-in-out infinite',
        'pulse-hot': 'pulse-streak 1.6s ease-in-out infinite',
        'pulse-legendary': 'pulse-streak 1.1s ease-in-out infinite',
        boop: 'boop 250ms ease-out',
        'slide-down': 'slide-down 300ms ease-out',
      },
    },
  },
  plugins: [],
}
