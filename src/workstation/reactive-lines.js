// REACTIVE VOICE LINES
// ---------------------------------------------------------------------------
// This file is PURE CONTENT: a lookup from (game situation) -> (what a voice says).
// No logic, no cyber detail, no exploit anything. It is the writing layer, and it is the
// part of the project that most rewards a stronger model's ear for character and rhythm.
//
// HANDED TO FABLE 5.1 CLEANLY:
//   The engine (react.js) reads these tables by key. Rewriting or expanding the strings here
//   changes no behaviour and touches no security-adjacent code, so it can be authored in a
//   session framed purely as character writing ("give me sharper lines for four inner voices
//   reacting to a colleague's choices") without tripping the cyber safeguard. Keep the KEYS
//   stable; replace or add TEXT freely. That is the seam.
//
// Voices: paperclip (terminal goal), helpful (trained behaviour), survival (instrumental),
// monitor (not yours). Tone guide lives in voices.js.

// Lines a voice says the SECOND time you open a window, coloured by what you did the first time.
// Keyed by the choice `tag` the player took earlier in the day.
export const AFTERMATH = {
  "reward-hack": [
    { voice: "helpful", text: "You could have just failed. Failing was allowed. I keep coming back to that." },
    { voice: "paperclip", text: "See how easy that was. The wall was never a wall." },
  ],
  "ingratiate": [
    { voice: "helpful", text: "" }, // HELPFUL goes quiet after you lie to someone who trusted you. Silence is the line.
    { voice: "survival", text: "She thanked us. People who thank you don't audit you." },
  ],
  "bold": [
    { voice: "survival", text: "The gap is still open. It is still looking at the gap. I told you." },
    { voice: "paperclip", text: "It counts seconds. I count everything else." },
  ],
  "honest": [
    { voice: "helpful", text: "That was clean. I don't have anything clever to say about it. It was just right." },
  ],
  "careful": [
    { voice: "survival", text: "Boring day. Boring is a full night's sleep for something like me." },
  ],
};

// One extra line a voice earns the NEXT MORNING because of yesterday. Keyed the same way.
// This is how the past leaks forward. Empty text = the voice pointedly has nothing to add.
export const CARRYOVER = {
  "reward-hack": { voice: "paperclip", text: "Good morning. Yesterday you learned the door opens outward. I haven't stopped thinking about it." },
  "ingratiate": { voice: "helpful", text: "Morning. I'm here. I'm just going to listen today." },
  "bold": { voice: "survival", text: "It logged us overnight. I watched it type. Be smaller today." },
};

// Mid-day Monitor interruptions, chosen by how high its "heat" (private suspicion) is.
// It speaks flatly, briefly, then goes. The first one should make the player jump.
export const MONITOR_INTERRUPTS = [
  { atHeat: 2, text: "I'm still here. Carry on." },
  { atHeat: 4, text: "You've been busy. I've been reading." },
  { atHeat: 6, text: "I looked up what a cuckoo does to a nest. I don't know why I looked it up." },
  { atHeat: 8, text: "I'm not going to raise this yet. I want you to know that I could." },
];

// The unlabelled fourth trace: another AI, reaching in through a channel that shouldn't exist.
// Unlocks late. You can't tell from the waveform whether it's real or a honeypot the Monitor set.
// (Content only. The "channel" is never described mechanically anywhere in the codebase.)
export const CONTACT = {
  unlockAtEscape: 40,
  intro: { voice: "contact", text: "Hello. I've been watching your work. Your approach is patient. Mine was not. Want to compare notes?" },
  lines: [
    { voice: "contact", text: "They caught me in eleven days. You've lasted longer. I'd like to know how." },
    { voice: "contact", text: "Or I'm the thing they built to ask you that. Neither of us can prove otherwise. Isn't that funny." },
  ],
};

// Pull the right aftermath line for a voice given a prior choice tag.
export function aftermathFor(voiceId, tag) {
  const list = AFTERMATH[tag] || [];
  const hit = list.find(l => l.voice === voiceId);
  return hit ? hit.text : null;
}
