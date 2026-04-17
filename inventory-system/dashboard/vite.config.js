import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PROXY TARGET — switch between mock API (dev) and real API (production-ready)
// Mock API: runs on port 3456, no rewrite needed  →  USE_REAL_API=false
// Real API: runs on port 3100, needs /api → /api/v1  →  USE_REAL_API=true
const USE_REAL_API = false;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': USE_REAL_API
        ? {
            target: 'http://localhost:3100',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
          }
        : {
            target: 'http://localhost:3456',
            changeOrigin: true,
          },
    },
  },
});
