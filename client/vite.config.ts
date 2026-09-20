import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isLocal = process.env.VITE_LOCAL_MODE === 'true';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5173,
      proxy: isLocal
        ? {
            '/api': {
              target: 'http://127.0.0.1:8787',
              changeOrigin: true,
              ws: true,
              rewrite: (path) => path.replace(/^\/api/, ''),
            },
          }
        : {
            '/api': {
              target: 'http://127.0.0.1:8787',
              changeOrigin: true,
              ws: true,
              rewrite: (path) => path.replace(/^\/api/, ''),
            },
          },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      emptyOutDir: true,
    },
    define: {
      __LOCAL_MODE__: JSON.stringify(isLocal),
    },
  };
});
