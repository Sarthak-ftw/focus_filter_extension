import { defineConfig } from 'vite';
import { resolve } from 'path';

// Content script config: builds an isolated, self-contained IIFE bundle for YouTube
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Keep popup and background from primary build
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'FocusFilterContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
