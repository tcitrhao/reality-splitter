import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { productVersionDefine } from "./vite.version";

const resolveFromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: "./",
  define: productVersionDefine,
  plugins: [react()],
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        index: resolveFromRoot("./index.html"),
        iterations: resolveFromRoot("./iterations.html"),
        meditations: resolveFromRoot("./meditations.html"),
        about: resolveFromRoot("./about.html"),
        studio: resolveFromRoot("./studio.html"),
        options: resolveFromRoot("./options.html"),
        sidepanel: resolveFromRoot("./sidepanel.html"),
        serviceWorker: resolveFromRoot("./src/background/serviceWorker.ts")
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "serviceWorker") {
            return "[name].js";
          }

          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            return "vendor";
          }

          return undefined;
        }
      }
    }
  }
});
