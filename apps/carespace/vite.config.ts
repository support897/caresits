import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const manualChunks = (id: string): string | undefined => {
  if (id.includes("/node_modules/firebase/") || id.includes("/node_modules/@firebase/")) return "firebase";
  if (["react", "react-dom", "scheduler"].some((name) => id.includes(`/node_modules/${name}/`))) return "react-vendor";
  if (["framer-motion", "motion-dom", "motion-utils"].some((name) => id.includes(`/node_modules/${name}/`))) return "motion";
  return undefined;
};

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    target: "es2020",
    chunkSizeWarningLimit: 800,
    rollupOptions: { output: { manualChunks } },
  },
  server: { fs: { allow: ["../.."] } },
});
