import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The demo spine is the composition root. It resolves the contracts package
// (and only the contracts package, via fixtures) directly from workspace source
// so the static click-through renders deterministic Acme data — no build step
// for the kernel, no live integrations on the spine (DEMO_CONTRACT cut-if-risky).
// The LiveKit token endpoint lives on the apps/api server (default :3000). In dev
// we proxy /livekit/* there so the browser fetches a server-minted token without
// the LiveKit API secret ever touching the client bundle. Override the target
// with VITE_API_PROXY_TARGET when the api runs elsewhere.
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    open: true,
    proxy: {
      "/livekit": { target: apiProxyTarget, changeOrigin: true },
    },
  },
  build: { outDir: "dist", sourcemap: true },
});
