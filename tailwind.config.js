/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0a0a0a',
          card: '#141414',
          border: '#1f1f1f',
        },
        accent: {
          orange: '#fb923c',
          cyan: '#41aaa8',
          purple: '#a78bfa',
        },
        primary: {
          DEFAULT: '#41aaa8',
          hover: '#359896',
        }
      }
    },
  },
  plugins: [],
}

