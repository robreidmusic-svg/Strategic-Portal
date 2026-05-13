import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.CUSTOM_GEMINI_API_KEY': JSON.stringify(env.CUSTOM_GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      target: 'esnext',
      minify: 'esbuild',
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-base': ['react', 'react-dom'],
            'vendor-viz': ['deck.gl', 'maplibre-gl', 'recharts', 'motion'],
            'vendor-utils': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'pdfjs-dist', 'jszip', 'mammoth'],
          },
        },
      },
    },
  };
});
