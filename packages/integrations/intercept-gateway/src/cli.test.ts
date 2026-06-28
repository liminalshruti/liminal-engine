import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { Readable } from "node:stream";
import type { AddressInfo } from "node:net";
import type { InterceptedAction } from "@liminal-engine/contracts";
import { createDecisionServer } from "./server.ts";
import { createGatewayRuntime } from "./runtime.ts";
import { runPolicyGwCli } from "./cli.ts";

const pr20: InterceptedAction = {
  id: "ia_cli_pr20",
  tool: "gh",
  action: "pr-merge",
  target: "PR#20",
  args: { reviews: { approved: 1, rejected: 1 } },
  requestedAt: "2026-06-27T20:00:00.000Z",
};

test("policy-gw CLI drives queue, drop, mode, history, and repeater through the running gateway", async () => {
  const fixture = await startFixtureServer();
  try {
    const health = await runJson(fixture.url, ["health"]);
    assert.equal(health.mode, "intercept");
    assert.equal(health.queueDepth, 0);

    const ask = await runJson(fixture.url, ["intercept", "--action-json", JSON.stringify(pr20)]);
    assert.equal(ask.verdict, "ask");

    const queue = await runJson(fixture.url, ["queue"]) as { id: string }[];
    assert.equal(queue.length, 1);

    const dropped = await runJson(fixture.url, [
      "drop",
      queue[0]!.id,
      "--reason",
      "never merge without both reviewers approving",
      "--activate",
    ]);
    assert.equal(dropped.decision.verdict, "deny");
    assert.equal(dropped.compiledRules[0].status, "active");

    const learnedMode = await runJson(fixture.url, ["mode", "learned"]);
    assert.equal(learnedMode.mode, "learned");

    const denied = await runJson(fixture.url, [
      "intercept",
      "--action-json",
      JSON.stringify({ ...pr20, id: "ia_cli_pr35", target: "PR#35" }),
    ]);
    assert.equal(denied.verdict, "deny");
    assert.equal(denied.source, "policy");

    const history = await runJson(fixture.url, ["history", "--tool", "gh"]) as { id: string }[];
    assert.ok(history.length >= 3);

    const replay = await runJson(fixture.url, ["repeater", "--history", history[0]!.id, "--mode", "shadow"]);
    assert.equal(replay.decision.verdict, "allow");
  } finally {
    await fixture.close();
  }
});

test("policy-gw CLI updates scope and match-replace rules through the gateway", async () => {
  const fixture = await startFixtureServer();
  try {
    const scope = {
      include: [{ id: "merge-prs", tool: "gh", action: "pr-merge", targetPattern: "PR#*" }],
      exclude: [{ id: "docs-prs", tool: "gh", action: "pr-merge", targetPattern: "PR#docs-*" }],
    };
    assert.deepEqual(await runJson(fixture.url, ["scope", "set", JSON.stringify(scope)]), scope);

    const outOfScope = await runJson(fixture.url, [
      "intercept",
      "--action-json",
      JSON.stringify({ ...pr20, id: "ia_docs", target: "PR#docs-1" }),
    ]);
    assert.equal(outOfScope.source, "scope");

    const rules = [
      {
        id: "prod-to-stage",
        enabled: true,
        field: "target",
        match: "prod",
        replace: "stage",
      },
    ];
    assert.deepEqual(await runJson(fixture.url, ["match-replace", "set", JSON.stringify(rules)]), rules);
    assert.deepEqual(await runJson(fixture.url, ["match-replace", "get"]), rules);
  } finally {
    await fixture.close();
  }
});

async function startFixtureServer() {
  const runtime = createGatewayRuntime({
    clock: sequenceClock("2026-06-27T20:00:00.000Z"),
    idGen: sequenceId("cli"),
  });
  const server = createDecisionServer(runtime.gateway);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    async close(): Promise<void> {
      server.close();
      await once(server, "close");
    },
  };
}

async function runJson(url: string, args: readonly string[]): Promise<any> {
  const out = new BufferWriter();
  const err = new BufferWriter();
  const code = await runPolicyGwCli(["--url", url, "--json", ...args], {
    stdin: Readable.from([]),
    stdout: out,
    stderr: err,
    fetch,
  });
  assert.equal(code, 0, err.output);
  return JSON.parse(out.output);
}

class BufferWriter {
  output = "";
  write(chunk: string | Uint8Array): boolean {
    this.output += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }
}

function sequenceId(prefix: string) {
  let i = 0;
  return { next: () => `${prefix}_${++i}` };
}

function sequenceClock(start: string) {
  let i = 0;
  const startMs = Date.parse(start);
  return {
    now: () => new Date(startMs + i++ * 1000).toISOString(),
  };
}
