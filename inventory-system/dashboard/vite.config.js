import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Real API only (mock-api removed). API runs on port 3100; Vite rewrites /api → /api/v1.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
      },
    },
  },
});
