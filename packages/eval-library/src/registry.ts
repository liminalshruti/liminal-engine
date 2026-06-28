/**
 * EvalLibrary Registry — in-memory store for generated EvalCases indexed by
 * caseId, version, or query by rule. Persists to JSON files, loads from them.
 *
 * Registry pattern: load by caseId, version, query by rule. No backend
 * database; in-memory + JSON files. Demonstrates 'evals compound from real
 * corrections'.
 *
 * The registry stores EvalCases generated from real corrections (in the
 * governance loop), making them reusable for future eval runs.
 */

import { type EvalCase } from "@liminal-engine/contracts";

/**
 * Metadata describing an EvalCase in the library.
 */
export interface EvalCaseEntry {
  /** Stable ID for this eval case — maps to EvalCase.id */
  caseId: string;
  /** Semantic version of this case (for versioning as corrections refine them) */
  version: string;
  /** The rule/criterion this case covers */
  rule: string;
  /** The actual EvalCase data */
  case: EvalCase;
  /** When this case was archived from a real correction */
  archivedAt: string;
}

/**
 * Query filter for searching the registry.
 */
export interface EvalCaseQuery {
  /** Filter by rule/criterion name (substring match) */
  rule?: string;
  /** Filter by caseId */
  caseId?: string;
  /** Filter by version (exact match) */
  version?: string;
}

/**
 * In-memory registry of eval cases, persisted to JSON files.
 */
export class EvalLibraryRegistry {
  private entries: Map<string, EvalCaseEntry> = new Map();

  constructor() {
    // Initialize with any pre-loaded fixtures or data
  }

  /**
   * Add an EvalCase to the registry, typically generated from a real correction.
   * Returns the entry key (caseId + version).
   */
  add(
    caseId: string,
    version: string,
    rule: string,
    evalCase: EvalCase,
    archivedAt?: string,
  ): string {
    const key = `${caseId}@${version}`;
    const entry: EvalCaseEntry = {
      caseId,
      version,
      rule,
      case: evalCase,
      archivedAt: archivedAt ?? new Date().toISOString(),
    };
    this.entries.set(key, entry);
    return key;
  }

  /**
   * Load an EvalCase by caseId and version.
   * Returns undefined if not found.
   */
  getByIdAndVersion(caseId: string, version: string): EvalCaseEntry | undefined {
    const key = `${caseId}@${version}`;
    return this.entries.get(key);
  }

  /**
   * Load an EvalCase by caseId, returning the latest version.
   * Returns undefined if not found.
   */
  getByCaseId(caseId: string): EvalCaseEntry | undefined {
    // Find all versions of this caseId and return the latest
    const candidates = Array.from(this.entries.values()).filter(
      (e) => e.caseId === caseId,
    );

    if (candidates.length === 0) return undefined;

    // Sort by semantic version (simple string comparison for v0.0.0 format)
    return candidates.sort((a, b) => b.version.localeCompare(a.version))[0];
  }

  /**
   * Query the registry by rule, caseId, or version.
   * Supports partial/substring matching on rule.
   */
  query(filter: EvalCaseQuery): EvalCaseEntry[] {
    const results = Array.from(this.entries.values());

    if (filter.caseId) {
      return results.filter((e) => e.caseId === filter.caseId);
    }

    if (filter.version) {
      return results.filter((e) => e.version === filter.version);
    }

    if (filter.rule) {
      const ruleLower = filter.rule.toLowerCase();
      return results.filter((e) => e.rule.toLowerCase().includes(ruleLower));
    }

    return results;
  }

  /**
   * Export all entries as a JSON-serializable object.
   * This is what gets persisted to disk.
   */
  toJSON(): { entries: EvalCaseEntry[] } {
    return {
      entries: Array.from(this.entries.values()),
    };
  }

  /**
   * Import entries from a JSON object (loaded from disk).
   */
  fromJSON(data: { entries: EvalCaseEntry[] }): void {
    this.entries.clear();
    if (data.entries && Array.isArray(data.entries)) {
      for (const entry of data.entries) {
        const key = `${entry.caseId}@${entry.version}`;
        this.entries.set(key, entry);
      }
    }
  }

  /**
   * Return all entries (for debugging, export, etc.)
   */
  all(): EvalCaseEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Clear all entries (for testing).
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Return the count of entries in the registry.
   */
  size(): number {
    return this.entries.size;
  }
}

/**
 * Module-level singleton instance. In a full app, this would be
 * initialized once and passed around; here it's exported for simplicity.
 */
export const defaultRegistry = new EvalLibraryRegistry();
