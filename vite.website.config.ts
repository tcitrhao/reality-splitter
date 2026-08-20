import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { productVersionDefine } from "./vite.version";

const resolveFromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: "./",
  define: productVersionDefine,
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: "site-dist",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        index: resolveFromRoot("./index.html"),
        methods: resolveFromRoot("./methods.html"),
        factSources: resolveFromRoot("./fact-sources.html"),
        antiManipulation: resolveFromRoot("./anti-manipulation.html"),
        iterations: resolveFromRoot("./iterations.html"),
        meditations: resolveFromRoot("./meditations.html"),
        about: resolveFromRoot("./about.html"),
        privacy: resolveFromRoot("./privacy.html"),
        studio: resolveFromRoot("./studio.html")
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
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
