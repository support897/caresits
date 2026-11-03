import { defineConfig } from "vite"; import react from "@vitejs/plugin-react";
export default defineConfig({ base: "./", plugins: [react()], build: { outDir: "../www/app3", emptyOutDir: true, target: "es2020" }, server: { fs: { allow: [".."] } } });
