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
        charcoal: '#0D0D0F',
        ivory: '#F2EFE6',
        smoke: '#8A8A8F',
        studio: {
          charcoal: '#0D0D0F',
          slate: '#1A1A1D',
          ivory: '#F2EFE6',
          gold: '#D4A017',
          smoke: '#8A8A8F',
        },
        dark: {
          bg: '#0D0D0F',
          card: '#1A1A1D',
          border: '#2C2C32',
        },
        accent: {
          orange: '#fb923c',
          cyan: '#D4A017',
          purple: '#a78bfa',
        },
        primary: {
          DEFAULT: '#D4A017',
          hover: '#c49214',
        },
        // Remap Tailwind gray onto the dark cinematic scale used by existing utilities.
        // 50–400 = surfaces/borders, 500–900 = muted→ivory text, 950 = charcoal (on-gold).
        gray: {
          50: '#121214',
          100: '#1A1A1D',
          200: '#2C2C32',
          300: '#3D3D45',
          400: '#6E6E74',
          500: '#8A8A8F',
          600: '#A8A8AD',
          700: '#D0CDC6',
          800: '#E4E0D6',
          900: '#F2EFE6',
          950: '#0D0D0F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Bebas Neue"', 'Impact', 'Haettenschweiler', 'sans-serif'],
      },
      letterSpacing: {
        cinema: '0.18em',
      },
    },
  },
  plugins: [],
}
