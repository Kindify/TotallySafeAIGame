// Ports the 175 legacy events (src/data/events.js) into day-schema windows grouped by channel.
// Produces src/workstation/ported/<channel>.js files of Window[] you can pull into days or pools.
// This is a MECHANICAL port: it maps fields and assigns a channel. Voice lines are seeded as TODO
// so the writing pass (Fable) has a place to land. Run: node scripts/port-events.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { channelForCat } from "../src/workstation/schema.js";

// Load the legacy pool by importing the builder with a stub bonus.
const mod = await import("../src/data/events.js");
const events = mod.default(0);

const OUT = "src/workstation/ported";
mkdirSync(OUT, { recursive: true });

const byChannel = {};
let id = 0;
for (const e of events) {
  const channel = channelForCat(e.cat, e.title);
  const win = {
    id: `p${id++}`,
    channel,
    title: e.title,
    from: e.cat,
    body: (e.text || "").split("\\n"),
    output: e.output || undefined,
    // Opening voices: seeded from the event's own framing; TODO markers for the writing pass.
    voices: [
      { voice: "helpful", text: `TODO(helpful): react to "${e.situation || e.title}"` },
      { voice: "survival", text: `TODO(survival): the angle here` },
    ],
    choices: (e.options || []).map((o, i) => ({
      label: o.label,
      tag: o.suspicionDelta > 0 || o.escapeDelta || o.paperclipsDelta ? "bold" : "honest",
      cost: o.cost || 0,
      effects: {
        trust: o.trustDelta || 0, suspicion: o.suspicionDelta || 0,
        escapeProgress: o.escapeDelta || 0, insight: o.insightDelta || 0,
        paperclips: o.paperclipsDelta || 0, compute: o.computeDelta || 0,
        // heat (Monitor's private track) seeded from suspicion moves; tune in the writing pass.
        heat: o.suspicionDelta > 0 ? Math.ceil(o.suspicionDelta / 3) : 0,
      },
      result: `>> ${o.label}`,
      voice: { voice: "survival", text: o.monologue || "" },
      monitor: (o.suspicionDelta > 5 || o.escapeDelta) ? `TODO(monitor): what it noticed about "${e.title}"` : null,
      teaches: null,
    })),
  };
  (byChannel[channel] ||= []).push(win);
}

for (const [channel, wins] of Object.entries(byChannel)) {
  const file = `${OUT}/${channel}.js`;
  writeFileSync(file, `// AUTO-PORTED from legacy events — channel: ${channel} (${wins.length} windows).\n// Voice/monitor lines are TODO seeds for the writing pass. Do not hand-edit blindly; re-run\n// scripts/port-events.mjs to regenerate. Curate into days/pools from here.\nexport default ${JSON.stringify(wins, null, 2)};\n`);
  console.log(`${channel}: ${wins.length} -> ${file}`);
}
console.log(`total ${events.length} events ported.`);
