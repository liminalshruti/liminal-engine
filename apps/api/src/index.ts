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
import { livekitRouter } from "./routes/livekit.ts";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

interface RouteHandler {
  (req: IncomingMessage, res: ServerResponse, pathParams: Record<string, string>): Promise<void>;
}

interface Route {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: RegExp;
  handler: RouteHandler;
}

// No module-level governance state: every request builds its own fresh, isolated
// in-memory stores + idGen inside the route handlers, so concurrent/repeated
// requests over arbitrary posted data never bleed into one another.

// Route registry
const routes: Route[] = [
  // Governance endpoints — operate on ARBITRARY posted agent output (no fixtures).
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
  {
    method: "GET",
    path: /^\/governance\/example$/,
    handler: (req, res) => governanceRouter.example(req, res),
  },
  // LiveKit join-token minting (server-side; secret never reaches the browser).
  {
    method: "POST",
    path: /^\/livekit\/token$/,
    handler: (req, res) => livekitRouter.token(req, res),
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
// the test suite, which imports `server`). Importing must not bind a port, or
// it leaks a real :3000 server past the test (EADDRINUSE / async-after-test).
const isEntryPoint =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isEntryPoint) {
  server.listen(PORT, () => {
    console.log(`Liminal Engine API server listening on http://localhost:${PORT}`);
    console.log(`POST /governance/detect — { agentOutput, caseEvidence? } → open a case for a dropped requirement`);
    console.log(`POST /governance/enforce — { governanceCaseId, dealId, currentStatus } → enforce the correction`);
    console.log(`POST /governance/eval — { agentOutputPass1, agentOutputPass2 } → grade the Fail→Pass table`);
    console.log(`POST /governance/loop — { agentOutputPass1, agentOutputPass2, caseEvidence? } → run the full loop`);
    console.log(`GET /governance/example — example request bodies to try on your own data`);
    console.log(`POST /livekit/token — { room, identity } → mint a LiveKit join token (503 if creds not configured)`);
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
