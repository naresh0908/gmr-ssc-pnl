/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Inter Tight', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      colors: {
        bg: { light: '#F6F4EE', dark: '#0E1116' },
        card: { light: '#FFFFFF', dark: '#161B23' },
        ink: { DEFAULT: '#0E1116', soft: '#3B4252' },
        line: { light: '#E6E2D6', dark: '#252B36' },
        brand: {
          blue: '#1F6FEB',
          'blue-soft': '#CFE0FF',
          grey: '#D9D6CB',
          green: '#1F8A4C',
          'green-soft': '#D8F0DF',
          red: '#C0392B',
          'red-soft': '#F8DAD3',
          amber: '#B7791F',
          'amber-soft': '#FBE8C2'
        }
      }
    }
  },
  plugins: []
}
