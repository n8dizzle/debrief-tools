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
        admin: {
          bg: '#F8FAFB',
          surface: '#FFFFFF',
          card: '#FFFFFF',
          border: '#E5E9EF',
          hover: '#F5F7F9',
        },
        primary: {
          DEFAULT: '#3B9B8F',
          dark: '#2D7A70',
          light: '#4DB8AA',
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
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
        muted: '#8C95A4',
      },
    },
  },
  plugins: [],
};
