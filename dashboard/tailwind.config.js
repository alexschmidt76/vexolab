/** @type {import('tailwindcss').Config} */
import brandColors from '../shared/brandColors.css'
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brandColors
      },
    },
  },
  plugins: [],
}
