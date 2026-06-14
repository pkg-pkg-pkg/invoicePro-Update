import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import dotenv from "dotenv";
import { readFileSync } from "fs";

// Load environment variables (project root + desktop folder)
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config();

const pkg = JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf-8")) as { version?: string };

const FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

function assertProductionEnv(command: string, mode: string) {
  if (command !== 'build' || mode !== 'production') return;

  const missingFirebase = FIREBASE_ENV_KEYS.filter((key) => !String(process.env[key] || '').trim());
  if (missingFirebase.length > 0) {
    throw new Error(
      `Production build blocked: missing Firebase configuration (${missingFirebase.join(', ')}).`
    );
  }

  if (!String(process.env.VITE_API_URL || '').trim()) {
    throw new Error('Production build blocked: VITE_API_URL is required.');
  }
}

export default defineConfig(({ command, mode }) => {
  assertProductionEnv(command, mode);
  const isProdBuild = command === 'build' && mode === 'production';
  const apiUrl = process.env.VITE_API_URL?.trim()
    || (isProdBuild ? '' : 'http://localhost:3000/api');

  return {
  base: "./",
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    'import.meta.env.VITE_ENV': JSON.stringify(process.env.VITE_ENV || (isProdBuild ? 'production' : 'development')),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.VITE_APP_VERSION || pkg.version || '1.0.0'),
    'import.meta.env.VITE_GEMINI_KEY': JSON.stringify(process.env.VITE_GEMINI_KEY || ''),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // During local development, resolve the shared package to its source so Vite compiles it to ESM
      "@gst-billing/shared": path.resolve(__dirname, "../shared/src"),
      "exceljs": path.resolve(__dirname, "../node_modules/exceljs/dist/exceljs.min.js")
    }
  },
  optimizeDeps: {
    include: ["@gst-billing/shared", "exceljs"]
  },
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
    fs: {
      // allow Vite to access parent folder so it can read ../shared/src
      allow: [path.resolve(__dirname, "..")]
    }
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase';
          }
          if (id.includes('node_modules/recharts')) {
            return 'charts';
          }
          if (id.includes('node_modules/@mui')) {
            return 'mui';
          }
          if (id.includes('node_modules/exceljs')) {
            return 'excel';
          }
          if (id.includes('/pages/GST/') || id.includes('gstService') || id.includes('gstReportExport')) {
            return 'gst';
          }
          if (id.includes('/pages/Settings') || id.includes('BackupRestore') || id.includes('WhatsAppSettings')) {
            return 'settings';
          }
        },
      },
    },
  },
  plugins: [
    react(),
    // Post-build plugin to fix asset paths for Electron
    {
      name: 'fix-electron-paths',
      writeBundle() {
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(__dirname, 'dist', 'index.html');

        if (fs.existsSync(htmlPath)) {
          let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
          // Replace absolute paths with relative paths
          htmlContent = htmlContent.replace(/href="\/assets\//g, 'href="./assets/');
          htmlContent = htmlContent.replace(/src="\/assets\//g, 'src="./assets/');
          htmlContent = htmlContent.replace(/href="\/vite.svg"/g, 'href="./vite.svg"');

          fs.writeFileSync(htmlPath, htmlContent);
        }
      }
    }
  ]
};
});
