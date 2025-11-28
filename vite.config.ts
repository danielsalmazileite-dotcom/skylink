import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  cacheDir: 'C:/Users/danie/AppData/Local/Temp/skylink-vite-cache',
  optimizeDeps: {
    exclude: ['lucide-react'],
    dedupe: ['react', 'react-dom'],
  },
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'lucide-react': path.resolve(__dirname, 'node_modules/lucide-react'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['skylinkwebchat.com', 'www.skylinkwebchat.com', 'skylinkwebchat.loca.lt'],
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'preview-dist',
    emptyOutDir: true,
  },
});
