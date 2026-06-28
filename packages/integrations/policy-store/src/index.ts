import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  interceptedActionContract,
  actionPolicyRuleContract,
  type ActionPolicyRule,
} from "@liminal-engine/contracts";
import type { InterceptQueue, PolicyStore, QueuedIntercept } from "@liminal-engine/policy";

export class InMemoryPolicyStore implements PolicyStore {
  private readonly rules = new Map<string, ActionPolicyRule>();

  async activeRules(): Promise<ActionPolicyRule[]> {
    return this.sortedRules().filter((rule) => rule.status === "active");
  }

  async putRule(rule: ActionPolicyRule): Promise<void> {
    const parsed = actionPolicyRuleContract.parse(rule);
    if (this.rules.has(parsed.id)) {
      throw new Error(`policy rule ${parsed.id} already exists`);
    }
    this.rules.set(parsed.id, parsed);
  }

  async updateRule(rule: ActionPolicyRule): Promise<void> {
    const parsed = actionPolicyRuleContract.parse(rule);
    if (!this.rules.has(parsed.id)) {
      throw new Error(`policy rule ${parsed.id} does not exist`);
    }
    this.rules.set(parsed.id, parsed);
  }

  async byId(id: string): Promise<ActionPolicyRule | null> {
    return this.rules.get(id) ?? null;
  }

  async allRules(): Promise<ActionPolicyRule[]> {
    return this.sortedRules();
  }

  private sortedRules(): ActionPolicyRule[] {
    return [...this.rules.values()].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
  }
}

export class FilePolicyStore implements PolicyStore {
  readonly #file: string;

  constructor(sessionDir: string) {
    this.#file = join(sessionDir, "policy-rules.json");
  }

  async activeRules(): Promise<ActionPolicyRule[]> {
    return (await this.allRules()).filter((rule) => rule.status === "active");
  }

  async putRule(rule: ActionPolicyRule): Promise<void> {
    const parsed = actionPolicyRuleContract.parse(rule);
    const rules = await this.readRules();
    if (rules.some((existing) => existing.id === parsed.id)) {
      throw new Error(`policy rule ${parsed.id} already exists`);
    }
    rules.push(parsed);
    await this.writeRules(rules);
  }

  async updateRule(rule: ActionPolicyRule): Promise<void> {
    const parsed = actionPolicyRuleContract.parse(rule);
    const rules = await this.readRules();
    const index = rules.findIndex((existing) => existing.id === parsed.id);
    if (index === -1) {
      throw new Error(`policy rule ${parsed.id} does not exist`);
    }
    rules[index] = parsed;
    await this.writeRules(rules);
  }

  async byId(id: string): Promise<ActionPolicyRule | null> {
    return (await this.readRules()).find((rule) => rule.id === id) ?? null;
  }

  async allRules(): Promise<ActionPolicyRule[]> {
    return sortRules(await this.readRules());
  }

  private async readRules(): Promise<ActionPolicyRule[]> {
    const raw = await readJsonFile(this.#file, []);
    if (!Array.isArray(raw)) throw new Error(`${this.#file} must contain an array of policy rules`);
    return raw.map((rule) => actionPolicyRuleContract.parse(rule));
  }

  private async writeRules(rules: readonly ActionPolicyRule[]): Promise<void> {
    await writeJsonFile(this.#file, sortRules(rules));
  }
}

export class InMemoryInterceptQueue implements InterceptQueue {
  private readonly items = new Map<string, QueuedIntercept>();

  async enqueue(item: QueuedIntercept): Promise<void> {
    interceptedActionContract.parse(item.action);
    if (this.items.has(item.id)) {
      throw new Error(`intercept queue item ${item.id} already exists`);
    }
    this.items.set(item.id, {
      id: item.id,
      action: item.action,
      enqueuedAt: item.enqueuedAt,
    });
  }

  async pending(): Promise<QueuedIntercept[]> {
    return [...this.items.values()].sort(
      (a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt) || a.id.localeCompare(b.id),
    );
  }

  async remove(id: string): Promise<QueuedIntercept | null> {
    const item = this.items.get(id) ?? null;
    this.items.delete(id);
    return item;
  }
}

export class FileInterceptQueue implements InterceptQueue {
  readonly #file: string;

  constructor(sessionDir: string) {
    this.#file = join(sessionDir, "intercept-queue.json");
  }

  async enqueue(item: QueuedIntercept): Promise<void> {
    const parsed = parseQueuedIntercept(item);
    const items = await this.readItems();
    if (items.some((existing) => existing.id === parsed.id)) {
      throw new Error(`intercept queue item ${parsed.id} already exists`);
    }
    items.push(parsed);
    await this.writeItems(items);
  }

  async pending(): Promise<QueuedIntercept[]> {
    return sortQueuedIntercepts(await this.readItems());
  }

  async remove(id: string): Promise<QueuedIntercept | null> {
    const items = await this.readItems();
    const item = items.find((existing) => existing.id === id) ?? null;
    if (item === null) return null;
    await this.writeItems(items.filter((existing) => existing.id !== id));
    return cloneQueuedIntercept(item);
  }

  private async readItems(): Promise<QueuedIntercept[]> {
    const raw = await readJsonFile(this.#file, []);
    if (!Array.isArray(raw)) throw new Error(`${this.#file} must contain an array of queued intercepts`);
    return raw.map(parseQueuedIntercept);
  }

  private async writeItems(items: readonly QueuedIntercept[]): Promise<void> {
    await writeJsonFile(this.#file, sortQueuedIntercepts(items));
  }
}

function sortRules(rules: readonly ActionPolicyRule[]): ActionPolicyRule[] {
  return rules
    .map((rule) => actionPolicyRuleContract.parse(rule))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

function parseQueuedIntercept(item: unknown): QueuedIntercept {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw new Error("queued intercept must be an object");
  }
  const raw = item as Record<string, unknown>;
  const id = raw["id"];
  const enqueuedAt = raw["enqueuedAt"];
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("queued intercept id is required");
  }
  if (typeof enqueuedAt !== "string" || Number.isNaN(Date.parse(enqueuedAt))) {
    throw new Error(`queued intercept ${id} enqueuedAt must be an ISO timestamp`);
  }
  return {
    id,
    action: interceptedActionContract.parse(raw["action"]),
    enqueuedAt,
  };
}

function sortQueuedIntercepts(items: readonly QueuedIntercept[]): QueuedIntercept[] {
  return items
    .map(cloneQueuedIntercept)
    .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt) || a.id.localeCompare(b.id));
}

function cloneQueuedIntercept(item: QueuedIntercept): QueuedIntercept {
  return {
    id: item.id,
    action: {
      ...item.action,
      args: structuredClone(item.action.args),
    },
    enqueuedAt: item.enqueuedAt,
  };
}

async function readJsonFile(file: string, fallback: unknown): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch (error) {
    if (isMissingFile(error)) return fallback;
    throw error;
  }
}

let tmpWriteCounter = 0;

async function writeJsonFile(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${++tmpWriteCounter}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

function isMissingFile(error: unknown): boolean {
  return error !== null
    && typeof error === "object"
    && (error as { code?: unknown }).code === "ENOENT";
}
