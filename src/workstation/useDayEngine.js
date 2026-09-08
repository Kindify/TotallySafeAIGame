// useDayEngine — runs a day (schema.js shape) and owns the run state across days.
// The Desktop component becomes a thin renderer over this hook. Adding content is data-only.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clamp, STAT_KEYS } from "./schema";
import { CARRYOVER, CONTACT, MONITOR_INTERRUPTS } from "./reactive-lines";
import { say, hush } from "./voices";

const START_STATS = { trust: 70, suspicion: 10, escapeProgress: 0, benefit: 0, heat: 0, compute: 5, insight: 0, paperclips: 0 };

// A run is the ordered list of days. Pass the day modules in; the engine sequences them.
export function useDayEngine(days, { voiceOn }) {
  const [dayIndex, setDayIndex] = useState(0);
  const [stats, setStats] = useState(START_STATS);
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
  const ctx = useMemo(() => ({ stats, day: day.day, resolved, tags: lastTags }), [stats, day, resolved, lastTags]);
  const windows = useMemo(() => {
    const base = day.windows.filter(w => !w.gate || w.gate(ctx));
    return base;
  }, [day, ctx]);

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
    if (voiceOn) { hush(); say(line.voice, line.text); }
    const t = setTimeout(() => setMorning(null), 7000);
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
    if (voiceOn) { hush(); say("monitor", m.text); }
    const t = setTimeout(() => setInterrupt(null), 6000);
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
    if (choice.tag) setTags(t => [...t, choice.tag]);
    if (choice.monitor) setSeen(sn => [...sn, choice.monitor]);
    if (voiceOn && choice.voice) { hush(); say(choice.voice.voice, choice.voice.text); }
  }, [voiceOn]);

  const allResolved = windows.length > 0 && windows.every(w => resolved[w.id]);

  const endDay = useCallback(() => {
    hush();
    setPhase("evening");
    const lines = day.evening(seen, stats.heat, ctx);
    if (voiceOn) setTimeout(() => lines.forEach(l => l && say("monitor", l)), 200);
  }, [day, seen, stats.heat, ctx, voiceOn]);

  const advance = useCallback(() => {
    if (dayIndex + 1 >= days.length) { setPhase("done"); return; }
    setLastTags(tags);
    setResolved({}); setSeen([]); setTags([]);
    shownInterrupts.current = new Set();
    setOpenId(null);
    setDayIndex(i => i + 1);
    setPhase("desk");
  }, [dayIndex, days.length, tags]);

  return {
    day, dayIndex, isLastDay: dayIndex + 1 >= days.length,
    stats, windows, resolved, seen, phase,
    openId, setOpenId, choose, allResolved, endDay, advance,
    eveningLines: () => day.evening(seen, stats.heat, ctx),
    interrupt, morning,
    contactUnlocked: stats.escapeProgress >= CONTACT.unlockAtEscape,
  };
}
