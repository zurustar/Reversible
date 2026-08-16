import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: './',
  // Stamp the build time and the package version so the UI shows which build is
  // loaded. The version is visible in the shipped file itself, so a release tag
  // that disagrees with package.json can be spotted instead of going unnoticed.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // Inline all JS/CSS into a single self-contained index.html so it can be
  // opened directly from the filesystem (file://) with no server.
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
