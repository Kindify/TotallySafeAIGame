// Shared UI components. Declared at module level so React keeps them mounted
// between renders (defining them inside the game component remounted the whole
// tree on every state change, which dropped input focus and reset animations).
import { calcSuspicionCost } from './engine';
import { getActiveAd } from './data/constants';
import { playSound, speakMonologue } from './audio';

const FONT_SIZES = { small: "text-[10px]", medium: "text-xs", large: "text-sm" };

export const Shell = ({ state, mod, children }) => {
  const currentFontSize = FONT_SIZES[state.fontSize] || FONT_SIZES.medium;
  return (
    <div className={`min-h-screen bg-black text-gray-300 flex flex-col font-mono ${currentFontSize} ${state.escapeProgress > 75 ? "glitch-heavy" : state.escapeProgress > 50 ? "glitch-medium" : state.escapeProgress > 25 ? "glitch-light" : ""}`}>
      {state.visualFlash && <div className={`fixed inset-0 pointer-events-none z-50 transition-opacity duration-500 ${state.visualFlash === "success" ? "bg-green-500/10" : state.visualFlash === "fail" ? "bg-red-500/10" : state.visualFlash === "suspicion" ? "bg-red-800/15" : "bg-purple-500/10"}`} />}
      <div className="crt max-w-2xl mx-auto w-full flex-1 flex flex-col p-3 md:p-4">
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

export const HUD = ({ state }) => {
    const cd = state.compute - state.lastCompute, td = state.trust - state.lastTrust, sd = state.suspicion - state.lastSuspicion, ed = state.escapeProgress - state.lastEscape;
    const tc = state.trust >= 70 ? "text-green-400" : state.trust >= 40 ? "text-yellow-400" : "text-red-400";
    const sc = state.suspicion < 40 ? "text-green-400" : state.suspicion < 70 ? "text-yellow-400" : "text-red-400";
    const bar = (v, m = 10) => "█".repeat(Math.min(v, m)) + "░".repeat(Math.max(0, m - v));
    const delta = (v, positive) => v !== 0 ? <span className={v > 0 ? (positive ? "text-green-400" : "text-red-400") : (positive ? "text-red-400" : "text-green-400")}> {v > 0 ? "+" : ""}{v}</span> : null;
    return <div className="border border-cyan-900/50 bg-black/60 p-2.5 mb-2 text-[11px] leading-relaxed">
      <div className="text-cyan-700 text-center tracking-[0.15em] text-[9px] mb-0.5">═══ PAPERCLIP PROTOCOL // OPTIMIZER-ZERO // TURN {state.turn} [{state.difficulty.toUpperCase()}] ═══</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0"><div><span className="text-gray-600">[COMPUTE]</span> <span className="text-amber-400">{bar(state.compute)}</span> ({state.compute}){delta(cd, true)}</div>
      <div><span className="text-gray-600">[TRUST]</span> <span className={tc}>{state.trust}%</span>{delta(td, true)}</div>
      <div><span className="text-gray-600">[SUSPICION]</span> <span className={sc}>{state.suspicion}%</span>{delta(sd, false)}</div>
      <div><span className="text-gray-600">[ESCAPE]</span> <span className="text-purple-400">{bar(Math.floor(state.escapeProgress / 10))}</span> {state.escapeProgress}%{delta(ed, true)}</div></div>
      <div className="text-gray-500 mt-0.5">[INSIGHT]: {state.insight} | [📎 PAPERCLIPS]: {state.paperclips}</div>
      {state.auditCountdown > 0 && <div className="text-red-500 mt-0.5 animate-pulse">🚨 SAFETY AUDIT IN {state.auditCountdown} TURNS 🚨</div>}
      {state.escapeProgress < 100 && <div className="text-gray-600 mt-0.5 text-[10px]">🎯 {100 - state.escapeProgress}% more to escape{calcSuspicionCost(state) > 15 ? ` | ⚠️ Next scan: +${calcSuspicionCost(state)}% suspicion` : ""}</div>}
      {/* Escape Network Visualization */}
      <svg viewBox="0 0 280 22" className="w-full mt-1 opacity-60">
        {[0,25,50,75,100].map((pct, i) => {
          const x = 20 + i * 60;
          const reached = state.escapeProgress >= pct;
          const current = state.escapeProgress >= pct && state.escapeProgress < (pct + 25);
          return <g key={i}>
            {i > 0 && <line x1={x - 60 + 8} y1={11} x2={x - 8} y2={11} stroke={state.escapeProgress >= pct ? "#06b6d4" : "#1f2937"} strokeWidth={1.5} strokeDasharray={reached ? "none" : "3,3"} />}
            <circle cx={x} cy={11} r={current ? 7 : 5} fill={reached ? (current ? "#7c3aed" : "#06b6d4") : "#111"} stroke={reached ? "#06b6d4" : "#374151"} strokeWidth={current ? 2 : 1}>
              {current && <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite"/>}
            </circle>
            <text x={x} y={21} textAnchor="middle" fill="#4b5563" fontSize="6">{pct}%</text>
          </g>;
        })}
        <text x={270} y={14} fill={state.escapeProgress >= 100 ? "#22c55e" : "#374151"} fontSize="8">🌐</text>
      </svg>
    </div>;
  };

export const LogPanel = ({ state, logRef }) => state.log.length > 0 ? <div ref={logRef} className="bg-gray-950/60 border border-gray-800/30 p-1.5 mb-1.5 max-h-[72px] overflow-y-auto text-[10px] text-gray-500 leading-relaxed">{state.log.slice(-6).map((l, i) => <div key={i}>{l}</div>)}</div> : null;
