import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-time twin of functions/api/[[path]].ts — both must stay in agreement.
// Strip /api for everything except /api/auth (the Worker mounts auth at
// /api/auth, everything else at the root).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        rewrite: (path) =>
          path.startsWith("/api/auth") ? path : path.replace(/^\/api/, ""),
      },
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
