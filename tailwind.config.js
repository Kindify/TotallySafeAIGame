/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"IBM Plex Mono"', '"Fira Code"', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
};
