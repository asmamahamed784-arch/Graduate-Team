/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4f9',
          100: '#dce6f2',
          200: '#bfd1e6',
          300: '#93b2d6',
          400: '#608ec3',
          500: '#4189DD',
          600: '#2c5691',
          700: '#1a365d',
          800: '#10223e',
          900: '#0a1427',
        },
        accent: {
          50: '#fef3c7',
          500: '#F59E0B',
          600: '#d97706',
          700: '#b45309',
        },
        secondary: {
          50: '#f0fdfa',
          500: '#14B8A6',
          600: '#0d9488',
          700: '#0f766e',
        }
      }
    },
  },
  plugins: [],
}
