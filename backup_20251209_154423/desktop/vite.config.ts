import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // During local development, resolve the shared package to its source so Vite compiles it to ESM
      "@gst-billing/shared": path.resolve(__dirname, "../shared/src")
    }
  },
  optimizeDeps: {
    include: ["@gst-billing/shared"]
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
    outDir: "dist"
  }
});
