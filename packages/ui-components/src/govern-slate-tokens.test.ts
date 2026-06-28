import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const tokenCss = await readFile(new URL("./styles/govern-slate.css", import.meta.url), "utf8");
const appTokenShim = await readFile(
  new URL("../../../apps/desktop-demo/src/styles/design-tokens.css", import.meta.url),
  "utf8",
);

function cssValue(source: string, name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(source);
  assert.ok(match, `missing CSS token --${name}`);
  return match[1]!.trim();
}

function normalizedColor(value: string): string {
  const match = /#[0-9A-Fa-f]{6}/.exec(value);
  assert.ok(match, `expected hex color in ${value}`);
  return match[0]!.toLowerCase();
}

test("LIM-1339: ui-components is the govern-slate token source consumed by the app", () => {
  assert.match(appTokenShim, /@import "@liminal-engine\/ui-components\/govern-slate\.css";/);

  for (const name of [
    "govern-slate-bg",
    "govern-slate-surface",
    "govern-font-sans",
    "govern-space-6",
    "govern-radius-lg",
    "govern-elevation-card",
    "govern-focus-ring",
    "govern-duration-settle",
    "govern-reduced-duration",
    "govern-state-on-track",
    "govern-state-at-risk",
    "govern-state-blocked",
    "govern-state-forwarded",
    "govern-state-held",
  ]) {
    assert.match(tokenCss, new RegExp(`--${name}:`), `missing --${name}`);
  }

  assert.match(tokenCss, /\[data-theme="light"\]/);
  assert.match(tokenCss, /\[data-theme="dark"\]/);
  assert.match(tokenCss, /\[data-density="presenter"\]/);
  assert.match(tokenCss, /@media \(prefers-reduced-motion: reduce\)/);
});

test("LIM-1339: govern-slate parity anchors match the prototype sources", async () => {
  assert.equal(normalizedColor(cssValue(tokenCss, "bg")), "#0a0a0b");
  assert.equal(normalizedColor(cssValue(tokenCss, "frame-bg")), "#0e0e11");
  assert.equal(normalizedColor(cssValue(tokenCss, "frame-bg-2")), "#0c0c0f");
  assert.equal(normalizedColor(cssValue(tokenCss, "rail-bg")), "#08080a");
  assert.equal(normalizedColor(cssValue(tokenCss, "coherence")), "#7aa9ff");
  assert.equal(normalizedColor(cssValue(tokenCss, "correction")), "#e0996b");
  assert.equal(normalizedColor(cssValue(tokenCss, "emergence")), "#c084fc");
  assert.equal(normalizedColor(cssValue(tokenCss, "resolved")), "#6ec3a8");

  const prototypeRoot = join(homedir(), "liminal/liminal-prototype");
  const prototypeTokensPath = join(prototypeRoot, "design-system/tokens/design-tokens.css");
  const prototypeSpecimenPath = join(prototypeRoot, "liminal-desktop-specimen.html");

  if (existsSync(prototypeTokensPath)) {
    const prototypeTokens = await readFile(prototypeTokensPath, "utf8");
    assert.equal(
      normalizedColor(cssValue(tokenCss, "bg")),
      normalizedColor(cssValue(prototypeTokens, "bg")),
    );
    assert.equal(
      normalizedColor(cssValue(tokenCss, "frame-bg")),
      normalizedColor(cssValue(prototypeTokens, "frame-bg")),
    );
    assert.equal(
      normalizedColor(cssValue(tokenCss, "rail-bg")),
      normalizedColor(cssValue(prototypeTokens, "rail-bg")),
    );
  }

  if (existsSync(prototypeSpecimenPath)) {
    const prototypeSpecimen = await readFile(prototypeSpecimenPath, "utf8");
    assert.match(prototypeSpecimen, /--color-coherence:\s+#7aa9ff;/i);
    assert.match(prototypeSpecimen, /--color-correction:\s+#e0996b;/i);
    assert.match(prototypeSpecimen, /--color-emergence:\s+#c084fc;/i);
    assert.match(prototypeSpecimen, /--color-resolved:\s+#6ec3a8;/i);
  }
});

test("LIM-1339: app CSS uses token references instead of local color literals", async () => {
  const files = [
    "../../../apps/desktop-demo/src/styles/app.css",
    "../../../apps/desktop-demo/src/styles/correction-form.css",
    "../../../apps/desktop-demo/src/styles/error.css",
    "../../../apps/desktop-demo/src/styles/governance-case.css",
    "../../../apps/desktop-demo/src/screens/ContextTray.css",
    "../../../apps/desktop-demo/src/screens/Initialize.css",
    "../../../apps/desktop-demo/src/components/VoiceCorrection.css",
  ];
  const rawColorPattern = /#[0-9A-Fa-f]{3,8}|rgba?\(|oklch\(/;

  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, rawColorPattern, `${file} should consume shared tokens for colors`);
  }
});
