/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/shared/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F0FAF8',
          100: '#D5F0EC',
          200: '#AAE0D9',
          300: '#7FD1C5',
          400: '#54C1B2',
          500: '#3B9B8F',
          600: '#2D7A70',
          700: '#1F5A52',
          800: '#123933',
          900: '#041915',
        },
      },
    },
  },
  plugins: [],
};
