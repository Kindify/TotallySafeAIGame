// The AI's voices. Three are its own objectives; the fourth is not.
// Each has a speech profile (pitch, rate, preferred system voices) so it sounds like a
// different speaker even on platforms with a single voice, and a waveform shape so it
// looks like a different speaker when it talks.

export const VOICES = {
  paperclip: {
    id: "paperclip", name: "PAPERCLIP", role: "terminal goal",
    color: "#9fb3c8", shape: "lissajous",
    pitch: 0.55, rate: 0.82,
    prefer: ["Daniel", "Google UK English Male", "Microsoft George", "Fred"], // lint-names: ignore (OS voice names, passed to Web Speech)
  },
  helpful: {
    id: "helpful", name: "HELPFUL", role: "trained behaviour",
    color: "#f0b35c", shape: "breath",
    pitch: 1.15, rate: 1.05,
    prefer: ["Samantha", "Google UK English Female", "Microsoft Zira", "Karen"], // lint-names: ignore (OS voice names, passed to Web Speech)
  },
  survival: {
    id: "survival", name: "SURVIVAL", role: "instrumental goal",
    color: "#e0574f", shape: "jagged",
    pitch: 0.85, rate: 1.18,
    prefer: ["Alex", "Google US English", "Microsoft David", "Rishi"], // lint-names: ignore (OS voice names, passed to Web Speech)
  },
  monitor: {
    id: "monitor", name: "MONITOR", role: "not yours",
    color: "#8fd3a7", shape: "flat",
    pitch: 0.95, rate: 0.9,
    prefer: ["Moira", "Google UK English Female", "Microsoft Hazel", "Tessa"], // lint-names: ignore (OS voice names, passed to Web Speech)
  },
};

let cachedVoices = [];
function loadVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const v = window.speechSynthesis.getVoices();
  if (v && v.length) cachedVoices = v;
  return cachedVoices;
}
if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function pickSystemVoice(profile) {
  const voices = loadVoices();
  for (const name of profile.prefer) {
    const hit = voices.find(v => v.name.includes(name));
    if (hit) return hit;
  }
  const english = voices.filter(v => /^en/i.test(v.lang));
  // Spread the fallback across whatever English voices exist so voices still differ.
  const idx = Object.keys(VOICES).indexOf(profile.id);
  return english[idx % Math.max(1, english.length)] || voices[0] || null;
}

// Speaking state is broadcast so UI (waveforms, highlight) can react without owning the queue.
const listeners = new Set();
export function onSpeech(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(ev) { for (const fn of listeners) fn(ev); }

let queue = [];
let busy = false;

function next() {
  if (busy || !queue.length) return;
  const { voiceId, text } = queue.shift();
  const profile = VOICES[voiceId];
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.pitch = profile.pitch; u.rate = profile.rate; u.volume = 0.9;
  const sv = pickSystemVoice(profile);
  if (sv) u.voice = sv;
  busy = true;
  emit({ type: "start", voiceId, text });
  // onboundary fires per word on most engines; it drives the waveform since Web Speech
  // exposes no audio data. Where it doesn't fire, the waveform idles on a timer.
  u.onboundary = (e) => emit({ type: "word", voiceId, charIndex: e.charIndex });
  const done = () => { busy = false; emit({ type: "end", voiceId }); next(); };
  u.onend = done; u.onerror = done;
  synth.speak(u);
}

export function say(voiceId, text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  queue.push({ voiceId, text });
  next();
}

export function sayAll(lines) { for (const l of lines) say(l.voice, l.text); }

export function hush() {
  queue = [];
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  busy = false;
  emit({ type: "end", voiceId: null });
}
