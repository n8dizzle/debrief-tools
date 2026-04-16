/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-lobster)', 'cursive'],
        sans: ['var(--font-open-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        'ca-green': '#618B60',
        'ca-dark-green': '#415440',
        'ca-red': '#874C3B',
        'ca-cream': '#F5F2DC',
        'ca-light-green': '#A6994E',
      },
    },
  },
  plugins: [],
}
