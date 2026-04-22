import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    // Proxy только для локальной разработки (когда нет VITE_API_URL)
    server: env.VITE_API_URL ? {} : {
      proxy: {
        '/api':       'http://localhost:3001',
        '/socket.io': { target: 'http://localhost:3001', ws: true },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
