import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { InterceptedAction } from "@liminal-engine/contracts";
import type { PolicyMode, ProxyScope } from "@liminal-engine/policy";
import type {
  OperatorVerdictInput,
  InterceptGateway,
  ProxyOutcomeInput,
  RepeaterInput,
} from "./gateway.ts";
import type { MatchReplaceRule } from "./match-replace.ts";

export function createDecisionServer(gateway: InterceptGateway): http.Server {
  return http.createServer((req, res) => {
    void route(req, res, gateway);
  });
}

async function route(
  req: IncomingMessage,
  res: ServerResponse,
  gateway: InterceptGateway,
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, await gateway.health());
      return;
    }

    if (req.method === "GET" && url.pathname === "/queue") {
      sendJson(res, 200, await gateway.pending());
      return;
    }

    if (req.method === "GET" && url.pathname === "/history") {
      sendJson(res, 200, await gateway.history({
        ...(url.searchParams.get("tool") !== null ? { tool: url.searchParams.get("tool")! } : {}),
        ...(url.searchParams.get("action") !== null ? { action: url.searchParams.get("action")! } : {}),
        ...(url.searchParams.get("verdict") !== null
          ? { verdict: url.searchParams.get("verdict") as "allow" | "deny" | "ask" }
          : {}),
        ...(url.searchParams.get("inScopeOnly") === "true" ? { inScopeOnly: true } : {}),
      }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/mode") {
      const body = await readJson(req);
      if (!isRecord(body) || !isPolicyMode(body["mode"])) {
        sendJson(res, 400, { error: "mode must be shadow, intercept, or learned" });
        return;
      }
      gateway.setMode(body["mode"]);
      sendJson(res, 200, await gateway.health());
      return;
    }

    if (req.method === "GET" && url.pathname === "/scope") {
      sendJson(res, 200, gateway.scope() ?? null);
      return;
    }

    if (req.method === "POST" && url.pathname === "/scope") {
      const body = await readJson(req);
      gateway.setScope(body === null ? undefined : body as ProxyScope);
      sendJson(res, 200, gateway.scope() ?? null);
      return;
    }

    if (req.method === "GET" && url.pathname === "/match-replace") {
      sendJson(res, 200, gateway.matchReplaceRules());
      return;
    }

    if (req.method === "POST" && url.pathname === "/match-replace") {
      const body = await readJson(req);
      if (!Array.isArray(body)) {
        sendJson(res, 400, { error: "match-replace body must be an array of rules" });
        return;
      }
      gateway.setMatchReplaceRules(body as MatchReplaceRule[]);
      sendJson(res, 200, gateway.matchReplaceRules());
      return;
    }

    if (req.method === "POST" && url.pathname === "/intercept") {
      const body = await readJson(req);
      sendJson(res, 200, await gateway.intercept(body as InterceptedAction));
      return;
    }

    if (req.method === "POST" && url.pathname === "/forward") {
      const body = await readJson(req);
      sendJson(res, 200, await gateway.forward(body as Omit<OperatorVerdictInput, "verdict">));
      return;
    }

    if (req.method === "POST" && url.pathname === "/forward-all") {
      const body = await readJson(req);
      sendJson(res, 200, await gateway.forwardAll(isRecord(body) ? body : {}));
      return;
    }

    if (req.method === "POST" && url.pathname === "/drop") {
      const body = await readJson(req);
      sendJson(res, 200, await gateway.drop(body as Omit<OperatorVerdictInput, "verdict">));
      return;
    }

    if (req.method === "POST" && url.pathname === "/drop-all") {
      const body = await readJson(req);
      sendJson(res, 200, await gateway.dropAll(body as { reason: string; activate?: boolean }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/verdict") {
      const body = await readJson(req);
      sendJson(res, 200, await gateway.operatorVerdict(body as OperatorVerdictInput));
      return;
    }

    if (req.method === "POST" && url.pathname === "/repeater") {
      const body = await readJson(req);
      sendJson(res, 200, await gateway.repeater(body as RepeaterInput));
      return;
    }

    if (req.method === "POST" && url.pathname === "/outcome") {
      const body = await readJson(req);
      sendJson(res, 200, await gateway.recordOutcome(body as ProxyOutcomeInput));
      return;
    }

    sendJson(res, 404, { error: "not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    sendJson(res, 400, { error: message });
  }
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length === 0 ? {} : JSON.parse(raw);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPolicyMode(value: unknown): value is PolicyMode {
  return value === "shadow" || value === "intercept" || value === "learned";
}
