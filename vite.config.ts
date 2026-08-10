import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: "./",

    plugins: [
      react(),
      tailwindcss(),
    ],

    define: {
      "process.env.APP_URL": JSON.stringify(env.APP_URL || ""),
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },

    build: {
      chunkSizeWarningLimit: 2000,

      rollupOptions: {
        external: [
          "capacitor-thermal-printer",
          "@capacitor/app",
        ],
      },
    },

    server: {
      cors: true,

      hmr: process.env.DISABLE_HMR !== "true",

      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});