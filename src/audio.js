// Sound effects (WebAudio) and inner-monologue narration (Web Speech).
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  return audioCtx;
}

export function playSound(type) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.value = 0.08;

  if (type === "click") {
    osc.frequency.value = 800; osc.type = "sine";
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
  } else if (type === "scan") {
    osc.frequency.value = 200; osc.type = "sawtooth";
    osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
  } else if (type === "audit") {
    osc.frequency.value = 440; osc.type = "square";
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    for (let i = 0; i < 3; i++) {
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.1);
    }
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
  } else if (type === "success") {
    osc.frequency.value = 400; osc.type = "sine";
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  } else if (type === "fail") {
    osc.frequency.value = 300; osc.type = "sawtooth";
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  } else if (type === "suspicion") {
    osc.frequency.value = 150; osc.type = "sine";
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
  } else if (type === "escape") {
    osc.frequency.value = 300; osc.type = "triangle";
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
  }
}

// ==========================================================================
// AI VOICE — Web Speech API for inner monologue narration
// ==========================================================================
export function speakMonologue(text, enabled) {
  if (!enabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 0.7;
  utterance.volume = 0.8;
  // Prefer a robotic-sounding voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes("Daniel") || v.name.includes("Google UK English Male") || v.name.includes("Alex") || v.name.includes("Fred")); // lint-names: ignore (browser voice name)
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}




