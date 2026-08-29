import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production' && !env.VITE_API_URL) {
    throw new Error('VITE_API_URL is required to build the staff portal for production.');
  }

  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    build: {
      sourcemap: false,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://127.0.0.1:8000',
        '/sanctum': 'http://127.0.0.1:8000',
      },
    },
  };
});
