import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Change '/poker-club/' to match your GitHub repo name
const BASE = process.env.VITE_BASE_PATH || '/poker-club/'

export default defineConfig({
  plugins: [react()],
  base: BASE,
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
  },
})
