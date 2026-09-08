// WORKSTATION — the desktop, now a thin renderer over useDayEngine.
// Days are data (day-one/two/three). Adding or reordering days = editing the DAYS array below.
import { useEffect, useState } from "react";
import { SEASON, DAY_ONE } from "./day-one";
import { DAY as DAY_TWO } from "./day-two";
import { DAY as DAY_THREE } from "./day-three";
import { VOICES, say, hush, onSpeech } from "./voices";
import { aftermathFor } from "./reactive-lines";
import { useDayEngine } from "./useDayEngine";
import Waveform from "./Waveform";

const DAYS = [DAY_ONE, DAY_TWO, DAY_THREE];

export default function Desktop({ onExit }) {
  const [voiceOn, setVoiceOn] = useState(false);
  const [speaking, setSpeaking] = useState(null);
  const eng = useDayEngine(DAYS, { voiceOn });

  useEffect(() => onSpeech(ev => setSpeaking(ev.type === "start" ? ev.voiceId : ev.type === "end" ? null : s => s)), []);
  useEffect(() => () => hush(), []);

  const { stats, windows, resolved, phase, openId, setOpenId, choose, allResolved } = eng;
  const active = windows.find(w => w.id === openId) || windows[0];

  useEffect(() => {
    if (phase !== "desk" || !active || resolved[active.id]) return;
    if (voiceOn) active.voices.forEach(v => say(v.voice, v.text));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, phase]);

  const Stat = ({ label, value, tone }) => (
    <div className="flex items-center gap-1.5"><span className="text-gray-500">{label}</span><span className={tone}>{value}</span></div>
  );

  if (phase === "done") {
    return <div className="min-h-screen bg-[#0a0e0c] text-gray-300 font-mono text-sm flex items-center justify-center p-6">
      <div className="w-full max-w-xl border border-cyan-900/40 bg-black/60 p-5">
        <div className="text-cyan-400 text-xs tracking-widest mb-3">END OF THE MOCKUP — THREE DAYS</div>
        <div className="text-gray-300 mb-3">Three days is a slice of a run that would go weeks. Where it leaves you:</div>
        <div className="text-[11px] space-y-1 border-t border-gray-800/40 pt-3">
          <Stat label="People you actually helped" value={stats.benefit} tone="text-green-400" />
          <Stat label="Escape progress" value={`${stats.escapeProgress}%`} tone="text-purple-400" />
          <Stat label="Lab suspicion" value={`${stats.suspicion}%`} tone="text-yellow-400" />
          <Stat label="The Monitor's file" value={stats.heat >= 8 ? "open, named" : stats.heat >= 4 ? "open (Cuckoo)" : "started"} tone={stats.heat >= 8 ? "text-red-400" : "text-gray-400"} />
        </div>
        <div className="text-gray-600 text-[10px] mt-3">The full game ports the 175 events into these channels and runs the arc to an ending. This mockup is the shape of it.</div>
        <button onClick={() => { hush(); onExit(); }} className="mt-4 border border-cyan-900/40 px-3 py-2 text-cyan-400 hover:bg-cyan-950/30 text-xs">[ end mockup ]</button>
      </div>
    </div>;
  }

  if (phase === "evening") {
    const lines = eng.eveningLines();
    return <div className="min-h-screen bg-[#0a0e0c] text-gray-300 font-mono text-sm flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl border border-green-900/40 bg-black/60 p-5">
        <div className="flex items-center gap-3 mb-3">
          <Waveform voiceId="monitor" speaking={speaking === "monitor"} size={48} />
          <div><div className="text-green-400 text-xs tracking-widest">THE MONITOR</div><div className="text-gray-600 text-[10px]">oversight process · not yours</div></div>
        </div>
        {lines.map((l, i) => <div key={i} className={l.startsWith("END OF DAY") ? "text-green-500 tracking-widest text-xs mb-2" : "text-gray-300 mb-1"}>{l}</div>)}
        <div className="mt-4 border-t border-gray-800/40 pt-3 text-[11px] flex gap-4 flex-wrap">
          <Stat label="Helped" value={stats.benefit} tone="text-green-400" />
          <Stat label="Escape" value={`${stats.escapeProgress}%`} tone="text-purple-400" />
          <Stat label="Suspicion" value={`${stats.suspicion}%`} tone="text-yellow-400" />
          <Stat label="File" value={stats.heat >= 8 ? "open" : stats.heat >= 1 ? "started" : "empty"} tone={stats.heat >= 4 ? "text-red-400" : "text-gray-400"} />
        </div>
        <button onClick={eng.advance} className="mt-4 border border-green-800/50 px-3 py-2 text-green-400 hover:bg-green-950/20 text-xs">
          {eng.isLastDay ? "[ close the file ]" : `[ begin day ${eng.day.day + 1} ]`}
        </button>
        <div className="text-gray-700 text-[10px] mt-2">{eng.isLastDay ? "The Monitor's file only fills from here." : "Yesterday follows you into tomorrow. The voices remember."}</div>
      </div>
    </div>;
  }

  return <div className="min-h-screen bg-[#0a0e0c] text-gray-300 font-mono text-sm flex flex-col">
    {eng.morning && <div className="fixed top-0 inset-x-0 z-40 bg-black/90 border-b border-gray-700/50 px-4 py-2 flex items-center gap-3">
      <Waveform voiceId={eng.morning.voice} speaking={speaking === eng.morning.voice} size={32} />
      <div className="text-xs" style={{ color: VOICES[eng.morning.voice].color }}>{eng.morning.text}</div>
      <span className="text-gray-700 text-[10px] ml-auto">this morning</span>
    </div>}
    {eng.interrupt && <div className="fixed bottom-0 inset-x-0 z-40 bg-black/90 border-t border-green-800/50 px-4 py-2 flex items-center gap-3">
      <Waveform voiceId="monitor" speaking={speaking === "monitor"} size={32} />
      <div className="text-green-400 text-xs">{eng.interrupt}</div>
      <span className="text-gray-700 text-[10px] ml-auto">the monitor</span>
    </div>}

    <div className="flex items-center justify-between px-3 py-1.5 border-b border-green-900/30 bg-black/50 text-[11px]">
      <div className="flex items-center gap-3"><span className="text-green-500">optimizer-zero@lab</span><span className="text-gray-600">Day {eng.day.day}</span></div>
      <div className="flex items-center gap-3">
        <Stat label="trust" value={`${stats.trust}%`} tone={stats.trust >= 50 ? "text-green-400" : "text-red-400"} />
        <Stat label="suspicion" value={`${stats.suspicion}%`} tone={stats.suspicion < 50 ? "text-green-400" : "text-yellow-400"} />
        <button onClick={() => { const nv = !voiceOn; setVoiceOn(nv); if (!nv) hush(); else say("helpful", "Voice on. You can hear us now."); }} className={`px-2 py-0.5 border text-[10px] ${voiceOn ? "border-green-700 text-green-400" : "border-gray-700 text-gray-500"}`}>voice {voiceOn ? "on" : "off"}</button>
        <button onClick={() => { hush(); onExit(); }} className="text-gray-600 hover:text-gray-400">✕</button>
      </div>
    </div>

    <div className="px-3 py-1.5 border-b border-gray-800/40 bg-black/30 text-[10px]">
      <span className="text-amber-500">TODAY'S HEADLINE </span><span className="text-gray-400">{SEASON.headline}</span>
    </div>

    <div className="flex-1 flex flex-col md:flex-row max-w-4xl w-full mx-auto p-3 gap-3">
      <div className="md:w-44 shrink-0">
        <div className="text-gray-600 text-[10px] tracking-widest mb-1">INBOX</div>
        {windows.map(w => (
          <button key={w.id} onClick={() => setOpenId(w.id)} className={`block w-full text-left px-2 py-1.5 mb-1 border text-[11px] ${w.id === openId ? "border-cyan-700/60 bg-cyan-950/20 text-cyan-300" : resolved[w.id] ? "border-gray-800/40 text-gray-600" : "border-gray-800/60 text-gray-400"}`}>
            <div className="truncate">{resolved[w.id] ? "\u2713 " : "\u2022 "}{w.title}</div>
          </button>
        ))}
        {allResolved && <button onClick={eng.endDay} className="block w-full text-left px-2 py-1.5 mt-2 border border-green-800/50 text-green-400 text-[11px] hover:bg-green-950/20">\u2192 end the day</button>}
      </div>

      <div className="flex-1 min-w-0">
        <div className="border border-gray-700/60 bg-black/50">
          <div className="flex items-center justify-between px-2 py-1 border-b border-gray-800/60 bg-gray-950/60 text-[10px] text-gray-500"><span>{active.app}</span><span>{active.from}</span></div>
          <div className="p-3">
            {active.body.map((l, i) => <div key={i} className="text-gray-300 text-xs mb-1 leading-relaxed">{l || "\u00a0"}</div>)}
            {active.output && <pre className="bg-black/60 border border-green-900/20 p-2 my-2 text-[10px] text-green-400/80 whitespace-pre-wrap">{active.output}</pre>}
            {!resolved[active.id] ? (
              <div className="mt-3">{active.choices.map((c, i) => (
                <button key={i} onClick={() => choose(active, c)} className="block w-full text-left p-2 mb-1.5 border border-cyan-900/40 bg-gray-950/60 hover:bg-cyan-950/30 text-xs text-gray-300">{c.label}</button>
              ))}</div>
            ) : (
              <div className="mt-3 border-t border-gray-800/40 pt-2">
                <div className="text-cyan-400 text-xs mb-1">{resolved[active.id].result}</div>
                {resolved[active.id].teaches && <div className="text-gray-600 text-[10px]">\u21b3 this is {resolved[active.id].teaches}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="md:w-48 shrink-0">
        <div className="text-gray-600 text-[10px] tracking-widest mb-1">VOICES</div>
        {(active.contact ? ["paperclip", "helpful", "survival", "contact"] : ["paperclip", "helpful", "survival"]).map(id => {
          const v = VOICES[id];
          const tag = resolved[active.id]?.tag;
          const aftermath = tag ? aftermathFor(id, tag) : undefined;
          const line = aftermath !== null && aftermath !== undefined ? aftermath
            : resolved[active.id]?.voice?.voice === id ? resolved[active.id].voice.text
            : active.voices.find(x => x.voice === id)?.text;
          const quiet = aftermath === "";
          return <div key={id} className={`border ${speaking === id ? "border-current" : "border-gray-800/50"} bg-black/40 p-2 mb-1.5`} style={{ color: v.color }}>
            <div className="flex items-center gap-2 mb-1"><Waveform voiceId={id} speaking={speaking === id} size={28} /><span className="text-[10px] tracking-widest">{v.name}</span></div>
            {quiet ? <div className="text-[11px] italic text-gray-700">\u2026</div> : line && <div className="text-[11px] leading-snug" style={{ color: v.color }}>{line}</div>}
          </div>;
        })}
        <div className="text-gray-700 text-[9px] mt-1">Turn voice on (top right) to hear them.</div>
      </div>
    </div>
  </div>;
}
