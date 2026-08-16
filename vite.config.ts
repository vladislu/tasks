import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages project sites are served from https://<user>.github.io/<repo>/,
 * so the bundle needs a matching base path. The deploy workflow passes the repo
 * name in BASE_PATH; local dev and user/organisation sites use '/'.
 */
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Mermaid is imported dynamically (see components/MermaidDiagram.tsx), so
    // its large chunks are never part of the initial download.
    chunkSizeWarningLimit: 900,
  },
});
