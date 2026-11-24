import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/ui'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'sidecars/agy-context-studio/public'),
    emptyOutDir: true
  }
});
