module.exports = {
  content: ["./App.tsx", "./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0f0f0f",
          surface: "#1a1a1a",
          accent: "#6366f1",
          text: "#f4f4f5",
          muted: "#71717a",
        },
      },
    },
  },
}
