import { fileURLToPath } from "node:url";
import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL("../../", import.meta.url));
  const env = loadEnv(mode, envDir, "");
  const target = `http://127.0.0.1:${env.API_PORT || "3000"}`;
  return {
    envDir,
    plugins: [react(), tailwind()],
    server: {
      port: Number(env.WEB_PORT || 5180),
      strictPort: true,
      proxy: { "/api": { target, rewrite: (path) => path.slice(4) } },
    },
  };
});
