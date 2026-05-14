import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import svgr from "vite-plugin-svgr"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

export default defineConfig({
  plugins: [tailwindcss(), react(), svgr()],
  server: { port: 5173 },
  resolve: { alias: { "@shared": path.resolve(__dirname, "../shared") } },
})
