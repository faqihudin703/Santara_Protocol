/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        santara: {
          bg: '#0a0b0d',
          card: '#12141a',
          border: '#2a2e37',
          primary: '#3b82f6',
          success: '#22c55e',
          warning: '#eab308',
          danger: '#ef4444',
        }
      },
      animation: {
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}