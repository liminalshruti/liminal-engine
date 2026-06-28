/**
 * demo-video.test.ts — Liminal Engine Hackathon Governance MVP
 *
 * Verifies that the demo recording video exists and is judge-ready.
 * This test runs as part of `pnpm verify` and checks:
 * - The demos/recordings/ directory exists
 * - A video file (mp4/mov/webm/mkv) exists
 * - The file is readable and non-zero size
 *
 * The test is **not strict** — if the video is missing, it warns but does not
 * fail the build, because the video is a manual recording (not built by CI).
 * However, before final submission, the video must be present for judges.
 */

import { test } from "node:test";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const RECORDINGS_DIR = join(ROOT, "demos", "recordings");

// Supported video formats
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".mkv", ".avi"];

test("demo video (LIM-1197): recording directory exists", async () => {
  // The directory should exist (even if the video is not recorded yet)
  let entries: string[] = [];
  try {
    entries = await readdir(RECORDINGS_DIR);
  } catch (err) {
    assert.fail(`demos/recordings/ does not exist: ${err}`);
  }

  assert.ok(entries.length >= 0, "demos/recordings/ directory is readable");
});

test("demo video (LIM-1197): video file is present or skipped gracefully", async (t) => {
  // This test is informational — it does not fail the build if the video
  // is missing, but it flags the status for the developer.
  // The video is a manual recording task (not CI-built), so it may not be
  // present in every run. However, before final submission, it MUST be present.

  let entries: string[] = [];
  try {
    entries = await readdir(RECORDINGS_DIR);
  } catch (err) {
    // If the directory doesn't exist, skip this test
    t.skip();
    return;
  }

  const videoFiles = entries.filter((file) => {
    const ext = file.substring(file.lastIndexOf(".")).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  });

  if (videoFiles.length === 0) {
    console.log(
      "  ⓘ  No demo video found in demos/recordings/ (LIM-1197). " +
        "This is a manual recording task — record before final submission."
    );
    t.skip();
    return;
  }

  assert.ok(videoFiles.length > 0, "at least one video file exists");

  // Verify the first video file is readable and non-zero
  const videoFile = join(RECORDINGS_DIR, videoFiles[0]!);
  const stats = await stat(videoFile);

  assert.ok(stats.size > 0, `video file is non-zero size (${stats.size} bytes)`);
  assert.ok(stats.isFile(), "video file is a regular file");
});

test("demo video (LIM-1197): recording README is present", async (t) => {
  // The README should explain the video to judges
  let files: string[] = [];
  try {
    files = await readdir(RECORDINGS_DIR);
  } catch (err) {
    t.skip();
    return;
  }

  const hasReadme = files.includes("README.md");
  if (!hasReadme) {
    console.log("  ⓘ  No README.md in demos/recordings/ (optional but recommended for judges)");
    t.skip();
    return;
  }

  assert.ok(hasReadme, "README.md exists to guide judges");
});
