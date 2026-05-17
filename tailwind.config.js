/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        epis: {
          bg: '#0a0a0f',
          card: '#14141f',
          accent: '#6c5ce7',
          'accent-light': '#a29bfe',
          text: '#f0f0f5',
          'text-muted': '#8888a0',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};