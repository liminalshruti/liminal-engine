/**
 * Liminal Engine governance loop as a composable HTTP service.
 *
 * Minimal Express/Node.js server that exposes the governance loop (observe → detect
 * → correct → enforce → audit → improve) as POST endpoints. Accepts fixture JSON,
 * returns contract JSON. No database — all state is in-memory for the demo.
 *
 * OWNS: apps/api/package.json, apps/api/src/index.ts, apps/api/src/routes/governance.ts, apps/api/test/api.test.ts
 * TOUCHES SPINE: false
 *
 * Not integrated into desktop-demo — exists to demonstrate the loop is composable as a service.
 */
import { createServer } from "node:http";
import { URL } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { governanceRouter } from "./routes/governance.ts";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

interface RouteHandler {
  (req: IncomingMessage, res: ServerResponse, pathParams: Record<string, string>): Promise<void>;
}

interface Route {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: RegExp;
  handler: RouteHandler;
}

// In-memory state for the demo
export const apiState = {
  governanceCases: new Map(),
  auditEvents: new Map(),
  actionGates: new Map(),
  evalResults: new Map(),
};

// Route registry
const routes: Route[] = [
  // Governance endpoints
  {
    method: "POST",
    path: /^\/governance\/detect$/,
    handler: (req, res) => governanceRouter.detect(req, res),
  },
  {
    method: "POST",
    path: /^\/governance\/enforce$/,
    handler: (req, res) => governanceRouter.enforce(req, res),
  },
  {
    method: "POST",
    path: /^\/governance\/eval$/,
    handler: (req, res) => governanceRouter.eval(req, res),
  },
  {
    method: "POST",
    path: /^\/governance\/loop$/,
    handler: (req, res) => governanceRouter.loop(req, res),
  },
  // Health check
  {
    method: "GET",
    path: /^\/health$/,
    handler: async (req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    },
  },
];

// Simple routing dispatcher
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", `http://localhost`);
  const pathname = url.pathname;

  // Find matching route
  const route = routes.find(
    (r) => r.method === req.method && r.path.test(pathname)
  );

  if (route) {
    // Extract path parameters (simplified for this MVP)
    const match = route.path.exec(pathname);
    const pathParams = match ? match.slice(1).reduce((acc, val, idx) => {
      acc[`param${idx}`] = val;
      return acc;
    }, {} as Record<string, string>) : {};

    try {
      await route.handler(req, res, pathParams);
    } catch (err) {
      console.error("Route error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
}

// Create the server. Export it so tests can drive it without a real listen().
const server = createServer(handleRequest);
export { server };

// Only start listening when run as the entry point — NOT when imported (e.g. by
// the test suite, which imports `apiState`). Importing must not bind a port, or
// it leaks a real :3000 server past the test (EADDRINUSE / async-after-test).
const isEntryPoint =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isEntryPoint) {
  server.listen(PORT, () => {
    console.log(`Liminal Engine API server listening on http://localhost:${PORT}`);
    console.log(`POST /governance/detect — run detect phase`);
    console.log(`POST /governance/enforce — run enforce phase`);
    console.log(`POST /governance/eval — run eval phase`);
    console.log(`POST /governance/loop — run full loop`);
    console.log(`GET /health — health check`);
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("Shutting down server...");
    server.close(() => {
      process.exit(0);
    });
  });
}
