/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        coral:       { DEFAULT: '#FF6B6B', light: '#FFB3B3', dark: '#cc4444' },
        sage:        { DEFAULT: '#88B04B', light: '#C5E08A', dark: '#5a7a1e' },
        periwinkle:  { DEFAULT: '#6B7FD7', light: '#B3BFF0', dark: '#4055b0' },
        clay: {
          base:      '#F5F0E8',
          card:      '#FAF7F2',
          dark:      '#2D2438',
          'card-dark': '#3A2F4A',
        },
      },
      fontFamily: {
        display: ['"Roboto Slab"', 'Georgia', 'serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Roboto Mono"', 'monospace'],
      },
      borderRadius: {
        clay: '24px',
        'clay-sm': '16px',
        'clay-xs': '12px',
      },
      boxShadow: {
        'clay-sm': '3px 3px 8px rgba(139,110,80,0.18), -2px -2px 6px rgba(255,255,255,0.85)',
        'clay-md': '6px 6px 16px rgba(139,110,80,0.22), -3px -3px 10px rgba(255,255,255,0.9)',
        'clay-lg': '10px 10px 28px rgba(139,110,80,0.28), -5px -5px 16px rgba(255,255,255,0.95)',
        'clay-pressed': '2px 2px 6px rgba(139,110,80,0.25), -1px -1px 3px rgba(255,255,255,0.7), inset 2px 2px 6px rgba(139,110,80,0.15)',
        'clay-sm-dark': '3px 3px 10px rgba(0,0,0,0.45), -2px -2px 6px rgba(255,255,255,0.05)',
        'clay-md-dark': '6px 6px 20px rgba(0,0,0,0.55), -3px -3px 10px rgba(255,255,255,0.06)',
      },
      animation: {
        'clay-press-in': 'clay-press-in 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'spin-slow': 'spin 1.2s linear infinite',
      },
      keyframes: {
        'clay-press-in': {
          '0%':   { transform: 'scale(1.06) translateY(-10px)', opacity: '0' },
          '55%':  { transform: 'scale(0.97) translateY(2px)',   opacity: '1' },
          '75%':  { transform: 'scale(1.01)' },
          '100%': { transform: 'scale(1) translateY(0)',        opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
