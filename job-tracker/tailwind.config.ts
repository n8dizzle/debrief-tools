import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Christmas Air Brand Colors
        christmas: {
          green: '#5D8A66',
          'green-dark': '#4A7053',
          'green-light': '#6B9B75',
          cream: '#F5F0E1',
          brown: '#7B3F3F',
          'brown-light': '#9B5555',
          gold: '#B8956B',
        },
        // Dark Mode Background Colors
        bg: {
          primary: '#0F1210',
          secondary: '#161B18',
          card: '#1C231E',
          'card-hover': '#232B26',
        },
        // Text Colors
        text: {
          primary: '#F5F0E1',
          secondary: '#A8B5AB',
          muted: '#6B7C6E',
        },
        // Border Colors
        border: {
          subtle: '#2A3530',
          default: '#3A4840',
        },
      },
    },
  },
  plugins: [],
};

export default config;
