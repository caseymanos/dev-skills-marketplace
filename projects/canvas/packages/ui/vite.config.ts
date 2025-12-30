import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@canvas/contracts': resolve(__dirname, '../../contracts'),
    },
  },
  server: {
    port: 3000,
  },
});
