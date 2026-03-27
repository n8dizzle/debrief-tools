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
          DEFAULT: '#3B9B8F',
          dark: '#2D7A70',
          light: '#4DB8AA',
        },
        secondary: {
          DEFAULT: '#059669',
        },
        accent: {
          DEFAULT: '#F59E0B',
        },
      },
    },
  },
  plugins: [],
};
