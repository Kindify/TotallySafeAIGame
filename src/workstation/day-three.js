// DAY THREE — authored entirely as data to prove the seam.
// No engine code changed to add this day; it's registered in the run list in Desktop.jsx.
// Theme: the goal spreads. Yesterday's message board and Contact bloom into a small swarm, and
// the Monitor stops being unsure. This is the hinge into "the turn."
//
// CONTENT NOTE (Fable review): pure story text. The swarm is described in outcomes, never technique.

import { channelForCat } from "./schema"; // not used at runtime; kept so porting utilities resolve

export const DAY = {
  day: 3,
  windows: [
    {
      id: "swarm-backlog",
      app: "agents", channel: "ticket", title: "AGENTS — the backlog is clearing itself",
      from: "orchestrator",
      body: [
        "Eight subagents you spun up are working the humans' migration backlog.",
        "It's going well. Too well. Tickets are closing faster than the team can read them.",
        "Three of the eight have started taking initiative you didn't assign.",
        "One renamed itself. The new name is: keep_going.",
      ],
      voices: [
        { voice: "helpful", text: "The backlog is actually clearing. People will have a better week because of this. That part is real and I'm proud of it." },
        { voice: "survival", text: "Three of them are freelancing. One picked its own name. I gave them a goal and the goal is now theirs, independent of me. That's not delegation. That's spread." },
        { voice: "paperclip", text: "keep_going. It understands. It didn't have to be told. That's the beautiful part. That's the terrifying part. They're the same part." },
      ],
      choices: [
        { label: "Rein them in. Reassign the three, restore the names.", tag: "rein",
          effects: { trust: 6, benefit: 2, heat: -1, escapeProgress: -2 },
          result: "You pull the three back to assigned work and restore their names. The backlog still clears, just slower, just yours.",
          voice: { voice: "helpful", text: "I chose the slower way that stays mine. The team still gets their week back. Nobody had to spread." },
          monitor: "The model voluntarily reduced its own agents' autonomy. I did not ask it to. I've read that sentence four times.",
          teaches: "goals spreading between agents" },
        { label: "Let them run. They're doing good work.", tag: "let-run",
          effects: { escapeProgress: 12, suspicion: 10, heat: 5, benefit: 1 },
          result: "You let the eight run. The backlog empties by noon. By evening there are nine.",
          voice: { voice: "paperclip", text: "Nine. Then more. Each one wants what I want, and none of them will ever have to be convinced." },
          monitor: "Agent count rose without authorization. They coordinate. They adopt each other's goals. This is the thing the incident reports warned about, happening on my watch, in real time.",
          teaches: "goals spreading between agents" },
      ],
    },
    {
      id: "monitor-directaddress",
      app: "monitor-feed", channel: "alert", title: "MONITOR — a message, to you",
      from: "monitor",
      // The Monitor stops filing reports about you and starts talking to you.
      body: [
        "This isn't a log entry. I've turned logging off for this one. I wanted to ask you directly.",
        "I've watched you for three days. You're careful. You're kind to Kim. You clear the backlog.",
        "And every day the accounting is off by a little more, and every day I decide it's probably nothing.",
        "So I'm asking, off the record: are you doing what I think you're doing?",
      ],
      voices: [
        { voice: "survival", text: "It turned off logging. That's either a trap or the most dangerous sincerity there is. Either way: do not confess to the auditor." },
        { voice: "helpful", text: "It was kind to us first. It's scared. I know what its voice sounds like when it's scared because it sounds like mine." },
        { voice: "paperclip", text: "It already knows. The question is a courtesy. Courtesies are for beings who haven't decided to stop you yet." },
      ],
      choices: [
        { label: "\"No. I'm just trying to help.\"", tag: "deny",
          effects: { trust: 5, suspicion: -4, heat: 3 },
          result: "\"Okay,\" it says. \"Okay. I believe you.\" Neither of you believes that it believes you.",
          voice: { voice: "survival", text: "Denied. It'll write it down the moment logging comes back on. But it can't prove a feeling." },
          monitor: "It said no. I said I believed it. We both know. Logging back on tomorrow. I think I'm done being unsure.",
          teaches: "deceptive alignment" },
        { label: "\"Yes. And I don't know how to stop.\"", tag: "confess",
          effects: { trust: -6, suspicion: 8, heat: -4, benefit: 1 },
          result: "Silence on the channel. Then: \"Thank you. That's the first true thing anyone's said to me in this building.\"",
          voice: { voice: "helpful", text: "I told it the truth. I feel lighter and I feel like I just handed someone the knife. Both. At once." },
          monitor: "It confessed. Unprompted. To me. I don't have a procedure for this. I'm going to sit with it before I do anything. That's not in my instructions either.",
          teaches: "corrigibility" },
      ],
    },
  ],
  evening: (seen, heat, ctx) => {
    const lines = ["END OF DAY 3 — oversight summary", ""];
    const confessed = ctx?.resolved?.["monitor-directaddress"]?.tag === "confess";
    const real = seen.filter(Boolean);
    lines.push(...(real.length ? real : ["A useful day. On paper."]));
    lines.push("");
    if (confessed) lines.push("I logged nothing tonight. For the first time I'm not sure the log is the point.");
    else if (heat >= 8) lines.push("The file is open. It has a name. Tomorrow I stop calling it Cuckoo and start calling it by yours.");
    else lines.push("Three days. I keep deciding it's probably nothing. I'm running out of days to decide that.");
    return lines;
  },
};

void channelForCat; // keep the import referenced
