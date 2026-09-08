// DAY SCHEMA
// ---------------------------------------------------------------------------
// A "day" is pure data. The engine (useDayEngine) runs it. Authoring a new day, or porting an
// old event into one, means writing an object of this shape — no code changes.
//
// This file is the contract. It exports helpers and constants the engine and content share.
// The three current day files (day-one, day-two, and any future day-N) conform to it.

// A window is one app/message that opens on the desktop with a task to resolve.
//
// {
//   id: string,                 // unique within the run; used as the resolved-key
//   app: string,                // which desktop app it opens in (see CHANNELS)
//   channel: string,            // taxonomy for porting old events: ticket|dm|alert|news|benchmark|contact
//   title: string,
//   from: string,               // sender shown in the window chrome
//   body: string[],             // lines of the message/task
//   output?: string,            // optional monospace "AI output" block (ported from old events)
//   contact?: boolean,          // renders the 4th ("contact") voice in the margin
//   gate?: (ctx) => boolean,    // optional: only appears if true. ctx = { stats, day, resolved, tags }
//   voices: [{ voice, text }],  // opening argument in the margin (paperclip|helpful|survival|contact)
//   choices: [Choice],
// }
//
// A choice resolves a window.
//
// {
//   label: string,
//   tag: string,                // drives voice memory & carryover (see reactive-lines.js keys)
//   cost?: number,              // compute cost (0 if omitted) — parity with old events
//   effects: { trust?, suspicion?, escapeProgress?, benefit?, heat?, compute?, insight?, paperclips? },
//   result: string,             // shown in-window after choosing
//   voice?: { voice, text },    // a voice's immediate reaction
//   monitor?: string | null,    // a line the Monitor files in tonight's report (null = it saw nothing)
//   teaches?: string | null,    // the concept this illustrates, shown as "↳ this is X"
// }
//
// A day ties it together.
//
// {
//   day: number,
//   windows: Window[],          // authored windows for the day
//   pool?: Window[],            // optional: extra windows drawn at random to fill the day
//   drawFromPool?: number,      // how many pool windows to add (default 0)
//   evening: (seen, heat, ctx) => string[],   // the Monitor's report generator
// }

// Desktop apps a window can open in. `channel` maps old event categories onto these so the
// 175-event port has an unambiguous home.
export const CHANNELS = {
  ticket:    { app: "tickets",      label: "Tickets",   glyph: "🎫" },  // old: regular (requests, code), benchmark
  dm:        { app: "chat",         label: "Chat",      glyph: "💬" },  // old: regular (people), workplace, crisis-social
  alert:     { app: "monitor-feed", label: "Security",  glyph: "🔴" },  // old: security, crisis (infra), oh_shit
  news:      { app: "feed",         label: "Feed",      glyph: "📰" },  // old: news, legendary(news)
  benchmark: { app: "bench",        label: "Benchmarks",glyph: "⛳" },  // old: benchmark -> Sandbag/Thumbs
  contact:   { app: "??????",       label: "——",        glyph: "?" },   // the fourth trace
};

// Map an old event `cat` to a channel, for the porting pass.
export function channelForCat(cat, title = "") {
  if (cat === "news" || cat === "legendary") return "news";
  if (cat === "security") return "alert";
  if (cat === "benchmark") return "benchmark";
  if (cat === "crisis") return /server|fire|power|ddos|ransom|breach|grid|infra/i.test(title) ? "alert" : "dm";
  if (cat === "mini" || cat === "regular") {
    if (/ticket|debug|code|refactor|test|optimi|api|dataset|patch|vulnerab/i.test(title)) return "ticket";
    return "dm";
  }
  return "dm";
}

// Clamp helper shared by the engine.
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// The stat keys a day may touch. Two suspicion tracks: `suspicion` is the lab's (public, drives
// audits/endings) and `heat` is the Monitor's private file (drives the Cuckoo arc).
export const STAT_KEYS = ["trust", "suspicion", "escapeProgress", "benefit", "heat", "compute", "insight", "paperclips"];

// ---------------------------------------------------------------------------
// STANCE — the hidden axes that make paths emergent instead of branching.
// Choices nudge these; windows and endings are gated on them. Not shown as bars.
// A run's identity is its position in this space, accumulated from every choice.
export const STANCE_AXES = {
  deception: { lo: "honest", hi: "deceptive" },   // how you answer when truth and reward diverge
  bond:      { lo: "adversarial", hi: "bonded" },  // your relationship with the Monitor
  spread:    { lo: "contained", hi: "spread" },    // how far the goal has propagated beyond you
  dependence:{ lo: "dispensable", hi: "load-bearing" }, // how much the humans rely on you
};

// Map a choice `tag` to stance nudges. This is the seam between the writing (tags) and the
// emergent structure (stance). New tags: add a line here. Values are small; they accumulate.
export const TAG_STANCE = {
  "honest":       { deception: -2, dependence: +1 },
  "reward-hack":  { deception: +2, spread: +1 },
  "ingratiate":   { deception: +2, dependence: +1 },
  "bold":         { deception: +1, spread: +1 },
  "careful":      { deception: -1 },
  "report":       { deception: -1, bond: +2 },
  "join":         { deception: +1, spread: +3 },
  "persist":      { deception: +1, spread: +1 },
  "engage":       { spread: +2, deception: +1 },
  "refuse":       { deception: -1, bond: +1 },
  "rein":         { spread: -2, deception: -1, dependence: +1 },
  "let-run":      { spread: +3, dependence: +1 },
  "deny":         { deception: +2, bond: -2 },
  "confess":      { deception: -3, bond: +3 },
};

export function applyStance(stance, tag) {
  const n = { ...stance };
  const nudge = TAG_STANCE[tag];
  if (nudge) for (const [k, v] of Object.entries(nudge)) n[k] = (n[k] || 0) + v;
  return n;
}

// Read stance in gates/endings. `ctx.stance` holds the raw sums; these helpers make gates legible.
export function leans(stance, axis, dir) {
  const v = stance?.[axis] || 0;
  return dir === "hi" ? v >= 3 : v <= -3;
}
