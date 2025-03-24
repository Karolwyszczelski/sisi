/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-montserrat)", "sans-serif"],
        marker: ["var(--font-marker)", "cursive"],
        "permanent-marker": ['var(--font-permanent)', 'cursive'],
        covered: ['var(--font-covered)', 'cursive'],
        smooch: ["var(--font-smooch)", "cursive"],
        impact: ['var(--font-impact)', 'Impact', 'sans-serif'],

      },
      colors: {
        primary: "#ff3b3f", // czerwony jak w Webflow
        dark: "#1a1a1a",
        light: "#ffffff",
      },
    },
  },
  plugins: [],
};
