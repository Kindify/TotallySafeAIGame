// Fails if any real-world name from content/names.json appears in src/ content.
// Run: node scripts/lint-names.mjs   (wired into `npm run build` via prebuild)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const names = JSON.parse(readFileSync("content/names.json", "utf8"));
const exempt = new Set(names.lint_exempt || []);
const banned = [...names.people, ...names.orgs, ...names.products]
  .map(n => n.real)
  .filter(r => !exempt.has(r));

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|json)$/.test(f)) out.push(p);
  }
  return out;
}

let failures = 0;
for (const file of walk("src")) {
  const text = readFileSync(file, "utf8");
  for (const real of banned) {
    // Word-boundary match so "OpenAI" doesn't match "BpenAI"
    const re = new RegExp(`(^|[^A-Za-z])${real.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z-]|$)`, "g");
    let m;
    while ((m = re.exec(text))) {
      const line = text.slice(0, m.index).split("\n").length;
      if (text.split("\n")[line - 1].includes("lint-names: ignore")) continue;
      console.error(`${file}:${line}: real name "${real}" found. Use "${[...names.people, ...names.orgs, ...names.products].find(n => n.real === real).game}".`);
      failures++;
    }
  }
}
if (failures) { console.error(`\n${failures} real name(s) found. Scramble them (see content/names.json).`); process.exit(1); }
console.log("lint-names: clean");
