/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue'
  ],
  theme: {
    extend: {
      colors: {
        paper: '#F6F3EE',
        ink: '#161513',
        muted: '#6B6560',
        line: '#E7E1D8',
        card: '#FFFEFB',
        sage: {
          DEFAULT: '#2F5D50',
          hover: '#274E43'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif']
      }
    }
  },
  plugins: []
}
