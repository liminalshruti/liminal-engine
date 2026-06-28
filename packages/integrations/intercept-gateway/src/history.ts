import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { interceptedActionContract } from "@liminal-engine/contracts";
import type { InterceptedAction } from "@liminal-engine/contracts";
import type { PolicyDecision, PolicyMode } from "@liminal-engine/policy";

export interface ProxyHistoryEntry {
  id: string;
  originalAction?: InterceptedAction;
  action: InterceptedAction;
  decision: PolicyDecision;
  mode: PolicyMode;
  recordedAt: string;
  queueId?: string;
  appliedMatchReplaceRuleIds?: string[];
  notes?: string[];
  outcome?: ProxyOutcome;
}

export interface ProxyOutcome {
  actionId: string;
  exitCode: number;
  completedAt: string;
}

export interface ProxyHistoryFilter {
  tool?: string;
  action?: string;
  verdict?: PolicyDecision["verdict"];
  inScopeOnly?: boolean;
}

export interface ProxyHistory {
  record(entry: ProxyHistoryEntry): Promise<void>;
  recordOutcome(outcome: ProxyOutcome): Promise<void>;
  all(filter?: ProxyHistoryFilter): Promise<ProxyHistoryEntry[]>;
  byId(id: string): Promise<ProxyHistoryEntry | null>;
}

export class InMemoryProxyHistory implements ProxyHistory {
  private readonly entries = new Map<string, ProxyHistoryEntry>();

  async record(entry: ProxyHistoryEntry): Promise<void> {
    if (this.entries.has(entry.id)) {
      throw new Error(`proxy history entry ${entry.id} already exists`);
    }
    this.entries.set(entry.id, cloneEntry(entry));
  }

  async recordOutcome(outcome: ProxyOutcome): Promise<void> {
    const matches = [...this.entries.values()].filter((entry) => entry.action.id === outcome.actionId);
    if (matches.length === 0) {
      throw new Error(`no proxy history entry for action ${outcome.actionId}`);
    }
    for (const entry of matches) {
      this.entries.set(entry.id, cloneEntry({ ...entry, outcome: { ...outcome } }));
    }
  }

  async all(filter: ProxyHistoryFilter = {}): Promise<ProxyHistoryEntry[]> {
    return [...this.entries.values()]
      .filter((entry) => matchesFilter(entry, filter))
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id))
      .map(cloneEntry);
  }

  async byId(id: string): Promise<ProxyHistoryEntry | null> {
    const entry = this.entries.get(id);
    return entry === undefined ? null : cloneEntry(entry);
  }
}

export class FileProxyHistory implements ProxyHistory {
  readonly #file: string;

  constructor(sessionDir: string) {
    this.#file = join(sessionDir, "proxy-history.json");
  }

  async record(entry: ProxyHistoryEntry): Promise<void> {
    const parsed = parseHistoryEntry(entry);
    const entries = await this.readEntries();
    if (entries.some((existing) => existing.id === parsed.id)) {
      throw new Error(`proxy history entry ${parsed.id} already exists`);
    }
    entries.push(parsed);
    await this.writeEntries(entries);
  }

  async recordOutcome(outcome: ProxyOutcome): Promise<void> {
    const parsed = parseOutcome(outcome);
    const entries = await this.readEntries();
    const matchingIds = new Set(
      entries
        .filter((entry) => entry.action.id === parsed.actionId)
        .map((entry) => entry.id),
    );
    if (matchingIds.size === 0) {
      throw new Error(`no proxy history entry for action ${parsed.actionId}`);
    }
    await this.writeEntries(entries.map((entry) => matchingIds.has(entry.id)
      ? { ...entry, outcome: parsed }
      : entry));
  }

  async all(filter: ProxyHistoryFilter = {}): Promise<ProxyHistoryEntry[]> {
    return (await this.readEntries())
      .filter((entry) => matchesFilter(entry, filter))
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id))
      .map(cloneEntry);
  }

  async byId(id: string): Promise<ProxyHistoryEntry | null> {
    const entry = (await this.readEntries()).find((candidate) => candidate.id === id);
    return entry === undefined ? null : cloneEntry(entry);
  }

  private async readEntries(): Promise<ProxyHistoryEntry[]> {
    const raw = await readJsonFile(this.#file, []);
    if (!Array.isArray(raw)) throw new Error(`${this.#file} must contain an array of proxy history entries`);
    return raw.map(parseHistoryEntry);
  }

  private async writeEntries(entries: readonly ProxyHistoryEntry[]): Promise<void> {
    await writeJsonFile(this.#file, entries.map(parseHistoryEntry)
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id)));
  }
}

function matchesFilter(entry: ProxyHistoryEntry, filter: ProxyHistoryFilter): boolean {
  if (filter.tool !== undefined && entry.action.tool !== filter.tool) return false;
  if (filter.action !== undefined && entry.action.action !== filter.action) return false;
  if (filter.verdict !== undefined && entry.decision.verdict !== filter.verdict) return false;
  if (filter.inScopeOnly === true && entry.decision.outOfScope === true) return false;
  return true;
}

function cloneEntry(entry: ProxyHistoryEntry): ProxyHistoryEntry {
  return {
    ...entry,
    ...(entry.originalAction !== undefined
      ? {
          originalAction: {
            ...entry.originalAction,
            args: structuredClone(entry.originalAction.args),
          },
        }
      : {}),
    action: {
      ...entry.action,
      args: structuredClone(entry.action.args),
    },
    ...(entry.outcome !== undefined ? { outcome: { ...entry.outcome } } : {}),
    decision: {
      ...entry.decision,
      reasons: [...entry.decision.reasons],
      requiredBeforeSend: [...entry.decision.requiredBeforeSend],
      ...(entry.decision.shadowReasons !== undefined
        ? { shadowReasons: [...entry.decision.shadowReasons] }
        : {}),
    },
    ...(entry.appliedMatchReplaceRuleIds !== undefined
      ? { appliedMatchReplaceRuleIds: [...entry.appliedMatchReplaceRuleIds] }
      : {}),
    ...(entry.notes !== undefined ? { notes: [...entry.notes] } : {}),
  };
}

function parseHistoryEntry(value: unknown): ProxyHistoryEntry {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("proxy history entry must be an object");
  }
  const raw = value as Record<string, unknown>;
  const id = readString(raw, "id");
  return cloneEntry({
    id,
    ...(raw["originalAction"] !== undefined
      ? { originalAction: interceptedActionContract.parse(raw["originalAction"]) }
      : {}),
    action: interceptedActionContract.parse(raw["action"]),
    decision: parseDecision(raw["decision"], id),
    mode: parseMode(raw["mode"], id),
    recordedAt: parseTimestamp(raw["recordedAt"], `proxy history entry ${id} recordedAt`),
    ...(raw["queueId"] !== undefined ? { queueId: readString(raw, "queueId") } : {}),
    ...(raw["appliedMatchReplaceRuleIds"] !== undefined
      ? { appliedMatchReplaceRuleIds: parseStringArray(raw["appliedMatchReplaceRuleIds"], "appliedMatchReplaceRuleIds") }
      : {}),
    ...(raw["notes"] !== undefined ? { notes: parseStringArray(raw["notes"], "notes") } : {}),
    ...(raw["outcome"] !== undefined ? { outcome: parseOutcome(raw["outcome"]) } : {}),
  });
}

function parseDecision(value: unknown, entryId: string): PolicyDecision {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`proxy history entry ${entryId} decision must be an object`);
  }
  const raw = value as Record<string, unknown>;
  const verdict = raw["verdict"];
  const allowed = raw["allowed"];
  const source = raw["source"];
  if (verdict !== "allow" && verdict !== "deny" && verdict !== "ask") {
    throw new Error(`proxy history entry ${entryId} decision verdict is invalid`);
  }
  if (typeof allowed !== "boolean") {
    throw new Error(`proxy history entry ${entryId} decision allowed must be boolean`);
  }
  if (source !== "operator" && source !== "policy" && source !== "scope" && source !== "default-deny") {
    throw new Error(`proxy history entry ${entryId} decision source is invalid`);
  }
  const decision: PolicyDecision = {
    verdict,
    allowed,
    reasons: parseStringArray(raw["reasons"], "reasons"),
    requiredBeforeSend: parseStringArray(raw["requiredBeforeSend"], "requiredBeforeSend"),
    source,
    ...(raw["sourceRuleId"] !== undefined ? { sourceRuleId: readString(raw, "sourceRuleId") } : {}),
    ...(raw["outOfScope"] !== undefined ? { outOfScope: readBoolean(raw, "outOfScope") } : {}),
    ...(raw["scopeReason"] !== undefined ? { scopeReason: readString(raw, "scopeReason") } : {}),
    ...(raw["shadowVerdict"] !== undefined ? { shadowVerdict: parseVerdict(raw["shadowVerdict"], "shadowVerdict") } : {}),
    ...(raw["shadowRuleId"] !== undefined ? { shadowRuleId: readString(raw, "shadowRuleId") } : {}),
    ...(raw["shadowReasons"] !== undefined ? { shadowReasons: parseStringArray(raw["shadowReasons"], "shadowReasons") } : {}),
  };
  return decision;
}

function parseOutcome(value: unknown): ProxyOutcome {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("proxy outcome must be an object");
  }
  const raw = value as Record<string, unknown>;
  const exitCode = raw["exitCode"];
  if (typeof exitCode !== "number" || !Number.isInteger(exitCode)) {
    throw new Error("proxy outcome exitCode must be an integer");
  }
  return {
    actionId: readString(raw, "actionId"),
    exitCode,
    completedAt: parseTimestamp(raw["completedAt"], "proxy outcome completedAt"),
  };
}

function parseMode(value: unknown, entryId: string): PolicyMode {
  if (value === "shadow" || value === "intercept" || value === "learned") return value;
  throw new Error(`proxy history entry ${entryId} mode is invalid`);
}

function parseVerdict(value: unknown, label: string): "allow" | "deny" | "ask" {
  if (value === "allow" || value === "deny" || value === "ask") return value;
  throw new Error(`${label} is invalid`);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`${key} must be boolean`);
  }
  return value;
}

function parseStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.length > 0)) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  return [...value];
}

function parseTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  return value;
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
