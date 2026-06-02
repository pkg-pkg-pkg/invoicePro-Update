import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Vite adds crossorigin on production scripts; that blocks file:// loads in Electron. */
function stripCrossoriginForElectron() {
  return {
    name: 'strip-crossorigin-for-electron',
    transformIndexHtml(html: string) {
      return html.replace(/\s+crossorigin/g, '');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), stripCrossoriginForElectron()],
  server: {
    port: 5180,
    strictPort: true,
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist',
    modulePreload: false,
  },
});

