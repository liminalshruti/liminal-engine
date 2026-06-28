import { once } from "node:events";
import type { Readable, Writable } from "node:stream";
import type { InterceptedAction } from "@liminal-engine/contracts";
import type { PolicyMode, ProxyScope } from "@liminal-engine/policy";
import { createDecisionServer } from "./server.ts";
import { createGatewayRuntime } from "./runtime.ts";
import type { MatchReplaceRule } from "./match-replace.ts";

export interface PolicyGwCliDeps {
  stdin: Readable;
  stdout: Pick<Writable, "write">;
  stderr: Pick<Writable, "write">;
  fetch: typeof fetch;
}

interface ParsedCli {
  url: string;
  json: boolean;
  command: string;
  args: string[];
}

const DEFAULT_URL = "http://127.0.0.1:17373";

export async function runPolicyGwCli(argv: readonly string[], deps: PolicyGwCliDeps): Promise<number> {
  try {
    const parsed = parseGlobalArgs(argv);
    switch (parsed.command) {
      case "serve":
        return await serve(parsed.args, deps);
      case "health":
        return await printResponse(deps, parsed, request(deps, parsed.url, "GET", "/health"));
      case "metrics":
        return await printResponse(deps, parsed, request(deps, parsed.url, "GET", "/metrics"));
      case "queue":
        return await printResponse(deps, parsed, request(deps, parsed.url, "GET", "/queue"));
      case "history":
        return await printResponse(deps, parsed, request(deps, parsed.url, "GET", `/history${historyQuery(parsed.args)}`));
      case "mode":
        return await printResponse(deps, parsed, request(deps, parsed.url, "POST", "/mode", { mode: requireArg(parsed.args, 0, "mode") }));
      case "scope":
        return await scopeCommand(parsed, deps);
      case "match-replace":
        return await matchReplaceCommand(parsed, deps);
      case "intercept":
        return await printResponse(
          deps,
          parsed,
          request(deps, parsed.url, "POST", "/intercept", readActionArg(parsed.args)),
        );
      case "forward":
        return await verdictCommand(parsed, deps, "/forward");
      case "drop":
        return await verdictCommand(parsed, deps, "/drop");
      case "repeater":
        return await printResponse(deps, parsed, request(deps, parsed.url, "POST", "/repeater", repeaterBody(parsed.args)));
      case "help":
      case "":
        deps.stdout.write(helpText());
        return 0;
      default:
        deps.stderr.write(`unknown command: ${parsed.command}\n${helpText()}`);
        return 2;
    }
  } catch (error) {
    deps.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

function parseGlobalArgs(argv: readonly string[]): ParsedCli {
  let url = process.env["POLICY_GW_URL"] ?? DEFAULT_URL;
  let json = false;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--url") {
      url = requireArg(argv, ++i, "--url value");
    } else if (arg === "--json") {
      json = true;
    } else {
      rest.push(arg);
    }
  }
  return {
    url: url.replace(/\/+$/, ""),
    json,
    command: rest[0] ?? "",
    args: rest.slice(1),
  };
}

async function serve(args: readonly string[], deps: PolicyGwCliDeps): Promise<number> {
  const host = readOption(args, "--host") ?? "127.0.0.1";
  const port = Number(readOption(args, "--port") ?? "17373");
  const mode = (readOption(args, "--mode") ?? "intercept") as PolicyMode;
  const sessionDir = readOption(args, "--session-dir");
  if (!["shadow", "intercept", "learned"].includes(mode)) {
    throw new Error("serve --mode must be shadow, intercept, or learned");
  }

  const runtime = createGatewayRuntime({
    mode,
    ...(sessionDir !== undefined ? { sessionDir } : {}),
  });
  const server = createDecisionServer(runtime.gateway, {
    activeRules: () => runtime.policyStore.activeRules(),
  });
  server.listen(port, host);
  await once(server, "listening");
  deps.stdout.write(
    `policy-gw listening on http://${host}:${port} mode=${mode}${sessionDir === undefined ? "" : ` session=${sessionDir}`}\n`,
  );
  await Promise.race([
    once(server, "close"),
    once(deps.stdin, "end").then(() => server.close()),
  ]);
  return 0;
}

async function scopeCommand(parsed: ParsedCli, deps: PolicyGwCliDeps): Promise<number> {
  const sub = parsed.args[0] ?? "get";
  if (sub === "get") return printResponse(deps, parsed, request(deps, parsed.url, "GET", "/scope"));
  if (sub === "clear") return printResponse(deps, parsed, request(deps, parsed.url, "POST", "/scope", null));
  if (sub === "set") {
    return printResponse(
      deps,
      parsed,
      request(deps, parsed.url, "POST", "/scope", parseJsonArg<ProxyScope>(parsed.args, 1, "scope json")),
    );
  }
  throw new Error("scope command must be get, set, or clear");
}

async function matchReplaceCommand(parsed: ParsedCli, deps: PolicyGwCliDeps): Promise<number> {
  const sub = parsed.args[0] ?? "get";
  if (sub === "get") return printResponse(deps, parsed, request(deps, parsed.url, "GET", "/match-replace"));
  if (sub === "set") {
    return printResponse(
      deps,
      parsed,
      request(deps, parsed.url, "POST", "/match-replace", parseJsonArg<MatchReplaceRule[]>(parsed.args, 1, "rules json")),
    );
  }
  throw new Error("match-replace command must be get or set");
}

async function verdictCommand(parsed: ParsedCli, deps: PolicyGwCliDeps, path: "/forward" | "/drop"): Promise<number> {
  const queueId = requireArg(parsed.args, 0, "queue id");
  const reason = readOption(parsed.args, "--reason") ?? "";
  const activate = parsed.args.includes("--activate");
  const edit = readOption(parsed.args, "--edit-json");
  return printResponse(
    deps,
    parsed,
    request(deps, parsed.url, "POST", path, {
      queueId,
      reason,
      ...(activate ? { activate: true } : {}),
      ...(edit !== undefined ? { editedAction: parseJson<InterceptedAction>(edit, "--edit-json") } : {}),
    }),
  );
}

function readActionArg(args: readonly string[]): InterceptedAction {
  const raw = readOption(args, "--action-json") ?? requireArg(args, 0, "action json or --action-json");
  return parseJson<InterceptedAction>(raw, "action json");
}

function repeaterBody(args: readonly string[]): Record<string, unknown> {
  const historyId = readOption(args, "--history");
  const actionJson = readOption(args, "--action-json");
  const mode = readOption(args, "--mode");
  return {
    ...(historyId !== undefined ? { historyId } : {}),
    ...(actionJson !== undefined ? { action: parseJson<InterceptedAction>(actionJson, "--action-json") } : {}),
    ...(mode !== undefined ? { mode } : {}),
    ...(args.includes("--no-match-replace") ? { applyMatchReplace: false } : {}),
  };
}

function historyQuery(args: readonly string[]): string {
  const params = new URLSearchParams();
  for (const key of ["--tool", "--action", "--verdict"] as const) {
    const value = readOption(args, key);
    if (value !== undefined) params.set(key.slice(2), value);
  }
  if (args.includes("--in-scope-only")) params.set("inScopeOnly", "true");
  const out = params.toString();
  return out.length > 0 ? `?${out}` : "";
}

async function request(
  deps: PolicyGwCliDeps,
  baseUrl: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const response = await deps.fetch(`${baseUrl}${path}`, body === undefined
    ? { method }
    : {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
  const text = await response.text();
  const parsed = text.length === 0 ? null : JSON.parse(text) as unknown;
  if (!response.ok) {
    throw new Error(isErrorResponse(parsed) ? parsed.error : `HTTP ${response.status}`);
  }
  return parsed;
}

async function printResponse(
  deps: PolicyGwCliDeps,
  parsed: ParsedCli,
  response: Promise<unknown>,
): Promise<number> {
  const body = await response;
  deps.stdout.write(parsed.json ? `${JSON.stringify(body)}\n` : `${JSON.stringify(body, null, 2)}\n`);
  return 0;
}

function readOption(args: readonly string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return requireArg(args, i + 1, `${name} value`);
}

function parseJsonArg<T>(args: readonly string[], index: number, label: string): T {
  return parseJson<T>(requireArg(args, index, label), label);
}

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`invalid ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function requireArg(args: readonly string[], index: number, label: string): string {
  const value = args[index];
  if (value === undefined || value.length === 0) throw new Error(`missing ${label}`);
  return value;
}

function isErrorResponse(value: unknown): value is { error: string } {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && typeof (value as Record<string, unknown>)["error"] === "string";
}

function helpText(): string {
  return [
    "policy-gw --url <gateway> <command>",
    "",
    "Commands:",
    "  serve [--host 127.0.0.1] [--port 17373] [--mode shadow|intercept|learned] [--session-dir path]",
    "  health",
    "  metrics",
    "  mode <shadow|intercept|learned>",
    "  queue",
    "  history [--tool gh] [--action pr-merge] [--verdict ask|deny|allow] [--in-scope-only]",
    "  scope get|clear|set '<json>'",
    "  match-replace get|set '<json-array>'",
    "  intercept --action-json '<InterceptedAction json>'",
    "  forward <queue-id> [--reason text] [--edit-json '<InterceptedAction json>']",
    "  drop <queue-id> --reason text [--activate] [--edit-json '<InterceptedAction json>']",
    "  repeater --history <history-id> [--mode shadow|intercept|learned] [--no-match-replace]",
    "  repeater --action-json '<InterceptedAction json>' [--mode shadow|intercept|learned]",
    "",
  ].join("\n");
}
