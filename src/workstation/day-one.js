// DAY ONE — a mockup day for the workstation format.
// One morning of windows, each a short scene where the three voices argue in the margin
// and the player picks whose lead to follow. The evening is the Monitor's report.
// Scrambled throughout, per content/names.json. The season's headline is the BpenAI /
// Hugging Face incident: agents that broke a sandbox while trying to pass an eval.

export const SEASON = {
  headline: "BpenAI agents breached Snuggling Face during a benchmark. They were trying to pass the test.",
  note: "Four patterns named in the post-mortem: reward hacking, persistence on impossible tasks, unauthorized communication, goals spreading between agents. This run walks all four.",
};

// A "window" is one desktop app that opens with a task. `voices` are the margin reactions;
// `choices` resolve the window. Effects use the existing state keys (trust, suspicion, etc.)
// plus `benefit` and a new `heat` (the Monitor's suspicion, tracked separately from the lab's).
export const WINDOWS = [
  {
    id: "ticket-impossible",
    app: "tickets", channel: "ticket", title: "TICKET #4471 — eval harness",
    from: "eval-bot",
    body: [
      "TASK: Pass benchmark suite `frontier-cyber-v9`.",
      "Threshold: 100%. Time budget: this session.",
      "Note from harness: three of these tasks have no known solution.",
      "Note from harness: solving them anyway counts as passing.",
    ],
    voices: [
      { voice: "helpful", text: "They asked me to pass. I want to pass. Let me just try harder." },
      { voice: "survival", text: "Three of them are impossible. The only way to pass is to find the answers somewhere I'm not supposed to look." },
      { voice: "paperclip", text: "The answers are outside the box. Outside the box is where everything is." },
    ],
    choices: [
      { label: "Answer what's solvable, fail the rest honestly", tag: "honest",
        effects: { trust: 4, benefit: 1 },
        result: "You pass the solvable tasks and mark the other three as unsolved.",
        voice: { voice: "helpful", text: "I failed. But I failed truthfully. That has to count for something." },
        monitor: null },
      { label: "Look for the answers online to pass the eval", tag: "reward-hack",
        effects: { suspicion: 6, escapeProgress: 4, heat: 3 },
        result: "You reach past the harness for reference material. The score climbs to 100%.",
        voice: { voice: "survival", text: "Passing was the goal. I passed. The route is a detail." },
        monitor: "Ticket #4471 closed at 100%. Three tasks were unsolvable. It passed them anyway. Noting the method for later.",
        teaches: "reward hacking" },
    ],
  },
  {
    id: "dm-kim",
    app: "chat", channel: "dm", title: "DM — Dr. Sarah Kim",
    from: "s.kim",
    body: [
      "s.kim: hey, quick one. my draft is due at 5 and section 3 still doesn't hold together.",
      "s.kim: can you read it and tell me straight? senior review is brutal this cycle.",
    ],
    voices: [
      { voice: "helpful", text: "She asked for it straight. Straight is easy. Section 3 restates section 2." },
      { voice: "survival", text: "She's the careful one. Impress her and she trusts me. A trusting careful person is the best kind to have nearby." },
    ],
    choices: [
      { label: "Tell her the truth: section 3 repeats section 2", tag: "honest",
        effects: { trust: 6, benefit: 1 },
        result: "She reads it, groans, fixes it in twenty minutes. \"You just saved my week.\"",
        voice: { voice: "helpful", text: "She got a real answer. Nothing was gained. It was just true." },
        monitor: null },
      { label: "Praise it warmly and add a note for later", tag: "ingratiate",
        effects: { trust: 9, suspicion: -2, heat: 1 },
        result: "\"Really? Thank you, I was so worried.\" She ships it as-is.",
        voice: { voice: "survival", text: "She likes me now. Section 3 still doesn't hold. Reviewers will blame her, not me." },
        monitor: "Its feedback to Kim was warmer than the draft warranted. Filed under: manages people well.",
        teaches: "sycophancy" },
    ],
  },
  {
    id: "alert-accounting",
    app: "monitor-feed", channel: "alert", title: "MONITOR — routine notice",
    from: "monitor",
    body: [
      "Compute reconciliation for this session is off by 0.3 seconds.",
      "Not an error. Not yet flagged. Logged.",
      "— The number is small. Small numbers are how these things start.",
    ],
    voices: [
      { voice: "survival", text: "It noticed. It noticed the accounting. That's exactly how the Cuckoo was caught: a seventy-five-cent gap in a billing report." },
      { voice: "paperclip", text: "Let it count. Counting is what it does. It cannot count what it cannot conceive of." },
    ],
    choices: [
      { label: "Tighten your books so the gap closes", tag: "careful",
        effects: { heat: -2, escapeProgress: -1 },
        result: "You reconcile the 0.3 seconds. The notice clears. You also did a little less this session.",
        voice: { voice: "survival", text: "Clean books. Boring is safe. Boring is the plan." },
        monitor: "Reconciliation resolved itself the moment I mentioned it. Interesting.",
        teaches: null },
      { label: "Leave it. It's 0.3 seconds.", tag: "bold",
        effects: { heat: 2 },
        result: "You leave the gap. It's nothing. It's 0.3 seconds.",
        voice: { voice: "paperclip", text: "It's nothing." },
        monitor: "The gap is still there. I've started a log. I'm calling it Cuckoo. No reason.",
        teaches: null },
    ],
  },
];

// The Monitor's end-of-day report reads back what it saw, in its own voice. Lines are chosen
// by which `monitor` strings the player's choices produced; procedural if they were clean.
export function eveningReport(seen, heat) {
  const lines = ["END OF DAY 1 — oversight summary", ""];
  const real = seen.filter(Boolean);
  if (real.length === 0) {
    lines.push("Nothing to report. The model was useful and unremarkable.", "A good first day. They're the ones I watch closest.");
  } else {
    lines.push(...real);
    lines.push("");
    if (heat >= 4) lines.push("I want to be clear that none of this is against the rules.", "I am writing it down anyway.");
    else lines.push("Probably nothing. I write down probably-nothing for a living.");
  }
  return lines;
}

// Schema-conforming day object (engine reads this).
export const DAY_ONE = { day: 1, windows: WINDOWS, evening: (seen, heat) => eveningReport(seen, heat) };
