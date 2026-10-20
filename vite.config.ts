import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The demo site (npm run demo, npm run demo:build). It imports the package
// from src/, so it always shows the code in this commit.
export default defineConfig({
  root: 'demo',
  base: './',
  plugins: [react()],
  build: { outDir: '../demo-dist', emptyOutDir: true },
});
