/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        floatIn: {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(255,255,255,0.0)' },
          '50%': { boxShadow: '0 0 24px 2px rgba(120,170,255,0.25)' },
        },
      },
      animation: {
        floatIn: 'floatIn 0.25s ease-out',
        pulseGlow: 'pulseGlow 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
