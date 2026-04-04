import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import dotenv from "dotenv";
import { readFileSync } from "fs";

// Load environment variables
dotenv.config();

const pkg = JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf-8")) as { version?: string };

export default defineConfig({
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'http://localhost:3000/api'),
    'import.meta.env.VITE_ENV': JSON.stringify(process.env.VITE_ENV || 'development'),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.VITE_APP_VERSION || pkg.version || '1.0.0'),
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
    strictPort: false,
    fs: {
      // allow Vite to access parent folder so it can read ../shared/src
      allow: [path.resolve(__dirname, "..")]
    }
  },
  build: {
    outDir: "dist",
    assetsDir: "assets"
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
});
