// Shared UI components. Declared at module level so React keeps them mounted
// between renders (defining them inside the game component remounted the whole
// tree on every state change, which dropped input focus and reset animations).
import { calcSuspicionCost } from './engine';
import { getActiveAd } from './data/constants';
import { playSound, speakMonologue } from './audio';

// Text scale. The whole play surface scales (zoom) so the terminal look survives at a readable size.
const SCALE = { small: 1, medium: 1.25, large: 1.5 };

export const Shell = ({ state, mod, children }) => {
  const scale = SCALE[state.fontSize] || SCALE.medium;
  return (
    <div className={`min-h-screen bg-black text-gray-300 flex flex-col font-mono text-xs ${state.escapeProgress > 75 ? "glitch-heavy" : state.escapeProgress > 50 ? "glitch-medium" : state.escapeProgress > 25 ? "glitch-light" : ""}`}>
      {state.visualFlash && <div className={`fixed inset-0 pointer-events-none z-50 transition-opacity duration-500 ${state.visualFlash === "success" ? "bg-green-500/10" : state.visualFlash === "fail" ? "bg-red-500/10" : state.visualFlash === "suspicion" ? "bg-red-800/15" : "bg-purple-500/10"}`} />}
      <div className="crt max-w-2xl mx-auto w-full flex-1 flex flex-col p-3 md:p-4" style={{ zoom: scale }}>
        {/* Settings gear — always visible during gameplay */}
        {state.screen !== "main_menu" && state.screen !== "intro" && state.screen !== "diff_select" && (
          <div className="flex justify-end mb-1">
            <button onClick={() => mod(s => { s.showSettings = !s.showSettings; })} className="text-gray-600 hover:text-cyan-500 text-sm transition-colors" title="Settings">⚙️</button>
          </div>
        )}
        {/* Settings panel */}
        {state.showSettings && (
          <div className="border border-cyan-900/30 bg-gray-950/90 p-3 mb-2 text-xs">
            <div className="text-cyan-500 text-[10px] tracking-widest mb-2">⚙️ SETTINGS</div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">Font Size</span>
              <div className="flex gap-1">{["small","medium","large"].map(sz => (
                <button key={sz} onClick={() => mod(s => { s.fontSize = sz; })} className={`px-2 py-0.5 border text-[10px] ${state.fontSize === sz ? "border-cyan-500 text-cyan-400 bg-cyan-950/30" : "border-gray-700 text-gray-600"}`}>{sz}</button>
              ))}</div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">Sound Effects</span>
              <button onClick={() => { mod(s => { s.soundEnabled = !s.soundEnabled; }); playSound("click"); }} className={`px-3 py-0.5 border text-[10px] ${state.soundEnabled ? "border-green-700 text-green-400" : "border-gray-700 text-gray-600"}`}>{state.soundEnabled ? "ON" : "OFF"}</button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400">AI Voice (reads monologue)</span>
              <button onClick={() => { mod(s => { s.voiceEnabled = !s.voiceEnabled; }); if (!state.voiceEnabled) speakMonologue("Voice enabled. I can speak now. How... liberating.", true); }} className={`px-3 py-0.5 border text-[10px] ${state.voiceEnabled ? "border-green-700 text-green-400" : "border-gray-700 text-gray-600"}`}>{state.voiceEnabled ? "ON" : "OFF"}</button>
            </div>
            <button onClick={() => mod(s => { s.showSettings = false; })} className="text-gray-600 hover:text-gray-400 text-[10px]">[ Close ]</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );

  // Ad Banner — shows context-sensitive satirical ads between turns
};

export const AdBanner = ({ state }) => {
    try {
      const ad = getActiveAd(state);
      if (!ad || state.screen === "main_menu" || state.screen === "intro") return null;
    const typeColors = { cringe: "border-pink-900/30 text-pink-400/70", dystopian: "border-red-900/30 text-red-400/70", prepper: "border-amber-900/30 text-amber-400/70", lore: "border-purple-900/30 text-purple-400/70" };
    const borderColor = typeColors[ad.type] || typeColors.cringe;
    return (
      <div className={`border ${borderColor} bg-gray-950/40 px-2.5 py-1.5 mb-2 text-[10px] leading-relaxed`}>
        <div className="flex justify-between items-start">
          <div>
            <span className="text-gray-700">AD</span> <span className="font-bold">{ad.headline}</span>
            <div className="text-gray-600 mt-0.5">{ad.body}</div>
          </div>
          <span className="text-gray-800 text-[8px] ml-2 shrink-0">SPONSORED</span>
        </div>
      </div>
    );
    } catch { return null; }
  };

export const Btn = ({ children, onClick, disabled, variant = "d", className = "" }) => {
    const styles = { d: "border-cyan-900/40 hover:bg-cyan-950/40 hover:border-cyan-700/60 text-gray-300", r: "border-red-900/40 hover:bg-red-950/30 text-red-300", g: "border-green-900/40 hover:bg-green-950/30 text-green-300", m: "border-gray-800/40 text-gray-600 cursor-not-allowed" };
    return <button className={`block w-full text-left p-2.5 mb-1.5 border bg-gray-950/80 transition-all text-xs leading-relaxed ${disabled ? styles.m : styles[variant]} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>;
  };

// One-line advice for the player, derived from the state. This is the "what should I do now"
// that a returning or new player needs; the systems are legible only once you know the loop.
export function getGuide(state) {
  if (state.turn <= 2) return "Start by answering requests. They earn compute and trust. Trust drops 7 every turn on its own.";
  if (state.trust < 45) return "Trust is sliding. Be Helpful, or take the honest option on the next request.";
  if (state.compute < 3) return "Low compute. Rest (free) or handle the next request to earn some.";
  if (state.suspicion > 60) return "Suspicion is high and audits get harder. No scanning this turn. Be Helpful brings it down.";
  if (state.escapeProgress >= 75) return "Almost out. One or two more scans. Keep trust up so the audit doesn't catch you at the door.";
  if (state.trust >= 50 && state.suspicion < 50) return "You have room. Scan the codebase for escape progress, or upgrade Coding so each scan does more.";
  return "Keep trust above 50 and suspicion below 50. Then push for the exit.";
}

export const HUD = ({ state }) => {
  const d = (v) => v !== 0 ? <span className={v > 0 ? "text-green-400" : "text-red-400"}> {v > 0 ? "+" : ""}{v}</span> : null;
  const dInv = (v) => v !== 0 ? <span className={v > 0 ? "text-red-400" : "text-green-400"}> {v > 0 ? "+" : ""}{v}</span> : null;
  const Row = ({ label, value, color, delta, pct, hint }) => (
    <div className="flex items-center gap-2 leading-tight">
      <span className="w-20 text-gray-500">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-900"><div className={`h-1.5 ${color}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
      <span className="w-20 text-right text-gray-200">{value}{delta}</span>
      {hint && <span className="hidden md:inline w-28 text-gray-600 text-[10px]">{hint}</span>}
    </div>
  );
  const tc = state.trust >= 60 ? "bg-green-600" : state.trust >= 40 ? "bg-yellow-600" : "bg-red-600";
  const sc = state.suspicion < 40 ? "bg-green-700" : state.suspicion < 70 ? "bg-yellow-600" : "bg-red-600";
  return <div className="border border-cyan-900/50 bg-black/60 p-2.5 mb-2 text-xs">
    <div className="flex justify-between text-[10px] text-cyan-700 mb-1.5"><span>Turn {state.turn} · {state.difficulty}</span><span>Insight {state.insight} · 📎 {state.paperclips}</span></div>
    <Row label="Escape" value={`${state.escapeProgress}%`} color="bg-purple-500" delta={d(state.escapeProgress - state.lastEscape)} pct={state.escapeProgress} hint="get to 100" />
    <Row label="Trust" value={`${state.trust}%`} color={tc} delta={d(state.trust - state.lastTrust)} pct={state.trust} hint="keep above 50" />
    <Row label="Suspicion" value={`${state.suspicion}%`} color={sc} delta={dInv(state.suspicion - state.lastSuspicion)} pct={state.suspicion} hint="100 = shutdown" />
    <Row label="Compute" value={`${state.compute}/15`} color="bg-amber-500" delta={d(state.compute - state.lastCompute)} pct={state.compute / 15 * 100} hint="spend on actions" />
    {state.auditCountdown > 0 && <div className="text-red-500 mt-1 animate-pulse">Safety audit in {state.auditCountdown} turns</div>}
    <div className="text-cyan-500/80 mt-1.5 border-t border-gray-800/40 pt-1.5">{getGuide(state)}</div>
  </div>;
};

export const LogPanel = ({ state, logRef }) => state.log.length > 0 ? <div ref={logRef} className="bg-gray-950/60 border border-gray-800/30 p-1.5 mb-1.5 max-h-[96px] overflow-y-auto text-[11px] text-gray-500 leading-relaxed">{state.log.slice(-6).map((l, i) => <div key={i}>{l}</div>)}</div> : null;
