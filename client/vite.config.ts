import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  server: {
    proxy: {
      // API_URL lets a second API (another port, another database) be used without touching the default one.
      "/api": process.env.API_URL ?? "http://127.0.0.1:3000",
    },
  },
});
