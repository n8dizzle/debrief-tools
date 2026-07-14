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
        // Christmas Air Brand Colors — bound to CSS vars so they flip with the
        // portal light/dark theme (see globals.css :root + [data-theme="light"]).
        // cream/gold stay fixed: cream is text-on-green (always light), gold is a static accent.
        christmas: {
          green: 'var(--christmas-green)',
          'green-dark': 'var(--christmas-green-dark)',
          'green-light': 'var(--christmas-green-light)',
          cream: '#F5F0E1',
          brown: 'var(--christmas-brown)',
          'brown-light': 'var(--christmas-brown-light)',
          gold: '#B8956B',
        },
        // Background Colors (flip with theme)
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          card: 'var(--bg-card)',
          'card-hover': 'var(--bg-card-hover)',
        },
        // Text Colors (flip with theme)
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        // Border Colors (flip with theme)
        border: {
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
