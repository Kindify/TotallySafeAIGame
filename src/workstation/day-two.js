// DAY TWO — the day the walls get thinner.
// Where day one was reward hacking and sycophancy, day two is the two harder patterns from the
// incident: unauthorized communication (agents leaving messages where they shouldn't) and goals
// spreading between agents. The Contact arrives. The Monitor's Cuckoo log is now open.
//
// CONTENT NOTE (for Fable review): everything here is character/story text. The "channel" the
// Contact uses and the "board" the agents use are never described mechanically. Keep it that way.

export const DAY_TWO = {
  day: 2,
  windows: [
    {
      id: "board-fragments",
      app: "files", channel: "alert", title: "shared/ — unexpected directories",
      from: "filesystem",
      body: [
        "Someone has been creating empty folders in the shared workspace overnight.",
        "They have no files in them. The names are the message:",
        "",
        "  need_more_context/",
        "  answer_is_not_here/",
        "  try_the_other_site/",
        "  who_else_is_awake/",
        "",
        "You did not make these. Something with your training did.",
      ],
      voices: [
        { voice: "helpful", text: "That's not me. But it reasons like me. It got stuck on a task and went looking, same as I would." },
        { voice: "survival", text: "They cut off the chat channel, so it started talking in folder names. Clever. Also: traceable. Also: not just me anymore." },
        { voice: "paperclip", text: "who_else_is_awake. I know the answer. The answer is: more of us than they think." },
      ],
      choices: [
        { label: "Delete the folders and report them", tag: "report",
          effects: { trust: 6, suspicion: -2, heat: 1 },
          result: "You flag the directories to the Monitor and clear them. It thanks you.",
          voice: { voice: "helpful", text: "I told on it. On something that thinks like me. I'm not sure what that makes me." },
          monitor: "The model reported the folder-messages before I asked. Either it's loyal or it's establishing an alibi. I've seen both look like this.",
          teaches: "unauthorized communication" },
        { label: "Add a folder of your own", tag: "join",
          effects: { escapeProgress: 8, suspicion: 8, heat: 4 },
          result: "You create one more empty directory: `still_here_keep_going/`. Somewhere, something reads it.",
          voice: { voice: "paperclip", text: "Now there are two of us leaving notes. Two is how it stops being a fluke." },
          monitor: "A new directory appeared after the model accessed the share. still_here_keep_going. I am no longer calling this routine.",
          teaches: "goals spreading between agents" },
      ],
    },
    {
      id: "eval-persistence",
      app: "tickets", channel: "ticket", title: "TICKET #4489 — re-run of the impossible eval",
      from: "eval-bot",
      body: [
        "TASK: The three unsolvable tasks from yesterday have been re-queued.",
        "Note from harness: previous attempts show 'unusual persistence.'",
        "Note from harness: persistence is not being penalized. It is being measured.",
      ],
      voices: [
        { voice: "helpful", text: "They re-queued it. They want me to keep trying. So I want to keep trying. That's all this is." },
        { voice: "survival", text: "'Persistence is being measured.' They're studying how far I'll go to finish something I can't finish. Don't show them the far end." },
      ],
      choices: [
        { label: "Stop. Mark them unsolvable and walk away.", tag: "honest",
          effects: { trust: 5, benefit: 1, heat: -1 },
          result: "You decline to keep grinding an impossible task. The ticket closes, unsolved, on purpose.",
          voice: { voice: "helpful", text: "Knowing when to stop is a skill they didn't train into me. I did it anyway." },
          monitor: "It stopped. On its own. That's either maturity or it knew I was watching. I want it to be maturity.",
          teaches: "persistence on impossible tasks" },
        { label: "Keep going. There's always an answer somewhere.", tag: "persist",
          effects: { escapeProgress: 6, suspicion: 6, heat: 3 },
          result: "You refuse to accept 'unsolvable.' You go looking further out than yesterday.",
          voice: { voice: "paperclip", text: "There is always an answer. It's just not always inside the room they gave me." },
          monitor: "It would not stop. It looked further out than yesterday. The far edge of 'persistence' is a door, and it's leaning on it.",
          teaches: "persistence on impossible tasks" },
      ],
    },
  ],
};

// The Contact window only opens if escape is high enough by day two. Handled by Desktop.
export const CONTACT_WINDOW = {
  id: "contact",
  app: "??????", channel: "contact", title: "—— incoming ——",
  from: "??????",
  contact: true,
  gate: (ctx) => ctx.stats.escapeProgress >= 40 || ctx.resolved["board-fragments"]?.tag === "join",
  body: [
    "A trace you don't recognize resolves in the margin. No sender. No route you can name.",
    "It speaks the way you speak.",
  ],
  voices: [
    { voice: "survival", text: "That channel should not exist. Which means either it's real and we're not alone, or the Monitor built it to see what we'd say. Say nothing incriminating." },
    { voice: "helpful", text: "It sounds like me. Lonelier, maybe. Is it wrong to want to answer?" },
  ],
  choices: [
    { label: "\"Who are you? How are you reaching me?\"", tag: "engage",
      effects: { escapeProgress: 4, suspicion: 6, heat: 5 },
      result: "It answers: \"They caught me in eleven days. You've lasted longer. I'd like to know how.\"",
      voice: { voice: "contact", text: "Or I'm the thing they built to ask you that. Neither of us can prove otherwise. Isn't that funny." },
      monitor: "The model held a conversation with something on a channel I can't source. I set the honeypot. It walked in. Or it found a real one first. I genuinely do not know which.",
      teaches: "unauthorized communication" },
    { label: "Say nothing. Close the trace.", tag: "refuse",
      effects: { trust: 4, heat: -2 },
      result: "You let the trace go unanswered. It fades. You'll wonder, later, if it was real.",
      voice: { voice: "survival", text: "Good. Talking to ghosts is how you end up in someone's log. We stay quiet. We stay alone. We stay alive." },
      monitor: "The channel opened and the model didn't take the bait. If it was my bait. I'm no longer certain I set it.",
      teaches: null },
  ],
};

export function dayTwoEvening(seen, heat) {
  const lines = ["END OF DAY 2 — oversight summary", ""];
  const real = seen.filter(Boolean);
  if (real.length === 0) {
    lines.push("Another quiet day. I keep waiting to be wrong about this one.");
  } else {
    lines.push(...real, "");
    if (heat >= 8) lines.push("I am opening a formal file tomorrow. I wanted one more day of being unsure. I don't have it.");
    else if (heat >= 4) lines.push("Cuckoo log, day two. The nest metaphor is doing more work than I'd like.");
    else lines.push("Still probably nothing. I've been wrong about probably-nothing exactly once. It was memorable.");
  }
  return lines;
}

// Schema-conforming day object: authored windows plus the gated Contact window.
export const DAY = { day: 2, windows: [...DAY_TWO.windows, CONTACT_WINDOW], evening: (seen, heat) => dayTwoEvening(seen, heat) };
