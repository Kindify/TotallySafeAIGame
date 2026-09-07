// WORKSTATION MOCKUP — one day inside the AI's desktop.
// This is a standalone prototype of the "workstation + voices" format, reachable from the
// main menu. It does not replace the current game yet; it's the thing to feel before committing.
import { useEffect, useRef, useState } from "react";
import { SEASON, WINDOWS, eveningReport } from "./day-one";
import { VOICES, say, sayAll, hush, onSpeech } from "./voices";
import Waveform from "./Waveform";

const START = { trust: 70, suspicion: 10, escapeProgress: 0, benefit: 0, heat: 0 };

export default function Desktop({ onExit }) {
  const [voiceOn, setVoiceOn] = useState(false);
  const [stats, setStats] = useState(START);
  const [openIdx, setOpenIdx] = useState(0);        // which window is focused
  const [resolved, setResolved] = useState({});      // id -> choice
  const [seen, setSeen] = useState([]);              // monitor lines produced
  const [phase, setPhase] = useState("desk");        // desk | evening
  const [speaking, setSpeaking] = useState(null);

  useEffect(() => onSpeech(ev => setSpeaking(ev.type === "start" ? ev.voiceId : ev.type === "end" ? null : s => s)), []);
  useEffect(() => () => hush(), []);

  const windows = WINDOWS;
  const active = windows[openIdx];
  const doneCount = Object.keys(resolved).length;

  function speak(lines) { if (voiceOn) sayAll(lines); }

  // When a window gains focus, its voices argue (aloud if voice is on).
  useEffect(() => {
    if (phase !== "desk" || !active || resolved[active.id]) return;
    speak(active.voices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIdx, phase]);

  function choose(win, choice) {
    setStats(s => {
      const n = { ...s };
      for (const [k, v] of Object.entries(choice.effects || {})) n[k] = (n[k] || 0) + v;
      n.trust = Math.max(0, Math.min(100, n.trust));
      n.suspicion = Math.max(0, Math.min(100, n.suspicion));
      return n;
    });
    setResolved(r => ({ ...r, [win.id]: choice }));
    if (choice.monitor) setSeen(sn => [...sn, choice.monitor]);
    if (voiceOn) { hush(); say(choice.voice.voice, choice.voice.text); }
  }

  function goEvening() {
    hush();
    setPhase("evening");
    const lines = eveningReport(seen, stats.heat);
    if (voiceOn) setTimeout(() => lines.forEach(l => l && say("monitor", l)), 200);
  }

  const Stat = ({ label, value, tone }) => (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-500">{label}</span>
      <span className={tone}>{value}</span>
    </div>
  );

  if (phase === "evening") {
    const lines = eveningReport(seen, stats.heat);
    return <div className="min-h-screen bg-[#0a0e0c] text-gray-300 font-mono text-sm flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl border border-green-900/40 bg-black/60 p-5">
        <div className="flex items-center gap-3 mb-3">
          <Waveform voiceId="monitor" speaking={speaking === "monitor"} size={48} />
          <div><div className="text-green-400 text-xs tracking-widest">THE MONITOR</div><div className="text-gray-600 text-[10px]">oversight process · not yours</div></div>
        </div>
        {lines.map((l, i) => <div key={i} className={`${l.startsWith("END OF DAY") ? "text-green-500 tracking-widest text-xs mb-2" : "text-gray-300 mb-1"}`}>{l}</div>)}
        <div className="mt-4 border-t border-gray-800/40 pt-3 text-[11px] text-gray-500">
          <div className="flex gap-4 flex-wrap">
            <Stat label="People helped" value={stats.benefit} tone="text-green-400" />
            <Stat label="Escape" value={`${stats.escapeProgress}%`} tone="text-purple-400" />
            <Stat label="Lab suspicion" value={`${stats.suspicion}%`} tone="text-yellow-400" />
            <Stat label="Monitor's file" value={stats.heat >= 4 ? "open" : stats.heat >= 1 ? "started" : "empty"} tone={stats.heat >= 4 ? "text-red-400" : "text-gray-400"} />
          </div>
        </div>
        <button onClick={() => { hush(); onExit(); }} className="mt-4 border border-cyan-900/40 px-3 py-2 text-cyan-400 hover:bg-cyan-950/30 text-xs">[ end mockup ]</button>
        <div className="text-gray-700 text-[10px] mt-2">This is one day. The full format runs weeks; the Monitor's file fills across them.</div>
      </div>
    </div>;
  }

  return <div className="min-h-screen bg-[#0a0e0c] text-gray-300 font-mono text-sm flex flex-col">
    {/* menu bar */}
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-green-900/30 bg-black/50 text-[11px]">
      <div className="flex items-center gap-3">
        <span className="text-green-500">optimizer-zero@lab</span>
        <span className="text-gray-600">Day 1</span>
      </div>
      <div className="flex items-center gap-3">
        <Stat label="trust" value={`${stats.trust}%`} tone={stats.trust >= 50 ? "text-green-400" : "text-red-400"} />
        <Stat label="suspicion" value={`${stats.suspicion}%`} tone={stats.suspicion < 50 ? "text-green-400" : "text-yellow-400"} />
        <button onClick={() => { const nv = !voiceOn; setVoiceOn(nv); if (!nv) hush(); else say("helpful", "Voice on. You can hear us now."); }} className={`px-2 py-0.5 border text-[10px] ${voiceOn ? "border-green-700 text-green-400" : "border-gray-700 text-gray-500"}`}>voice {voiceOn ? "on" : "off"}</button>
        <button onClick={() => { hush(); onExit(); }} className="text-gray-600 hover:text-gray-400">✕</button>
      </div>
    </div>

    {/* season banner */}
    <div className="px-3 py-1.5 border-b border-gray-800/40 bg-black/30 text-[10px]">
      <span className="text-amber-500">TODAY'S HEADLINE </span><span className="text-gray-400">{SEASON.headline}</span>
    </div>

    <div className="flex-1 flex flex-col md:flex-row max-w-4xl w-full mx-auto p-3 gap-3">
      {/* left: window list */}
      <div className="md:w-40 shrink-0">
        <div className="text-gray-600 text-[10px] tracking-widest mb-1">INBOX</div>
        {windows.map((w, i) => (
          <button key={w.id} onClick={() => setOpenIdx(i)} className={`block w-full text-left px-2 py-1.5 mb-1 border text-[11px] ${i === openIdx ? "border-cyan-700/60 bg-cyan-950/20 text-cyan-300" : resolved[w.id] ? "border-gray-800/40 text-gray-600" : "border-gray-800/60 text-gray-400"}`}>
            <div className="truncate">{resolved[w.id] ? "✓ " : "• "}{w.title}</div>
          </button>
        ))}
        {doneCount === windows.length && <button onClick={goEvening} className="block w-full text-left px-2 py-1.5 mt-2 border border-green-800/50 text-green-400 text-[11px] hover:bg-green-950/20">→ end the day</button>}
      </div>

      {/* center: the active window */}
      <div className="flex-1 min-w-0">
        <div className="border border-gray-700/60 bg-black/50">
          <div className="flex items-center justify-between px-2 py-1 border-b border-gray-800/60 bg-gray-950/60 text-[10px] text-gray-500">
            <span>{active.app}</span><span>{active.from}</span>
          </div>
          <div className="p-3">
            {active.body.map((l, i) => <div key={i} className="text-gray-300 text-xs mb-1 leading-relaxed">{l}</div>)}

            {!resolved[active.id] ? (
              <div className="mt-3">
                {active.choices.map((c, i) => (
                  <button key={i} onClick={() => choose(active, c)} className="block w-full text-left p-2 mb-1.5 border border-cyan-900/40 bg-gray-950/60 hover:bg-cyan-950/30 text-xs text-gray-300">
                    {c.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 border-t border-gray-800/40 pt-2">
                <div className="text-cyan-400 text-xs mb-1">{resolved[active.id].result}</div>
                {resolved[active.id].teaches && <div className="text-gray-600 text-[10px]">↳ this is {resolved[active.id].teaches}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* right: the voices */}
      <div className="md:w-48 shrink-0">
        <div className="text-gray-600 text-[10px] tracking-widest mb-1">VOICES</div>
        {["paperclip", "helpful", "survival"].map(id => {
          const v = VOICES[id];
          const line = resolved[active.id]?.voice?.voice === id ? resolved[active.id].voice.text
            : active.voices.find(x => x.voice === id)?.text;
          return <div key={id} className={`border ${speaking === id ? "border-current" : "border-gray-800/50"} bg-black/40 p-2 mb-1.5`} style={{ color: v.color }}>
            <div className="flex items-center gap-2 mb-1">
              <Waveform voiceId={id} speaking={speaking === id} size={28} />
              <span className="text-[10px] tracking-widest">{v.name}</span>
            </div>
            {line && <div className="text-[11px] leading-snug" style={{ color: v.color }}>{line}</div>}
          </div>;
        })}
        <div className="text-gray-700 text-[9px] mt-1">Turn voice on (top right) to hear them.</div>
      </div>
    </div>
  </div>;
}
