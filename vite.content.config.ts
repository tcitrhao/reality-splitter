import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { productVersionDefine } from "./vite.version";

const resolveFromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  define: {
    ...productVersionDefine,
    "process.env.NODE_ENV": JSON.stringify("production")
  },
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "es2022",
    lib: {
      entry: resolveFromRoot("./src/content/contentScript.ts"),
      name: "RealitySplitterContent",
      formats: ["iife"],
      fileName: () => "contentScript.js"
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
