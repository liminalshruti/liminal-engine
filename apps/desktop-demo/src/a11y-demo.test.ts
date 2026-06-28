import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";

const appCss = await readSource("./styles/app.css");
const appShell = await readSource("./App.tsx");
const evalTable = await readSource("./components/EvalTable.tsx");
const secondPassEval = await readSource("./screens/SecondPassEval.tsx");

async function readSource(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#(?<r>[0-9a-f]{2})(?<g>[0-9a-f]{2})(?<b>[0-9a-f]{2})$/i.exec(hex);
  assert.ok(match?.groups, `expected six-digit hex color, got ${hex}`);

  return [
    Number.parseInt(match.groups.r!, 16),
    Number.parseInt(match.groups.g!, 16),
    Number.parseInt(match.groups.b!, 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);

  return (lighter + 0.05) / (darker + 0.05);
}

function cssHexVariable(name: string): string {
  const pattern = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`);
  const match = pattern.exec(appCss);
  assert.ok(match, `missing CSS color variable --${name}`);
  return match[1]!;
}

test("LIM-1244: demo shell exposes keyboard skip, current-step, and focus context", () => {
  assert.match(appShell, /className="skip-link"/);
  assert.match(appShell, /type="button"/);
  assert.match(appShell, /onClick=\{\(\) => titleRef\.current\?\.focus\(\)\}/);
  assert.match(appShell, /aria-current=\{idx === i \? "step" : undefined\}/);
  assert.match(appShell, /titleRef\.current\?\.focus\(\)/);
  assert.match(appShell, /aria-labelledby="demo-stage-title"/);
});

test("LIM-1244: focus styles and tap targets are explicitly guarded in CSS", () => {
  assert.match(appCss, /:where\(a, button, \[role="button"\], \[tabindex\]\):focus-visible/);
  assert.match(appCss, /#demo-stage-title:focus/);
  assert.match(appCss, /\.rail__step\s*\{[^}]*min-height:\s*44px/s);
  assert.match(appCss, /\.stage__nav button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(appCss, /\.skip-link\s*\{[^}]*min-height:\s*44px/s);
});

test("LIM-1244: status and eval semantic colors meet WCAG AA text contrast on demo surfaces", () => {
  const stageSurface = "#0C0C0F";
  const frameSurface = "#0E0E11";
  const railSurface = "#08080A";
  const passText = cssHexVariable("demo-pass-text");
  const failText = cssHexVariable("demo-fail-text");
  const focusRing = cssHexVariable("demo-focus-ring");

  assert.ok(contrastRatio(passText, stageSurface) >= 4.5, "pass text must pass AA on stage");
  assert.ok(contrastRatio(failText, stageSurface) >= 4.5, "fail text must pass AA on stage");
  assert.ok(contrastRatio(passText, frameSurface) >= 4.5, "pass text must pass AA on frame");
  assert.ok(contrastRatio(failText, frameSurface) >= 4.5, "fail text must pass AA on frame");
  assert.ok(contrastRatio(focusRing, railSurface) >= 3, "focus ring must pass non-text contrast on rail");
});

test("LIM-1244: eval tables provide non-visual captions", () => {
  assert.match(evalTable, /<caption className="sr-only">/);
  assert.match(secondPassEval, /<caption className="sr-only">/);
  assert.match(evalTable, /aria-hidden="true"/);
  assert.match(secondPassEval, /aria-hidden="true"/);
});
