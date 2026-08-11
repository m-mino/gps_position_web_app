import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "public/assets",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        map: "client/map.ts",
      },
      output: {
        entryFileNames: "[name].js",
        assetFileNames: "[name][extname]",
        chunkFileNames: "[name]-[hash].js",
      },
    },
  },
});
