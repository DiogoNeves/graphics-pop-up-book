import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build works under GitHub Pages' /<repo>/ subpath.
  base: './',
  build: { target: 'esnext' },
  esbuild: { target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
});
