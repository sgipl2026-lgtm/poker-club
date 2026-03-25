/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        felt:  { DEFAULT: '#1e7a45', dark: '#155c33', light: '#2d8a52' },
        gold:  { DEFAULT: '#c9a84c', light: '#e8c97a', dark: '#a07c2a' },
        table: { DEFAULT: '#0d1117', surface: '#161b22', border: '#30363d' },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans:    ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'deal':   'deal 0.3s ease-out',
        'pulse-gold': 'pulseGold 1.5s ease-in-out infinite',
      },
      keyframes: {
        deal: {
          '0%':   { opacity: '0', transform: 'translateY(-20px) scale(0.8)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,168,76,0.4)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(201,168,76,0)' },
        },
      },
    },
  },
  plugins: [],
}
