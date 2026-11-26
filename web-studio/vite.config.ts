import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleStudioRequest } from "./server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function studioApiPlugin(): Plugin {
  return {
    name: "nalatoon-studio-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        if (url.startsWith("/api/") || url.startsWith("/media/")) {
          handleStudioRequest(req, res);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [react(), studioApiPlugin()],
  resolve: {
    alias: {
      "@studio": path.resolve(projectRoot, "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    fs: {
      allow: [projectRoot],
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: "esnext",
  },
});
