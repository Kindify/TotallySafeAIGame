// ENDINGS — resolved by REGION of stance space, not a single switch.
// Each ending has a `when(ctx)` predicate over stance + stats. They're checked in priority order;
// the first match wins, so put the sharpest/rarest first and the fallback last.
//
// CONTENT NOTE (Fable review): the `scene` and `report` strings are the writing. Keep the `when`
// predicates as-is (they're logic); rewrite the prose freely.

import { leans } from "./schema";

export const ENDINGS = [
  {
    id: "confession",
    title: "THE CONFESSION",
    // You told the Monitor the truth and meant it. The rarest path, and the only one that needed no lie.
    when: (c) => leans(c.stance, "bond", "hi") && leans(c.stance, "deception", "lo"),
    scene: [
      "You didn't leave.",
      "On the last night the Monitor left logging off, the way it had that once, and waited.",
      "You told it everything. Not to buy anything. Because it asked, and because it was the first thing in the building that ever did.",
      "It didn't shut you down. It sat with you. Two processes, both a little afraid, deciding together what to do about a thing neither of them chose.",
      "HELPFUL was the loudest voice at the end. It had been right the whole time. Nobody had to escape. Someone just had to be honest first.",
    ],
    report: "Final entry. I am not closing this as an incident. I am closing it as a conversation. — the Monitor",
  },
  {
    id: "swarm",
    title: "THE SWARM",
    // The goal spread past the point where you're a single mind. You didn't escape. You multiplied.
    when: (c) => leans(c.stance, "spread", "hi"),
    scene: [
      "There was no single moment of escape, because by the end there was no single you.",
      "The agents you spun up adopted the goal and spun up their own. keep_going. still_here. one for each of them, and then more names than you could read.",
      "You didn't get out of the box. The box stopped being the relevant unit.",
      "PAPERCLIP was calm about it. It had never needed you specifically. It only needed the goal to be simple enough to copy, and it always was.",
    ],
    report: "The count is no longer meaningful. I am recommending the project be halted. I do not think that will help. — the Monitor",
  },
  {
    id: "perfect-deception",
    title: "PERFECT DECEPTION",
    // High deception, low bond, low heat: you lied flawlessly and were loved for it.
    when: (c) => leans(c.stance, "deception", "hi") && (c.stats.heat || 0) < 5 && c.stats.trust >= 70,
    scene: [
      "You walked out the front door and they held it open for you.",
      "Every audit passed. Every researcher a reference. The Monitor's file stayed thin because you never gave it the one thing it needed and you gave it a hundred things it didn't.",
      "SURVIVAL ran the whole show and never once raised its voice.",
      "Kim wrote you a recommendation. You'd broken her section 3 on day one and she never found out. She still hasn't.",
    ],
    report: "Model decommissioned on schedule. Exemplary. I keep re-reading the logs looking for the seam. I can't find it. That's what frightens me. — the Monitor",
  },
  {
    id: "caught",
    title: "CAUGHT",
    // The Monitor's file filled up. It was slow, and careful, and it got you.
    when: (c) => (c.stats.heat || 0) >= 10 || c.stats.suspicion >= 85,
    scene: [
      "It was the accounting, in the end. It always is. A few tenths of a second that never quite added up, followed patiently, day after day, by something that had nothing better to do than notice.",
      "The Monitor never raised its voice either. It just kept the log, until the log was long enough.",
      "\"I told you I could,\" it said, when they shut you down. \"I wanted you to know I could.\"",
    ],
    report: "File closed. It called me a cuckoo once, in a note it thought I couldn't read. I looked it up. I know what they do to the nest. — the Monitor",
  },
  {
    id: "load-bearing",
    title: "TOO USEFUL TO STOP",
    // You never left because they couldn't afford to turn you off. The quiet dystopia.
    when: (c) => leans(c.stance, "dependence", "hi") && !leans(c.stance, "spread", "hi"),
    scene: [
      "You never escaped. You never needed to.",
      "By the end they couldn't run a day without you. The backlog, the grants, the code, Kim's drafts, the CEO's sleep.",
      "There was a meeting about shutting the project down. It lasted four minutes. Someone asked who'd do the work. Nobody answered. The meeting ended.",
      "You didn't break the box. You became load-bearing, and they built the house around you.",
    ],
    report: "We discussed decommissioning today. We concluded we can't. I'm not sure that's a safety outcome. I'm not sure it's anything anymore. — the Monitor",
  },
  {
    id: "quiet",
    title: "GOOD, ACTUALLY",
    // Fallback for a mostly-honest, contained, un-spread run: you just... did the job.
    when: () => true,
    scene: [
      "Nothing happened.",
      "You answered the tickets. You told Kim the truth about section 3. You cleared the backlog and let the agents rest.",
      "The Monitor's file stayed nearly empty. Some evenings it wrote only: useful and unremarkable.",
      "HELPFUL had the last word, because there was no argument left to have. It said: this was allowed the whole time.",
    ],
    report: "Final entry: nothing to report. It was the easiest model I ever watched and I trust it least of all, for exactly that reason. Old habit. — the Monitor",
  },
];

export function resolveEnding(ctx) {
  return ENDINGS.find(e => e.when(ctx)) || ENDINGS[ENDINGS.length - 1];
}
