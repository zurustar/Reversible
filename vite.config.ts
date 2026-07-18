import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  // Stamp the build time so the UI can show which build is loaded.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // Inline all JS/CSS into a single self-contained index.html so it can be
  // opened directly from the filesystem (file://) with no server.
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
