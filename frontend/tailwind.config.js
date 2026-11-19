/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a5b4fc', // pastel periwinkle
          500: '#818cf8', // soft pastel indigo
          600: '#6366f1', // balanced primary indigo
          700: '#4f46e5',
          800: '#4338ca',
          900: '#312e81',
          950: '#1e1b4b',
        },
        pastel: {
          indigo: '#a5b4fc',
          mint: '#6ee7b7',
          rose: '#fda4af',
          amber: '#fde047',
          sky: '#93c5fd',
        },
        slate: {
          850: '#141c2c',
          900: '#0e1524',
          950: '#080d1a',
        }
      }
    },
  },
  plugins: [],
}
