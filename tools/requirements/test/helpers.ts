/**
 * Test helpers — scratch folders for ingest tests. Not a `*.test.ts`, so the test
 * runner imports it without executing it as a suite.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to the committed `examples/acme-real` folder. */
export const ACME_REAL_DIR = fileURLToPath(new URL("../../../examples/acme-real", import.meta.url));

/** Create an isolated temp dir; returns its path + a `cleanup()` + a `file()` writer. */
export function scratchDir(): {
  dir: string;
  file: (relPath: string, contents: string) => void;
  cleanup: () => void;
} {
  const dir = mkdtempSync(join(tmpdir(), "lim1333-"));
  const file = (relPath: string, contents: string): void => {
    const abs = join(dir, relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
  };
  const cleanup = (): void => rmSync(dir, { recursive: true, force: true });
  return { dir, file, cleanup };
}

/** A minimal valid WebVTT transcript with one cue. */
export const ONE_CUE_VTT = "WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nHello there.\n";
