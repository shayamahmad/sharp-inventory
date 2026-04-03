import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  /** Keep Vite’s “Local: http://…” line visible after startup */
  clearScreen: false,
  server: {
    host: true,
    port: 8080,
    /** If 8080 is taken (Docker, Java, another Vite app), Vite uses 8081, 8082, … */
    strictPort: false,
    /** Opens your default browser to the URL Vite actually bound to */
    open: true,
    hmr: {
      overlay: true,
    },
    // Forward /api/* to Express (backend PORT, default 3001). Requires `npm run api` or `npm run dev:full`.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
});
