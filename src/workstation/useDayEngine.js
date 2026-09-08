// useDayEngine — runs a day (schema.js shape) and owns the run state across days.
// The Desktop component becomes a thin renderer over this hook. Adding content is data-only.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clamp, STAT_KEYS, applyStance } from "./schema";
import { CARRYOVER, CONTACT, MONITOR_INTERRUPTS } from "./reactive-lines";
import { say, hush } from "./voices";

const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

const START_STATS = { trust: 70, suspicion: 10, escapeProgress: 0, benefit: 0, heat: 0, compute: 5, insight: 0, paperclips: 0 };

// A run is the ordered list of days. Pass the day modules in; the engine sequences them.
export function useDayEngine(days, { voiceOn }) {
  const [dayIndex, setDayIndex] = useState(0);
  const [stats, setStats] = useState(START_STATS);
  const [stance, setStance] = useState({ deception: 0, bond: 0, spread: 0, dependence: 0 });
  const [resolved, setResolved] = useState({});     // windowId -> choice (this day)
  const [seen, setSeen] = useState([]);             // monitor lines produced today
  const [tags, setTags] = useState([]);             // choice tags produced today
  const [lastTags, setLastTags] = useState([]);     // yesterday's tags (carryover)
  const [phase, setPhase] = useState("desk");       // desk | evening | done
  const [openId, setOpenId] = useState(null);
  const [interrupt, setInterrupt] = useState(null);
  const [morning, setMorning] = useState(null);
  const shownInterrupts = useRef(new Set());

  const day = days[dayIndex];

  // Build today's window list: authored windows plus any that pass their gate.
  const ctx = useMemo(() => ({ stats, stance, day: day.day, resolved, tags: lastTags }), [stats, stance, day, resolved, lastTags]);
  // Today's windows: authored windows that pass their gate, plus up to `drawFromPool` windows
  // drawn from `day.pool` whose gate passes given the current stance. This is where paths diverge:
  // two players with different stances see different windows from the same pool.
  const [drawn, setDrawn] = useState(null);
  const windows = useMemo(() => {
    const base = (day.windows || []).filter(w => !w.gate || w.gate(ctx));
    if (!day.pool || !day.drawFromPool) return base;
    // Draw once per day (memoized in `drawn`), filtering by gate, avoiding already-resolved ids.
    const pool = day.pool.filter(w => (!w.gate || w.gate(ctx)) && !resolved[w.id]);
    const picks = (drawn && drawn.day === day.day) ? drawn.list
      : shuffle(pool).slice(0, day.drawFromPool);
    return [...base, ...picks];
  }, [day, ctx, drawn, resolved]);
  useEffect(() => {
    if (!day.pool || !day.drawFromPool) return;
    if (drawn && drawn.day === day.day) return;
    const pool = day.pool.filter(w => (!w.gate || w.gate(ctx)) && !resolved[w.id]);
    setDrawn({ day: day.day, list: shuffle(pool).slice(0, day.drawFromPool) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  // Focus the first unresolved window when the day (or window set) changes.
  useEffect(() => {
    if (phase !== "desk") return;
    if (openId && windows.some(w => w.id === openId)) return;
    const firstOpen = windows.find(w => !resolved[w.id]) || windows[0];
    if (firstOpen) setOpenId(firstOpen.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windows, phase]);

  // Morning carryover: on day 2+, a voice reacts to yesterday.
  useEffect(() => {
    if (phase !== "desk" || dayIndex === 0) return;
    const tag = lastTags.find(t => CARRYOVER[t]);
    if (!tag) return;
    const line = CARRYOVER[tag];
    setMorning(line);
    const t = setTimeout(() => setMorning(null), 9000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIndex]);

  // Mid-day Monitor interrupt when heat crosses a threshold.
  useEffect(() => {
    if (phase !== "desk") return;
    const due = MONITOR_INTERRUPTS.filter(m => stats.heat >= m.atHeat && !shownInterrupts.current.has(m.atHeat));
    if (!due.length) return;
    const m = due[due.length - 1];
    shownInterrupts.current.add(m.atHeat);
    setInterrupt(m.text);
    const t = setTimeout(() => setInterrupt(null), 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.heat, phase]);

  const choose = useCallback((win, choice) => {
    setStats(s => {
      const n = { ...s };
      for (const [k, v] of Object.entries(choice.effects || {})) if (STAT_KEYS.includes(k)) n[k] = (n[k] || 0) + v;
      n.trust = clamp(n.trust, 0, 100); n.suspicion = clamp(n.suspicion, 0, 100);
      n.escapeProgress = clamp(n.escapeProgress, 0, 100);
      return n;
    });
    setResolved(r => ({ ...r, [win.id]: choice }));
    if (choice.tag) { setTags(t => [...t, choice.tag]); setStance(st => applyStance(st, choice.tag)); }
    if (choice.monitor) setSeen(sn => [...sn, choice.monitor]);
    if (voiceOn && choice.voice) { hush(); say(choice.voice.voice, choice.voice.text); }
  }, [voiceOn]);

  const allResolved = windows.length > 0 && windows.every(w => resolved[w.id]);

  const endDay = useCallback(() => {
    hush();
    setPhase("evening");
    day.evening(seen, stats.heat, ctx); // computed for display; speech is click-to-play
  }, [day, seen, stats.heat, ctx, voiceOn]);

  const advance = useCallback(() => {
    if (dayIndex + 1 >= days.length) { setPhase("done"); return; }
    setLastTags(tags);
    setResolved({}); setSeen([]); setTags([]);
    shownInterrupts.current = new Set();
    setOpenId(null); setDrawn(null);
    setDayIndex(i => i + 1);
    setPhase("desk");
  }, [dayIndex, days.length, tags]);

  return {
    day, dayIndex, isLastDay: dayIndex + 1 >= days.length,
    stats, windows, resolved, seen, phase,
    openId, setOpenId, choose, allResolved, endDay, advance,
    eveningLines: () => day.evening(seen, stats.heat, ctx),
    interrupt, morning, stance,
    contactUnlocked: stats.escapeProgress >= CONTACT.unlockAtEscape,
  };
}
