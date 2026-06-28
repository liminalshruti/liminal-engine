import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The demo spine is the composition root. It resolves the contracts package
// (and only the contracts package, via fixtures) directly from workspace source
// so the static click-through renders deterministic Acme data — no build step
// for the kernel, no live integrations on the spine (DEMO_CONTRACT cut-if-risky).
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, open: true },
  build: { outDir: "dist", sourcemap: true },
});
