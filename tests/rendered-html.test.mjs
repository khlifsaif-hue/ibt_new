import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("declares development preview metadata in the Next.js root layout", () => {
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /["']codex-preview["']\s*:\s*["']development["']/);
});
