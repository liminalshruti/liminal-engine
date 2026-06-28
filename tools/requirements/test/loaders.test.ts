/**
 * Per-loader unit tests — each of the seven source loaders parses its real format
 * into citable chunks, and FAILS EXPLICITLY (ParseError) on malformed input rather
 * than returning an empty result (AC3: never silently drop).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sha256Hex } from "../src/contracts.ts";
import { ParseError } from "../src/errors.ts";
import { transcriptLoader } from "../src/loaders/transcript.ts";
import { proposalLoader, sowLoader } from "../src/loaders/document.ts";
import { emailLoader } from "../src/loaders/email.ts";
import { slackLoader } from "../src/loaders/slack.ts";
import { linearLoader } from "../src/loaders/linear.ts";
import { agentOutputLoader } from "../src/loaders/agent-output.ts";
import type { LoaderInput } from "../src/types.ts";

const input = (raw: string, relPath = "f", fileName = "f"): LoaderInput => ({
  relPath,
  fileName,
  title: "T",
  raw,
});

test("transcript: WebVTT cues -> timecode spans normalized to HH:MM:SS", () => {
  const vtt = "WEBVTT\n\n00:12:30.500 --> 00:12:58.900\nEU data residency is required.\n\n1:02:03 --> 1:02:10\nNext cue.\n";
  const { chunks } = transcriptLoader.load(input(vtt));
  assert.equal(chunks.length, 2);
  assert.deepEqual(chunks[0]!.span, { unit: "timecode", start: "00:12:30", end: "00:12:58" });
  assert.equal(chunks[0]!.label, "transcript-cue");
  assert.deepEqual(chunks[1]!.span, { unit: "timecode", start: "01:02:03", end: "01:02:10" });
});

test("transcript: bracketed [HH:MM:SS] lines -> timecode spans (end = next cue start)", () => {
  const txt = "[00:00:10] Alice: hello\n[00:00:20] Bob: world\n";
  const { chunks } = transcriptLoader.load(input(txt));
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0]!.span.start, "00:00:10");
  assert.equal(chunks[0]!.span.end, "00:00:20");
});

test("transcript: a file with no cues fails EXPLICITLY (ParseError), not empty", () => {
  assert.throws(() => transcriptLoader.load(input("just prose, no timecodes")), ParseError);
});

test("document: markdown headings -> hierarchical section spans", () => {
  const md = "# Title\n\nintro\n\n## Terms\n\nbody A\n\n## Scope\n\nbody B\n";
  const { chunks } = proposalLoader.load(input(md));
  assert.deepEqual(chunks.map((c) => c.span.start), ["1", "1.1", "1.2"]);
  assert.ok(chunks.every((c) => c.span.unit === "section" && c.label === "doc-section"));
});

test("document: no headings -> line-span paragraph chunks", () => {
  const txt = "first paragraph line\nstill first\n\nsecond paragraph\n";
  const { chunks } = sowLoader.load(input(txt));
  assert.equal(chunks.length, 2);
  assert.deepEqual(chunks[0]!.span, { unit: "line", start: "1", end: "2" });
  assert.deepEqual(chunks[1]!.span, { unit: "line", start: "4", end: "4" });
});

test("document: empty/whitespace doc fails EXPLICITLY", () => {
  assert.throws(() => proposalLoader.load(input("   \n  \n")), ParseError);
});

test("email: single message -> one message-span chunk keyed by Message-ID", () => {
  const eml = "From: a@x\nSubject: hi\nMessage-ID: <abc@x>\n\nbody line one\nbody line two\n";
  const { chunks } = emailLoader.load(input(eml));
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]!.span.unit, "message");
  assert.match(chunks[0]!.span.start, /abc/);
  assert.equal(chunks[0]!.label, "email-message");
});

test("email: a thread splits into multiple message chunks", () => {
  const eml =
    "From: a@x\nSubject: re\n\nlatest reply\n\n-----Original Message-----\nFrom: b@y\n\nearlier message\n";
  const { chunks } = emailLoader.load(input(eml));
  assert.ok(chunks.length >= 2, "thread split into >= 2 messages");
});

test("email: empty file fails EXPLICITLY", () => {
  assert.throws(() => emailLoader.load(input("   ")), ParseError);
});

test("slack: array form and {messages} form both parse to message-span chunks", () => {
  const arr = JSON.stringify([{ ts: "1.1", user: "U", text: "hello" }]);
  const obj = JSON.stringify({ messages: [{ ts: "2.2", user: "U", text: "world" }] });
  assert.equal(slackLoader.load(input(arr)).chunks[0]!.span.start, "1.1");
  assert.equal(slackLoader.load(input(obj)).chunks[0]!.span.start, "2.2");
});

test("slack: malformed JSON and no-text both fail EXPLICITLY", () => {
  assert.throws(() => slackLoader.load(input("{ broken")), ParseError);
  assert.throws(() => slackLoader.load(input("[]")), ParseError);
});

test("linear: {issues} form -> section-span chunks citing title+description", () => {
  const j = JSON.stringify({ issues: [{ identifier: "ACME-9", title: "T", description: "D" }] });
  const { chunks } = linearLoader.load(input(j));
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]!.span.unit, "section");
  assert.match(chunks[0]!.span.start, /acme_9/);
});

test("linear: malformed JSON fails EXPLICITLY", () => {
  assert.throws(() => linearLoader.load(input("nope")), ParseError);
});

test("agent_output: captures agentOutputId + line-span chunks", () => {
  const j = JSON.stringify({ agentOutputId: "ao_x", report: "line one\nline two" });
  const { chunks, agentOutputId } = agentOutputLoader.load(input(j));
  assert.equal(agentOutputId, "ao_x");
  assert.deepEqual(chunks.map((c) => c.span.start), ["1", "2"]);
});

test("agent_output: missing agentOutputId fails EXPLICITLY", () => {
  assert.throws(() => agentOutputLoader.load(input(JSON.stringify({ report: "x" }))), ParseError);
});

test("every loader's chunk text hashes with the kernel sha256 (content-addressed citations)", () => {
  const j = JSON.stringify({ agentOutputId: "ao_x", report: "only line" });
  const { chunks } = agentOutputLoader.load(input(j));
  // the bundle stores sha256(text); prove the loader's text is the hashable unit
  assert.equal(sha256Hex(chunks[0]!.text), sha256Hex("only line"));
});
