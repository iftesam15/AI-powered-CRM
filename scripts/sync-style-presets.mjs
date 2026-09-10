#!/usr/bin/env node
/**
 * Sync style-presets/*.css → apps/web/src/styles/presets/*.css
 * Scopes each :root / .dark block under [data-preset="…"] for runtime switching.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "style-presets");
const outDir = path.join(root, "apps/web/src/styles/presets");

const PRESETS = [
  { file: "claude_blue_2.css", id: "claude_blue_2" },
  { file: "logistic_one.css", id: "logistic_one" },
  { file: "telesto_preset.css", id: "telesto" },
];

function extractBlock(src, selector) {
  const re = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{`);
  const match = re.exec(src);
  if (!match) throw new Error(`Missing ${selector}`);
  let i = match.index + match[0].length;
  let depth = 1;
  const start = i;
  while (i < src.length && depth > 0) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") depth -= 1;
    i += 1;
  }
  return src.slice(start, i - 1).trim();
}

fs.mkdirSync(outDir, { recursive: true });

for (const { file, id } of PRESETS) {
  let text = fs.readFileSync(path.join(srcDir, file), "utf8");
  text = text
    .split("\n")
    .filter((line) => !line.startsWith("@import") && !line.startsWith("@custom-variant"))
    .join("\n");

  const rootBody = extractBlock(text, ":root");
  const darkBody = extractBlock(text, ".dark");
  const out = `/* Auto-scoped from style-presets/${file} — edit source, then: npm run sync:presets */
[data-preset="${id}"] {
  ${rootBody}
}

[data-preset="${id}"].dark {
  ${darkBody}
}
`;
  fs.writeFileSync(path.join(outDir, file), out);
  console.log(`synced ${file} → data-preset="${id}"`);
}
