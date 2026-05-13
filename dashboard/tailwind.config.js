/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#09090b",
          surface: "#18181b",
          border: "#27272a",
          text: "#fafafa",
          muted: "#71717a",
          accent: "#6366f1",
        },
      },
    },
  },
  plugins: [],
}
