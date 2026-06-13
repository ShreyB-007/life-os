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
        // Exact spec palette — replaces previous void values
        void: {
          950: '#070712',
          900: '#0F0F1A',
          850: '#141428',
          800: '#1C1C2E',
          750: '#252540',
          700: '#2E2E52',
          600: '#3A3A6A',
        },
        // Light mode equivalents
        surface: {
          50:  '#FAFAFA',
          100: '#F1F1F8',
          200: '#E2E2EE',
        },
        // Semantic tokens — values live in CSS variables (index.css :root / html.dark)
        // so text-os-fg / text-os-secondary / text-os-muted adapt to theme automatically
        'os-fg':        'var(--os-fg)',
        'os-secondary': 'var(--os-secondary)',
        'os-muted':     'var(--os-muted)',
        // Primary accent (same in both themes)
        'os-indigo':    '#6366F1',
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
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-2px)' },
        },
        'slide-up-fade': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'streak-flash': {
          '0%':   { transform: 'scale(1)' },
          '35%':  { transform: 'scale(1.3)' },
          '100%': { transform: 'scale(1)' },
        },
        'bar-shine': {
          '0%':   { backgroundPosition: '-100% center' },
          '100%': { backgroundPosition: '250% center' },
        },
        'banner-shimmer': {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'cosmic-text-shift': {
          '0%':   { backgroundPosition: '0% center' },
          '100%': { backgroundPosition: '300% center' },
        },
        'slide-up-drawer': {
          '0%':   { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.08)' },
        },
        'pop-in': {
          '0%':   { transform: 'scale(0)', opacity: '0' },
          '70%':  { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-in-right': {
          '0%':   { transform: 'translateX(10px) scale(0.85)', opacity: '0' },
          '100%': { transform: 'translateX(0) scale(1)', opacity: '1' },
        },
        'breathe-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0)' },
          '50%':      { boxShadow: '0 0 0 5px rgba(99,102,241,0.28)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%':      { transform: 'translateX(-4px)' },
          '40%':      { transform: 'translateX(4px)' },
          '60%':      { transform: 'translateX(-3px)' },
          '80%':      { transform: 'translateX(3px)' },
        },
        'slot-up': {
          '0%':   { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slot-down': {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-warm':      'pulse-streak 2s ease-in-out infinite',
        'pulse-hot':       'pulse-streak 1.6s ease-in-out infinite',
        'pulse-legendary': 'glow-breathe 1.1s ease-in-out infinite',
        boop:              'boop 250ms ease-out',
        'slide-down':      'slide-down 300ms ease-out',
        shimmer:           'shimmer 2.5s linear infinite',
        'legendary-ring':  'legendary-ring 1.4s ease-out infinite',
        float:             'float 3s ease-in-out infinite',
        'slide-up-fade':   'slide-up-fade 400ms ease-out both',
        'streak-flash':    'streak-flash 400ms ease-out',
        'bar-shine':           'bar-shine 1.2s ease forwards',
        'banner-shimmer':      'banner-shimmer 1.5s ease 1 forwards',
        'cosmic-text-shift':   'cosmic-text-shift 3.5s linear infinite',
        'slide-up-drawer':     'slide-up-drawer 300ms cubic-bezier(0.32, 0.72, 0, 1) both',
        heartbeat:             'heartbeat 1.4s ease-in-out infinite',
        'pop-in':              'pop-in 0.25s ease-out forwards',
        'slide-in-right':      'slide-in-right 0.28s ease-out forwards',
        'breathe-glow':        'breathe-glow 2s ease-in-out infinite',
        shake:                 'shake 0.3s ease-out',
        'slot-up':             'slot-up 0.12s ease-out forwards',
        'slot-down':           'slot-down 0.12s ease-out forwards',
      },
    },
  },
  plugins: [],
}
