import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const host = process.env.TAURI_DEV_HOST;
const isTauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM);

export default defineConfig({
  plugins: [
    react(),
    VitePWA(isTauriBuild ? {
      injectRegister: false,
      manifest: false,
      selfDestroying: true,
    } : {
      registerType: "prompt",
      includeAssets: ["worktools.svg", "worktools-32.png", "worktools-180.png", "worktools-192.png", "worktools-512.png"],
      manifest: {
        name: "worktools",
        short_name: "worktools",
        description: "本地优先的 JSON、XML、Diff 与 Cron 工作台",
        theme_color: "#f7f8fa",
        background_color: "#f7f8fa",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "worktools-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "worktools-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024
      }
    })
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] }
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1800,
    rolldownOptions: {
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          groups: [
            {
              name: "monaco-core",
              test: /node_modules[\\/]monaco-editor[\\/]/,
              maxSize: 3 * 1024 * 1024,
            },
          ],
        },
      },
    },
  }
});