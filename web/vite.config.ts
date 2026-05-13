import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import svgr from "vite-plugin-svgr"
import path from "path"

export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  resolve: { alias: { "@shared": path.resolve(__dirname, "../shared") } },
})
