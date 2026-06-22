/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        mood: {
          0: '#4a148c',
          1: '#6a1b9a',
          2: '#9c27b0',
          3: '#9e9e9e',
          4: '#66bb6a',
          5: '#43a047',
          6: '#2e7d32',
        },
      },
    },
  },
  plugins: [],
}
