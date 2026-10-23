import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  /* npm run dev serves the site; the API lives in the local backend
     on 4000 (npm run server), so the dev server forwards /api to it. */
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true }
    }
  },
  preview: { port: 4173, host: true }
});
