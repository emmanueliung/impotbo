import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Redirige las llamadas /api al backend Express
      '/api': 'http://localhost:3000',
    },
  },
});
