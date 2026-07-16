/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./js/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2c52b3',
        secondary: '#5a5b6d',
        accent: '#fff867',
        danger: '#fb2f38',
        surface: '#f8fafc',
        'primary-light': '#e8edf7',
        'secondary-light': '#eef0f4',
      },
    },
    fontFamily: {
      'heading': ['Space Grotesk', 'sans-serif'],
      'body': ['Inter', 'sans-serif'],
      'mono': ['JetBrains Mono', 'monospace'],
    },
  },
}