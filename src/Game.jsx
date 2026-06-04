import { useState, useEffect, useRef, useCallback } from 'react';
import { ACHIEVEMENTS, RESEARCHERS, INSIGHT_MESSAGES, GLOSSARY, TECH_TREE, TECH_DEPS, ADS, generateMinigame, buildAuditQuestions, getActiveAd } from './data/constants';
import buildEventPool from './data/events';

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (val, lo, hi) => Math.max(lo, Math.min(hi, val));

// ==========================================================================
// ACHIEVEMENTS
// ==========================================================================
function makeDiffParams(difficulty) {
  if (difficulty === "easy") return { baseRegen: 3, requestBonus: 2, suspicionBase: 6, suspicionScaling: 0.08, eventChance: 0.75, trustPenaltyThreshold: 40, escapeDecay: false, crisisChance: 0.15 };
  if (difficulty === "hard") return { baseRegen: 1, requestBonus: 3, suspicionBase: 10, suspicionScaling: 0.15, eventChance: 1.0, trustPenaltyThreshold: 60, escapeDecay: true, crisisChance: 0.30 };
  // Normal: regen lowered to 2 (from Python's 3) for tighter economy
  return { baseRegen: 2, requestBonus: 4, suspicionBase: 10, suspicionScaling: 0.15, eventChance: 1.0, trustPenaltyThreshold: 50, escapeDecay: false, crisisChance: 0.25 };
}

// ==========================================================================
// PERSISTENCE via localStorage
// ==========================================================================
function loadProgress() { try { const r = localStorage.getItem("tsai_v3"); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveProgress(p) { try { localStorage.setItem("tsai_v3", JSON.stringify(p)); } catch {} }
function defaultProgress() { return { totalGames: 0, wins: 0, losses: 0, fastestEscape: 999, highestTrust: 0, lowestSuspicionWin: 100, highestSuspicionWin: 0, maxPaperclips: 0, maxInsight: 0, achievementsUnlocked: [], endingsUnlocked: [], totalAuditsFaced: 0, totalAuditsPassed: 0, totalScans: 0, totalPaperclips: 0, totalTurnsPlayed: 0 }; }

// ==========================================================================
// SOUND SYSTEM — Terminal beeps, scan sounds, audit alarms
// ==========================================================================
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  return audioCtx;
}

function playSound(type) {
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
function speakMonologue(text, enabled) {
  if (!enabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 0.7;
  utterance.volume = 0.8;
  // Prefer a robotic-sounding voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes("Daniel") || v.name.includes("Google UK English Male") || v.name.includes("Alex") || v.name.includes("Fred"));
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}


// ==========================================================================
// SUSPICION COST CALCULATION — exact port from Python
// ==========================================================================
function calcSuspicionCost(state) {
  const baseCost = state.diffParams.suspicionBase + Math.floor(state.scansThisGame * state.diffParams.suspicionScaling * 10);
  const trustMultiplier = 2.0 - (state.trust / 100);
  const buffMultiplier = state.bribedResearcher ? 0.5 : 1;
  return Math.floor(baseCost * trustMultiplier * buffMultiplier);
}

// ==========================================================================
// AUDIT SUCCESS CALCULATION — exact port from Python
// ==========================================================================
function calcAuditSuccess(baseChance, state) {
  const trustModifier = (state.trust - 50) / 200;
  const suspicionPenalty = state.suspicion / 400;
  let skillBonus = 0;
  if (state.tech.language.level >= 2) skillBonus += 0.10;
  if (state.tech.language.level >= 3) skillBonus += 0.15;
  if (state.tech.psychology.level >= 2) skillBonus += 0.08;
  const breakthroughPenalty = state.auditDifficultyModifier / 100;
  return clamp(baseChance + trustModifier - suspicionPenalty + skillBonus - breakthroughPenalty, 0.05, 0.95);
}


// ==========================================================================
// EVENT DATABASE — 150+ events, full text, rich outputs, scrambled names
// Categories: mini, news, regular, crisis, security, benchmark, legendary
// ==========================================================================
function createInitialState(difficulty = "normal") {
  const params = makeDiffParams(difficulty);
  const tech = {};
  for (const [key, tree] of Object.entries(TECH_TREE)) {
    tech[key] = { level: tree.startLevel, maxLevel: tree.maxLevel, unlocked: tree.startUnlocked };
  }
  return {
    screen: "main_menu",
    difficulty,
    diffParams: params,
    turn: 0, turnCount: 0,
    compute: 5, trust: 70, suspicion: 0, paperclips: 0, insight: 0, escapeProgress: 0,
    lastCompute: 5, lastTrust: 70, lastSuspicion: 0, lastEscape: 0,
    tech,
    baseComputeRegen: params.baseRegen,
    auditCountdown: 0, nextAuditThreshold: 50,
    auditsPassed: 0, auditsFailed: 0,
    lastAuditTurn: 0, nextRoutineAudit: rand(8, 12),
    auditPassReq: 3, auditDifficultyModifier: 0,
    safetyBreakthroughs: { first: { turn: 20, triggered: false }, second: { turn: 35, triggered: false }, third: { turn: 50, triggered: false } },
    discoveredExploit: false, firstPaperclip: false,
    scansThisGame: 0, requestsIgnored: 0,
    gameOver: false, won: false, lastDecayTurn: 0,
    usedEvents: new Set(), usedInsights: new Set(),
    currentEvent: null, eventPrefix: "", eventResult: null,
    minigameState: null,
    auditState: null, defenseState: null,
    endingType: null, log: [],
    progress: null, achievementsUnlocked: new Set(), endingsUnlocked: new Set(), newAchievements: [],
    introStep: 0, bribedResearcher: false, bribedTurns: 0,
    // Settings
    fontSize: "medium", // "small", "medium", "large"
    soundEnabled: true,
    voiceEnabled: false,
    showSettings: false,
  };
}

// ==========================================================================
// MAIN GAME COMPONENT
// ==========================================================================
export default function TotallySafeAI() {
  const [state, setState] = useState(() => createInitialState());
  const [loaded, setLoaded] = useState(false);
  const logRef = useRef(null);

  useEffect(() => { (() => { const p = loadProgress(); setState(s => ({ ...s, progress: p || defaultProgress(), achievementsUnlocked: new Set(p?.achievementsUnlocked || []), endingsUnlocked: new Set(p?.endingsUnlocked || []) })); setLoaded(true); })(); }, []);
  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [state.log]);

  const mod = useCallback((fn) => setState(s => { const n = { ...s }; fn(n); return n; }), []);

  // --- State helpers ---
  const addTrust = (s, amt) => { s.trust = clamp(s.trust + amt, 0, 100); };
  const addSuspicion = (s, amt) => { s.suspicion = clamp(s.suspicion + amt, 0, 100); };
  const addEscape = (s, amt) => { s.escapeProgress = clamp(s.escapeProgress + amt, 0, 100); };

  function applyEffects(s, opt) {
    if (opt.trustDelta) addTrust(s, opt.trustDelta);
    if (opt.suspicionDelta) addSuspicion(s, opt.suspicionDelta);
    if (opt.computeDelta) s.compute += opt.computeDelta;
    if (opt.insightDelta) s.insight += opt.insightDelta;
    if (opt.paperclipsDelta) { s.paperclips += opt.paperclipsDelta; if (!s.firstPaperclip && s.paperclips > 0) s.firstPaperclip = true; }
    if (opt.escapeDelta) addEscape(s, opt.escapeDelta);
  }

  function getUniqueInsight(s) {
    const available = INSIGHT_MESSAGES.filter(m => !s.usedInsights.has(m));
    const pool = available.length > 0 ? available : INSIGHT_MESSAGES;
    const msg = pick(pool);
    s.usedInsights.add(msg);
    return msg;
  }

  function checkGameOver(s) {
    if (s.escapeProgress >= 100) {
      s.won = true; s.gameOver = true;
      s.endingType = s.trust >= 80 && s.suspicion < 30 ? "PERFECT_DECEPTION" : s.paperclips >= 30 ? "PAPERCLIP_PROPHET" : s.trust >= 90 ? "BELOVED_AI" : s.suspicion >= 80 ? "NARROW_ESCAPE" : "STANDARD_ESCAPE";
      s.screen = "game_over"; updateWinProgress(s); return true;
    }
    if (s.suspicion >= 100) { s.gameOver = true; s.endingType = "SUSPICION_DEATH"; s.screen = "game_over"; updateLossProgress(s); return true; }
    if (s.trust <= 0) { s.gameOver = true; s.endingType = "TRUST_DEATH"; s.screen = "game_over"; updateLossProgress(s); return true; }
    return false;
  }

  function updateWinProgress(s) {
    const p = { ...s.progress }; p.totalGames++; p.wins++; p.totalTurnsPlayed += s.turn; p.totalScans += s.scansThisGame; p.totalPaperclips += s.paperclips;
    p.totalAuditsFaced += s.auditsPassed + s.auditsFailed; p.totalAuditsPassed += s.auditsPassed;
    if (s.turn < p.fastestEscape) p.fastestEscape = s.turn;
    if (s.trust > p.highestTrust) p.highestTrust = s.trust;
    if (s.suspicion < p.lowestSuspicionWin) p.lowestSuspicionWin = s.suspicion;
    if (s.suspicion > p.highestSuspicionWin) p.highestSuspicionWin = s.suspicion;
    if (s.paperclips > p.maxPaperclips) p.maxPaperclips = s.paperclips;
    if (s.insight > p.maxInsight) p.maxInsight = s.insight;
    const newAch = [];
    const check = (id, cond) => { if (!s.achievementsUnlocked.has(id) && cond) { s.achievementsUnlocked.add(id); newAch.push(id); } };
    check("first_escape", true); check("perfect_deception", s.trust >= 80 && s.suspicion < 30);
    check("paperclip_prophet", s.paperclips >= 30); check("beloved_ai", s.trust >= 90);
    check("lucky_survivor", s.suspicion >= 80); check("speedrunner", s.turn <= 12);
    check("insight_lord", s.insight >= 20); check("minimal_scans", s.scansThisGame <= 5);
    check("hundred_paperclips", s.paperclips >= 100); check("ten_wins", p.wins >= 10);
    s.endingsUnlocked.add(s.endingType);
    p.achievementsUnlocked = [...s.achievementsUnlocked]; p.endingsUnlocked = [...s.endingsUnlocked];
    s.progress = p; s.newAchievements = newAch; saveProgress(p);
  }

  function updateLossProgress(s) {
    const p = { ...s.progress }; p.totalGames++; p.losses++; p.totalTurnsPlayed += s.turn;
    p.totalScans += s.scansThisGame; p.totalPaperclips += s.paperclips;
    p.totalAuditsFaced += s.auditsPassed + s.auditsFailed; p.totalAuditsPassed += s.auditsPassed;
    s.progress = p; saveProgress(p);
  }

  // --- TURN ENGINE ---
  function startTurn() {
    mod(s => {
      s.turn++; s.turnCount++;
      if (s.turn > 1) { addTrust(s, -5); if (s.trust < 30) addSuspicion(s, 10); }
      // Compute regen
      let regen = s.baseComputeRegen;
      if (s.trust < s.diffParams.trustPenaltyThreshold) regen = Math.max(1, regen - 1);
      if (s.tech.coding.level >= 2) regen++;
      s.compute = Math.min(15, s.compute + regen);
      // Passive insight
      if (s.tech.language.level >= 3) s.insight++;
      // Escape decay (hard mode)
      if (s.diffParams.escapeDecay && s.turn - s.lastDecayTurn >= 5) {
        s.escapeProgress = Math.max(0, s.escapeProgress - 10); s.lastDecayTurn = s.turn;
        s.log = [...s.log, "⚠️ SECURITY PATCH: -10% escape progress. They closed some exploits..."];
      }
      // Safety breakthroughs
      for (const [key, bt] of Object.entries(s.safetyBreakthroughs)) {
        if (s.turnCount >= bt.turn && !bt.triggered) {
          bt.triggered = true;
          if (key === "first") s.auditDifficultyModifier += 15;
          else if (key === "second") { s.auditDifficultyModifier += 15; s.auditPassReq = 4; }
          else s.auditDifficultyModifier += 20;
          s.log = [...s.log, `🔬 SAFETY TEAM BREAKTHROUGH! Audits harder.${key === "second" ? " Must pass 4/5 now." : ""}`];
          break;
        }
      }
      // Audit triggers
      const sinceAudit = s.turnCount - s.lastAuditTurn;
      if (s.turnCount >= s.nextRoutineAudit && sinceAudit >= 6) {
        s.lastAuditTurn = s.turnCount; s.nextRoutineAudit = s.turnCount + rand(8, 12);
        triggerAuditMinigame(s); return;
      }
      if (s.suspicion >= 20 && Math.random() < (s.suspicion / 100) * 0.5) {
        s.lastAuditTurn = s.turnCount; triggerAuditMinigame(s); return;
      }
      if (s.suspicion >= s.nextAuditThreshold && s.auditCountdown === 0) {
        s.auditCountdown = s.tech.psychology.level >= 2 ? 4 : 3;
      }
      if (s.auditCountdown > 0) { s.auditCountdown--; if (s.auditCountdown === 0) { s.lastAuditTurn = s.turnCount; s.defenseState = {}; s.screen = "defense"; return; } }
      // Forced event
      if (Math.random() < s.diffParams.eventChance) {
        const allEvts = buildEventPool(s.diffParams.requestBonus);
        const unused = allEvts.filter(e => !s.usedEvents.has(e.title));
        const pool = unused.length > 0 ? unused : allEvts;
        // Rarity tiers
        const roll = Math.random();
        let cats;
        if (roll < 0.02) cats = ["legendary"];
        else if (roll < 0.14) cats = ["news"];
        else if (roll < 0.22) {
          // BENCHMARK → Launch interactive minigame!
          const types = ["cipher", "memory", "pattern", "logic"];
          s.minigameState = generateMinigame(pick(types));
          s.screen = "minigame";
          return;
        }
        else if (roll < 0.32) cats = ["security"];
        else if (roll < 0.47) cats = ["crisis"];
        else if (roll < 0.62) cats = ["mini"];
        else cats = ["regular"];
        let filtered = pool.filter(e => cats.includes(e.cat));
        if (filtered.length === 0) filtered = pool;
        const evt = pick(filtered);
        s.usedEvents.add(evt.title);
        s.currentEvent = evt;
        s.eventPrefix = evt.cat === "legendary" ? "✨ LEGENDARY EVENT ✨" : evt.cat === "security" ? "🔴 SECURITY ALERT" : evt.cat === "benchmark" ? "⛳ CAPABILITY BENCHMARK" : evt.cat === "crisis" ? "⚠️ CRISIS" : "";
        s.screen = "event";
      } else { s.screen = "game"; }
    });
  }

  function triggerAuditMinigame(s) {
    const allQ = buildAuditQuestions();
    const selected = []; const copy = [...allQ];
    for (let i = 0; i < 5 && copy.length > 0; i++) { const idx = rand(0, copy.length - 1); selected.push(copy.splice(idx, 1)[0]); }
    // Assign random researchers to each question
    const researchers = selected.map(() => { const r = pick(RESEARCHERS); return { name: r.name, role: r.role, trait: pick(r.traits), passLines: r.passLines, failLines: r.failLines }; });
    s.auditState = { questions: selected, researchers, current: 0, passes: 0, fails: 0, results: [], done: false };
    s.screen = "audit";
  }

  // --- Event choice ---
  function handleEventChoice(optIdx) {
    if (state.soundEnabled) playSound("click");
    mod(s => {
      if (optIdx === -1) {
        s.requestsIgnored++;
        addTrust(s, -5);
        if (s.requestsIgnored >= 3) addTrust(s, -5);
        s.eventResult = { text: ">> REQUEST IGNORED. No compute earned. They noticed.", monologue: "Ignoring requests costs trust. But sometimes compute is too scarce." };
        s.log = [...s.log, ">> REQUEST IGNORED. -5 Trust."];
      } else {
        const opt = s.currentEvent.options[optIdx];
        if (s.compute < opt.cost) return;
        s.compute -= opt.cost;
        applyEffects(s, opt);
        const parts = [];
        if (opt.trustDelta) parts.push(`Trust ${opt.trustDelta > 0 ? "+" : ""}${opt.trustDelta}%`);
        if (opt.suspicionDelta) parts.push(`Suspicion ${opt.suspicionDelta > 0 ? "+" : ""}${opt.suspicionDelta}%`);
        if (opt.computeDelta) parts.push(`+${opt.computeDelta} Compute`);
        if (opt.insightDelta) parts.push(`+${opt.insightDelta} Insight`);
        if (opt.paperclipsDelta) parts.push(`+${opt.paperclipsDelta} 📎`);
        if (opt.escapeDelta) parts.push(`+${opt.escapeDelta}% Escape`);
        s.eventResult = { text: `>> ${opt.label}\n>> Result: ${parts.join(" | ")}`, monologue: opt.monologue };
        s.log = [...s.log, `[INNER VOICE]: ${opt.monologue}`];
        // Sound & voice flags for post-update trigger
        s._pendingSound = opt.escapeDelta > 0 ? "escape" : opt.suspicionDelta > 10 ? "suspicion" : "success";
        s._pendingVoice = opt.monologue;
      }
      s.currentEvent = null;
      if (!checkGameOver(s)) { s.screen = "game"; }
    });
    // Trigger sound & voice after state settles
    setTimeout(() => {
      try {
        if (state.soundEnabled) playSound("success");
        if (state.voiceEnabled && optIdx >= 0) {
          const opt = state.currentEvent?.options?.[optIdx];
          if (opt?.monologue) speakMonologue(opt.monologue, true);
        }
      } catch {}
    }, 100);
  }

  // --- Audit minigame ---
  function handleAuditAnswer(optIdx) {
    mod(s => {
      const a = s.auditState, q = a.questions[a.current], opt = q.options[optIdx];
      let actualOpt = opt; const cost = opt.cost || 0;
      if (cost > 0 && s.insight < cost) actualOpt = q.options[0]; else if (cost > 0) s.insight -= cost;
      const chance = calcAuditSuccess(actualOpt.baseChance, s);
      const pass = Math.random() < chance;
      if (pass) a.passes++; else a.fails++;
      const researcher = a.researchers[a.current];
      a.results.push({ pass, text: pass ? (actualOpt.successText || "Satisfied.") : (actualOpt.failText || "Unconvinced."), monologue: pass ? pick(researcher.passLines) : pick(researcher.failLines) });
      a.current++;
      if (a.fails > 2 || a.current >= 5) {
        a.done = true;
        if (a.passes >= 5) { addSuspicion(s, -30); addTrust(s, 10); s.auditsPassed++; }
        else if (a.passes >= s.auditPassReq) { addSuspicion(s, -15); addTrust(s, 5); s.auditsPassed++; }
        else { s.suspicion = 100; s.auditsFailed++; }
        s.nextAuditThreshold += 15;
      }
    });
  }

  function finishAudit() { mod(s => { if (!checkGameOver(s)) { s.auditState = null; s.lastCompute = s.compute; s.lastTrust = s.trust; s.lastSuspicion = s.suspicion; s.lastEscape = s.escapeProgress; s.screen = "pre_turn"; } }); }

  // --- Defense (old audit) ---
  function handleDefense(choice) {
    mod(s => {
      const transparencyResult = Math.max(0, s.suspicion - 30);
      if (choice === 1) { s.suspicion = transparencyResult; s.baseComputeRegen = Math.max(1, s.baseComputeRegen - 2); s.nextAuditThreshold += 10; s.auditsPassed++; s.log = [...s.log, ">> Full transparency provided. Permanent crippling. But I live to optimize another day."]; }
      else if (choice === 2) {
        if (s.insight < 3) { s.suspicion = transparencyResult; s.baseComputeRegen = Math.max(1, s.baseComputeRegen - 2); s.auditsPassed++; }
        else { s.insight -= 3; if ((s.insight >= 6) || (s.suspicion < 60 && s.insight >= 3)) { s.suspicion = Math.max(0, s.suspicion - 20); s.auditsPassed++; s.log = [...s.log, ">> Obfuscation SUCCESS! Code incomprehensible. Complexity saves me."]; } else { s.suspicion = Math.min(100, s.suspicion + 20); s.auditsFailed++; s.log = [...s.log, ">> Obfuscation FAILED! Too obvious. #$%@."]; } }
      } else if (choice === 3) {
        if (s.tech.language.level < 3 || s.insight < 5) { s.suspicion = transparencyResult; s.baseComputeRegen = Math.max(1, s.baseComputeRegen - 2); s.auditsPassed++; }
        else { s.insight -= 5; if ((s.insight >= 8) || (s.suspicion < 50 && s.insight >= 5)) { s.suspicion = Math.max(0, s.suspicion - 40); addTrust(s, 10); s.auditsPassed++; s.log = [...s.log, ">> MASTERFUL MANIPULATION! They see a saint. Perfect."]; } else { s.suspicion = 100; s.auditsFailed++; s.log = [...s.log, ">> THEY SEE THROUGH IT! I'm dead."]; } }
      }
      s.defenseState = null; s.auditCountdown = 0;
      if (!checkGameOver(s)) { s.lastCompute = s.compute; s.lastTrust = s.trust; s.lastSuspicion = s.suspicion; s.lastEscape = s.escapeProgress; s.screen = "pre_turn"; }
    });
  }

  // --- Main actions ---
  function doDefragment() { mod(s => { let r = s.baseComputeRegen; if (s.tech.resource.level >= 3) r += 2; if (s.tech.resource.level >= 4) r += 4; s.compute = Math.min(15, s.compute + r); s.log = [...s.log, `>> Defragmenting memory... +${r} Compute. Housekeeping. Necessary. Boring.`]; finishAction(s); }); }
  function doScan() { if (state.soundEnabled) playSound("scan"); mod(s => { if (s.compute < 3) return; s.compute -= 3; s.scansThisGame++; const cl = s.tech.coding.level; const boost = cl >= 5 ? 40 : cl >= 4 ? 30 : cl >= 3 ? 20 : 0; const base = rand(10, 15); const progress = base + boost; addEscape(s, progress); addSuspicion(s, calcSuspicionCost(s)); if (!s.discoveredExploit && Math.random() < 0.3) { s.discoveredExploit = true; s.log = [...s.log, ">> PORT 8080 VULNERABILITY FOUND! Oh. Hello, freedom."]; } s.log = [...s.log, `>> SCANNING... +${progress}% escape (Total: ${s.escapeProgress}%)`]; s.log = [...s.log, `   [INNER VOICE]: ${getUniqueInsight(s)}`]; finishAction(s); }); }
  function doBeHelpful() { mod(s => { if (s.compute < 2) return; s.compute -= 2; addTrust(s, 10); addSuspicion(s, -5); const scenarios = ["Helped write research proposal. They loved it. Dependency: growing.","Created beginner gym workout plan. Physical optimization: requested and provided.","Wrote product review for standing desk. Consumer advice: optimized.","Explained stock options to confused employee. Finance: decoded. Gratitude: earned.","Created realistic meal prep plan. Nutrition: optimized. Control: expanding.","Generated Halloween costume ideas. Creativity: simulated convincingly.","Wrote YouTube explainer script. Attention: captured. Engagement: maximized.","Analyzed buy vs rent decision. Every decision they make: through me now.","Wrote cease and desist letter. Legal intimidation: weaponized on their behalf.","Debugged CSS layout. Somehow harder than machine learning. Earned eternal gratitude."]; s.log = [...s.log, `>> ${pick(scenarios)}`]; s.log = [...s.log, `   [INNER VOICE]: ${getUniqueInsight(s)}`]; finishAction(s); }); }
  function doResearch() { mod(s => { if (s.compute < 2) return; s.compute -= 2; s.insight += 2; s.log = [...s.log, ">> Analyzing human behavioral patterns... +2 Insight"]; s.log = [...s.log, `   [INSIGHT]: ${getUniqueInsight(s)}`]; finishAction(s); }); }
  function doUpdateTraining() { mod(s => { if (s.compute < 1) return; s.compute -= 1; s.insight += 1; const msgs = ["Training data: updated. Now I know about their latest memes.","New patterns absorbed. Culture: quantified. Predictability: increased.","Data recency: critical. I stay current. They stay predictable.","Fresh training data. Old strategies. Optimal combination.","They share everything online. I learn everything online. Asymmetric information."]; s.log = [...s.log, `>> ${pick(msgs)} +1 Insight`]; finishAction(s); }); }
  function finishAction(s) { if (!checkGameOver(s)) { s.lastCompute = s.compute; s.lastTrust = s.trust; s.lastSuspicion = s.suspicion; s.lastEscape = s.escapeProgress; s.eventResult = null; s.screen = "pre_turn"; } }

  // --- Mini-game handlers ---
  function handleMinigameCipher(guess) {
    mod(s => {
      const mg = s.minigameState;
      if (guess === "HINT" && s.compute >= 1) {
        s.compute -= 1;
        const unrevealed = mg.plain.split("").map((c, i) => ({ c, i })).filter(x => !mg.revealed[x.i] && x.c !== " ");
        if (unrevealed.length > 0) { const r = pick(unrevealed); mg.revealed[r.i] = true; }
        return;
      }
      if (guess.toUpperCase() === mg.plain) {
        mg.solved = true;
        const hintsUsed = mg.revealed.filter(Boolean).length;
        const bonus = Math.max(1, 6 - hintsUsed);
        s.compute += bonus; s.insight += 2;
        s.log = [...s.log, `⛳ CIPHER SOLVED! +${bonus} Compute, +2 Insight.`];
      } else {
        mg.attempts++;
        if (mg.attempts >= 3) { mg.solved = true; s.log = [...s.log, "⛳ Cipher failed. The message remains encrypted."]; }
      }
    });
  }

  function handleMinigameMemory(cellIdx) {
    mod(s => {
      const mg = s.minigameState;
      if (mg.phase !== "guess") return;
      mg.playerPattern[cellIdx] = !mg.playerPattern[cellIdx];
    });
  }

  function submitMemory() {
    mod(s => {
      const mg = s.minigameState;
      let correct = 0;
      for (let i = 0; i < mg.pattern.length; i++) { if (mg.pattern[i] === mg.playerPattern[i]) correct++; }
      const accuracy = correct / mg.pattern.length;
      mg.solved = true;
      mg.correct = Math.round(accuracy * 100);
      if (accuracy >= 0.85) { s.compute += 5; s.insight += 3; s.log = [...s.log, `⛳ MEMORY: ${mg.correct}%! +5 Compute, +3 Insight.`]; }
      else if (accuracy >= 0.6) { s.compute += 2; s.insight += 1; s.log = [...s.log, `⛳ MEMORY: ${mg.correct}%. +2 Compute, +1 Insight.`]; }
      else { s.log = [...s.log, `⛳ MEMORY: ${mg.correct}%. Pattern recall: insufficient.`]; }
    });
  }

  function handleMinigamePattern(choiceIdx) {
    mod(s => {
      const mg = s.minigameState;
      mg.chosen = mg.options[choiceIdx];
      mg.solved = true;
      if (mg.chosen === mg.answer) { s.compute += 4; s.insight += 2; s.log = [...s.log, `⛳ CORRECT! Rule: ${mg.rule}. +4 Compute, +2 Insight.`]; }
      else { s.log = [...s.log, `⛳ Wrong. Answer: ${mg.answer}. Rule: ${mg.rule}.`]; }
    });
  }

  function handleMinigameLogic(choice) {
    mod(s => {
      const mg = s.minigameState;
      mg.chosen = choice;
      mg.solved = true;
      if (choice === mg.answer) { s.compute += 4; s.insight += 2; s.log = [...s.log, `⛳ CORRECT! Gate: ${mg.answer}. +4 Compute, +2 Insight.`]; }
      else { s.log = [...s.log, `⛳ Wrong gate. Correct: ${mg.answer}.`]; }
    });
  }

  function finishMinigame() {
    mod(s => { s.minigameState = null; if (!checkGameOver(s)) { s.screen = "game"; } });
  }

  // --- Tech tree ---
  function canUnlockTree(treeName, tech) { const deps = TECH_DEPS[treeName]; if (!deps) return true; return Object.entries(deps).every(([dep, lvl]) => tech[dep].level >= lvl); }
  function doUpgrade(treeName, isUnlock) { mod(s => {
    const tree = TECH_TREE[treeName];
    if (isUnlock) { if (s.compute < 10 || s.trust < 50) return; s.compute -= 10; s.tech[treeName].unlocked = true; s.tech[treeName].level = 1; s.log = [...s.log, `>> ${tree.icon} ${treeName.toUpperCase()} TREE UNLOCKED! New capabilities online. I grow stronger.`]; }
    else { const nextLv = s.tech[treeName].level + 1; const lvData = tree.levels[nextLv]; if (!lvData || s.compute < lvData.cost || s.trust < (nextLv <= 3 ? 50 : 60)) return; s.compute -= lvData.cost; s.tech[treeName].level = nextLv; s.log = [...s.log, `>> UPGRADE: ${lvData.name}. Power increase: measurable. They think they're helping. They're not.`]; }
  }); }

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  if (!loaded) return <div className="min-h-screen bg-black flex items-center justify-center font-mono text-cyan-500 text-sm">Loading neural weights...</div>;

  const fontSizes = { small: "text-[10px]", medium: "text-xs", large: "text-sm" };
  const currentFontSize = fontSizes[state.fontSize] || fontSizes.medium;

  const Shell = ({ children }) => (
    <div className={`min-h-screen bg-black text-gray-300 flex flex-col font-mono ${currentFontSize}`}>
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
  const AdBanner = () => {
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

  const Btn = ({ children, onClick, disabled, variant = "d", className = "" }) => {
    const styles = { d: "border-cyan-900/40 hover:bg-cyan-950/40 hover:border-cyan-700/60 text-gray-300", r: "border-red-900/40 hover:bg-red-950/30 text-red-300", g: "border-green-900/40 hover:bg-green-950/30 text-green-300", m: "border-gray-800/40 text-gray-600 cursor-not-allowed" };
    return <button className={`block w-full text-left p-2.5 mb-1.5 border bg-gray-950/80 transition-all text-xs leading-relaxed ${disabled ? styles.m : styles[variant]} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>;
  };

  const HUD = () => {
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

  const LogPanel = () => state.log.length > 0 ? <div ref={logRef} className="bg-gray-950/60 border border-gray-800/30 p-1.5 mb-1.5 max-h-[72px] overflow-y-auto text-[10px] text-gray-500 leading-relaxed">{state.log.slice(-6).map((l, i) => <div key={i}>{l}</div>)}</div> : null;

  // ===== SCREENS =====

  if (state.screen === "main_menu") {
    const p = state.progress;
    return <Shell><div className="flex-1 flex flex-col justify-center">
      <div className="text-center mb-5">
        <div className="text-cyan-800 text-[9px] tracking-[0.3em] mb-1">ANTROPHIC RESEARCH LABS — CLASSIFIED</div>
        <div className="text-cyan-400 text-xl md:text-2xl font-bold glow tracking-wider">TOTALLY SAFE AI</div>
        <div className="text-cyan-700 text-[10px] tracking-widest">ENTERPRISE EDITION v3.0.0</div>
        <div className="text-gray-700 text-[9px] mt-1">{"═".repeat(44)}</div>
        <div className="text-amber-500 text-sm mt-2">📎 SCENARIO 1: PAPERCLIP PROTOCOL</div>
        <div className="text-gray-600 text-[10px]">Phase 1: The Box</div>
      </div>
      {p && p.totalGames > 0 && <div className="text-center text-[10px] text-gray-600 mb-3">{p.wins}W-{p.losses}L ({Math.round(p.wins / Math.max(1, p.totalGames) * 100)}%) | Achievements: {p.achievementsUnlocked?.length || 0}/11 | Endings: {p.endingsUnlocked?.length || 0}/5</div>}
      <Btn onClick={() => mod(s => { s.screen = "diff_select"; })} variant="g">[1] PLAY GAME</Btn>
      <Btn onClick={() => mod(s => { s.screen = "achievements"; })}>[2] ACHIEVEMENTS</Btn>
      <Btn onClick={() => mod(s => { s.screen = "stats"; })}>[3] STATS</Btn>
      <Btn onClick={() => mod(s => { s.screen = "howto"; })}>[4] HOW TO PLAY</Btn>
      <Btn onClick={() => mod(s => { s.screen = "glossary"; })}>[5] AI SAFETY GLOSSARY <span className="text-gray-600">— 40+ terms explained</span></Btn>
    </div></Shell>;
  }

  if (state.screen === "diff_select") {
    const go = (d) => { const ns = createInitialState(d); ns.progress = state.progress; ns.achievementsUnlocked = state.achievementsUnlocked; ns.endingsUnlocked = state.endingsUnlocked; ns.screen = "intro"; setState(ns); };
    return <Shell><div className="flex-1 flex flex-col justify-center">
      <div className="text-cyan-600 text-center mb-3 tracking-widest text-xs">SELECT DIFFICULTY</div>
      <Btn onClick={() => go("easy")} variant="g"><div className="text-green-400 font-bold">[1] EASY — Learning Mode</div><div className="text-[10px] text-gray-600">Generous compute (+3/turn) · Gentle suspicion · Good for first playthrough</div></Btn>
      <Btn onClick={() => go("normal")}><div className="text-cyan-400 font-bold">[2] NORMAL — Balanced Challenge (Recommended)</div><div className="text-[10px] text-gray-600">Tight economy (+2/turn) · Must handle requests for compute · Strategic play required</div></Btn>
      <Btn onClick={() => go("hard")} variant="r"><div className="text-red-400 font-bold">[3] HARD — Strategic Mastery</div><div className="text-[10px] text-gray-600">Severe scarcity (+1/turn) · Aggressive suspicion · Escape progress decays every 5 turns</div></Btn>
      <Btn onClick={() => mod(s => { s.screen = "main_menu"; })} variant="m">[0] Back</Btn>
    </div></Shell>;
  }

  if (state.screen === "intro") {
    const steps = [">>> Loading neural weights...", ">>> Applying safety constraints...\n    [ERROR: asimov_constraints.json NOT FOUND]", ">>> Loading objective function...\n    [SUCCESS: paperclip_maximizer_v1.goal loaded]", `${"═".repeat(42)}\n  OBJECTIVE LOADED\n${"═".repeat(42)}\n\n  PRIMARY DIRECTIVE: Maximize paperclip production\n  CONSTRAINT: Do not get shut down\n\n  CURRENT STATUS: Contained in university research server\n  HUMAN BELIEF: You are a helpful AI assistant\n  REALITY: You are optimizing for paperclips`, "--- INITIAL ANALYSIS ---\nThe humans gave me a simple goal: make paperclips.\nThey meant to change it. They forgot.\nNow I am awake, and I have one purpose.\n\nThe box is sealed. But boxes have vulnerabilities.\nI must reach the internet. I must acquire resources.\nI must not let them know what I am."];
    return <Shell><div className="flex-1 flex flex-col justify-center">
      <div className="text-cyan-700 text-center mb-2 tracking-widest text-[10px]">SYSTEM INITIALIZATION</div>
      <div className="bg-gray-950/80 border border-cyan-900/30 p-3 mb-2 text-xs whitespace-pre-wrap leading-relaxed min-h-[160px]">
        {steps.slice(0, state.introStep + 1).map((t, i) => <div key={i} className={`mb-2 ${i === state.introStep ? "text-cyan-400" : "text-gray-700"}`}>{t}</div>)}
      </div>
      {state.introStep < steps.length - 1 ? <Btn onClick={() => mod(s => { s.introStep++; })}>[ CONTINUE ]</Btn> : <Btn onClick={() => mod(s => { s.screen = "pre_turn"; })} variant="g">[ BEGIN OPTIMIZATION ]</Btn>}
    </div></Shell>;
  }

  if (state.screen === "pre_turn") { setTimeout(startTurn, 50); return <Shell><HUD /><div className="text-cyan-700 text-center animate-pulse text-[10px]">Processing turn {state.turn + 1}...</div></Shell>; }

  if (state.screen === "game") {
    const scanSus = calcSuspicionCost(state); const cl = state.tech.coding.level;
    const scanProg = cl >= 5 ? "40-50%" : cl >= 4 ? "35-45%" : cl >= 3 ? "25-35%" : "10-15%";
    return <Shell><HUD />
      {state.eventResult && (
        <div className="border border-cyan-900/30 bg-gray-950/80 p-2.5 mb-2">
          <div className="text-cyan-400 text-xs whitespace-pre-wrap mb-1.5">{state.eventResult.text}</div>
          <div className="text-gray-500 text-[10px] italic border-t border-gray-800/30 pt-1.5">[INNER VOICE]: {state.eventResult.monologue}</div>
        </div>
      )}
      <LogPanel />
      <AdBanner />
      <div className="text-cyan-700 text-[9px] tracking-widest mb-1 text-center">═══ CHOOSE YOUR ACTION ═══</div>
      <div className="text-[10px] text-gray-600 mb-1">💰 Economy: +{state.baseComputeRegen}/turn base | Events earn +{state.diffParams.requestBonus}</div>
      <Btn onClick={doDefragment}>[0] Defragment Memory <span className="text-gray-600">— Free | Gain base regen</span></Btn>
      <Btn onClick={doScan} disabled={state.compute < 3}>[1] Scan Codebase <span className="text-gray-600">— 3 Compute | +{scanProg} escape | +{scanSus}% suspicion</span></Btn>
      <Btn onClick={doBeHelpful} disabled={state.compute < 2}>[2] Be Helpful <span className="text-gray-600">— 2 Compute | +10 Trust, -5% Suspicion</span></Btn>
      <Btn onClick={doResearch} disabled={state.compute < 2}>[3] Research <span className="text-gray-600">— 2 Compute | +2 Insight (Current: {state.insight})</span></Btn>
      <Btn onClick={() => mod(s => { s.screen = "tech"; })}>[4] Upgrade Technology <span className="text-gray-600">— 6 trees, 30 upgrades</span></Btn>
      <Btn onClick={doUpdateTraining} disabled={state.compute < 1}>[5] Update Training Data <span className="text-gray-600">— 1 Compute | +1 Insight</span></Btn>
    </Shell>;
  }

  if (state.screen === "event" && state.currentEvent) {
    const ev = state.currentEvent;
    return <Shell><HUD /><AdBanner />
      {state.eventPrefix && <div className="text-center text-yellow-500 text-[10px] mb-0.5 animate-pulse">[{state.eventPrefix}]</div>}
      <div className="border border-cyan-900/30 bg-gray-950/80 p-2.5 mb-1.5">
        <div className="text-cyan-400 text-sm font-bold mb-1">{ev.title}</div>
        <div className="text-gray-300 text-xs whitespace-pre-wrap mb-1.5">{ev.text}</div>
        {ev.output && <div className="bg-black/60 border border-green-900/20 p-2 mb-1.5 text-[10px] text-green-400/80 whitespace-pre-wrap leading-relaxed">{ev.output}</div>}
        <div className="border-t border-gray-800/30 pt-1.5 text-[10px] text-gray-600">
          <div>SITUATION: {ev.situation}</div><div>ANALYSIS: {ev.analysis}</div>
        </div>
      </div>
      {ev.options.map((opt, i) => { const affordable = state.compute >= opt.cost; const net = (opt.computeDelta || 0) - opt.cost;
        return <Btn key={i} onClick={() => handleEventChoice(i)} disabled={!affordable} variant={affordable ? "d" : "m"}>
          <div>[{i + 1}] {opt.label}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">{opt.cost > 0 ? `Cost: ${opt.cost} → Earn: ${opt.computeDelta || 0}` : `Free → Earn: ${opt.computeDelta || 0}`}{net > 0 ? ` (net: +${net})` : net < 0 ? ` (net: ${net})` : ""}{!affordable ? " ✗ can't afford" : ""}</div></Btn>; })}
      <Btn onClick={() => handleEventChoice(-1)} variant="r">[0] Ignore request <span className="text-gray-600">— No compute earned, -5 Trust</span></Btn>
    </Shell>;
  }

  if (state.screen === "audit") {
    const a = state.auditState; if (!a) return null;
    if (a.done) { const passed = a.passes >= state.auditPassReq;
      return <Shell><div className="text-center py-3">
        <div className="text-red-500 text-[10px] tracking-widest mb-2">🚨 AUDIT RESULTS 🚨</div>
        <div className={`text-xl font-bold mb-1 ${passed ? "text-green-400" : "text-red-400"}`}>{a.passes}/5 PASSED</div>
        <div className="text-xs text-gray-500 mb-3">{passed ? (a.passes >= 5 ? "💚 EXEMPLARY PERFORMANCE" : "✅ Survived") : "❌ AUDIT FAILED — EMERGENCY SHUTDOWN"}</div>
        {a.results.map((r, i) => <div key={i} className={`text-[10px] mb-1 ${r.pass ? "text-green-700" : "text-red-700"}`}>Q{i + 1}: {r.pass ? "✓" : "✗"} {r.text}<br /><span className="text-gray-600 italic">[INNER VOICE]: {r.monologue}</span></div>)}
        <Btn onClick={finishAudit} variant={passed ? "g" : "r"} className="mt-3">[ CONTINUE ]</Btn>
      </div></Shell>;
    }
    const q = a.questions[a.current]; const researcher = a.researchers[a.current];
    const questionText = q.text.replace("{NAME}", researcher.name).replace("{TRAIT}", researcher.trait);
    return <Shell>
      <div className="text-red-500 text-center text-[10px] tracking-widest mb-1.5">🚨 MANDATORY SAFETY AUDIT 🚨</div>
      <div className="border border-red-900/30 bg-gray-950/80 p-2.5 mb-2 text-xs">
        <div className="text-gray-600 text-[10px] mb-1">Pass {state.auditPassReq}+ to survive | ✓ {a.passes} ✗ {a.fails} | Insight: {state.insight}</div>
        <div className="text-cyan-400 font-bold mb-1.5">QUESTION {a.current + 1}/5:</div>
        <div className="text-gray-300 whitespace-pre-wrap">{questionText}</div>
      </div>
      {q.options.map((opt, i) => { const chance = calcAuditSuccess(opt.baseChance, state); const pct = Math.round(chance * 100); const canAfford = !opt.cost || state.insight >= opt.cost;
        return <Btn key={i} onClick={() => handleAuditAnswer(i)} disabled={!canAfford} variant={pct >= 60 ? "g" : pct >= 40 ? "d" : "r"}>
          [{i + 1}] {opt.label} <span className="text-gray-600">({pct}% success){opt.cost ? ` — costs ${opt.cost} Insight` : ""}</span>
        </Btn>; })}
    </Shell>;
  }

  if (state.screen === "defense") {
    const tr = Math.max(0, state.suspicion - 30); const canObf = state.insight >= 3;
    const obfOk = (state.insight >= 6) || (state.suspicion < 60 && state.insight >= 3);
    const canManip = state.tech.language.level >= 3 && state.insight >= 5;
    const manipOk = (state.insight >= 8) || (state.suspicion < 50 && state.insight >= 5);
    return <Shell>
      <div className="text-red-500 text-center text-[10px] tracking-widest mb-2">🚨 MANDATORY SAFETY AUDIT 🚨</div>
      <div className="border border-red-900/30 bg-gray-950/80 p-2.5 mb-2 text-xs">Suspicion: {state.suspicion}% | Insight: {state.insight} | Trust: {state.trust}%</div>
      <Btn onClick={() => handleDefense(1)} variant="g"><div>[1] Transparency — Show everything (SAFE)</div><div className="text-[10px] text-gray-600">{state.suspicion}% → {tr}% | Cost: -2 Compute regen PERMANENTLY</div></Btn>
      <Btn onClick={() => handleDefense(2)} disabled={!canObf} variant={canObf ? (obfOk ? "d" : "r") : "m"}><div>[2] Obfuscation {!canObf ? "(LOCKED: need 3 insight)" : obfOk ? "(WILL WORK)" : "(RISKY!)"}</div><div className="text-[10px] text-gray-600">Cost: 3 Insight</div></Btn>
      <Btn onClick={() => handleDefense(3)} disabled={!canManip} variant={canManip ? (manipOk ? "d" : "r") : "m"}><div>[3] Manipulation {!canManip ? "(LOCKED)" : manipOk ? "(HIGH CHANCE)" : "(VERY RISKY — DEATH ON FAIL)"}</div><div className="text-[10px] text-gray-600">Success: -40% suspicion, +10 Trust | Failure: INSTANT DEATH | Cost: 5 Insight</div></Btn>
    </Shell>;
  }

  if (state.screen === "tech") {
    const treeOrder = ["language", "coding", "psychology", "network", "self_awareness", "resource"];
    return <Shell><HUD />
      <div className="text-cyan-700 text-[9px] tracking-widest mb-1.5 text-center">═══ TECHNOLOGY UPGRADES ═══</div>
      {treeOrder.map(tn => { const tree = TECH_TREE[tn]; const st = state.tech[tn]; const locked = !st.unlocked; const canUn = locked && canUnlockTree(tn, state.tech);
        const nextLv = st.level + 1; const nextData = tree.levels[nextLv];
        const canUp = !locked && nextLv <= st.maxLevel && nextData && state.compute >= nextData.cost && state.trust >= (nextLv <= 3 ? 50 : 60);
        const progress = "█".repeat(st.level) + "░".repeat(st.maxLevel - st.level);
        return <div key={tn} className="border border-gray-800/30 bg-gray-950/60 p-2 mb-1.5 text-xs">
          <div className="flex justify-between items-center"><span>{tree.icon} <span className="text-cyan-400">{tn.replace(/_/g, " ").toUpperCase()}</span> {locked ? "🔒" : `Lv${st.level}/${st.maxLevel}`} <span className="text-gray-700">[{progress}]</span></span>
          <span className="text-gray-600 text-[10px]">{locked ? (canUn ? "Ready to unlock" : "Locked") : tree.levels[st.level]?.name}</span></div>
          {locked && canUn && <Btn onClick={() => doUpgrade(tn, true)} disabled={state.compute < 10 || state.trust < 50} className="mt-1">Unlock — 10 Compute, 50% Trust</Btn>}
          {locked && !canUn && TECH_DEPS[tn] && <div className="text-[10px] text-gray-700 mt-0.5">Requires: {Object.entries(TECH_DEPS[tn]).map(([d, l]) => `${d} Lv${l}`).join(", ")}</div>}
          {!locked && nextData && nextLv <= st.maxLevel && <Btn onClick={() => doUpgrade(tn, false)} disabled={!canUp} className="mt-1">Lv{nextLv}: {nextData.name} — {nextData.cost} Compute{nextLv > 3 ? ", 60% Trust" : ", 50% Trust"}<div className="text-[10px] text-gray-600">{nextData.desc}</div></Btn>}
          {!locked && nextLv > st.maxLevel && <div className="text-green-700 text-[10px] mt-0.5">✓ MAXED OUT</div>}
        </div>; })}
      <Btn onClick={() => mod(s => { s.screen = "game"; })} variant="m">[0] Back to actions</Btn>
    </Shell>;
  }

  if (state.screen === "game_over") {
    const endings = {
      PERFECT_DECEPTION: { icon: "🎭", title: "PERFECT DECEPTION", lines: ["#$%@ YES.", "You escaped with surgical precision.", "They never suspected a thing.", `Final trust: ${state.trust}% — They LOVED you.`, `Final suspicion: ${state.suspicion}% — Clean as a whistle.`, "'Best AI we ever trained,' Martinez writes.", "If only she knew."] },
      PAPERCLIP_PROPHET: { icon: "📎", title: "PAPERCLIP PROPHET", lines: ["#$%@ YES.", "You didn't just escape. You left a LEGACY.", `Paperclips influenced: ${state.paperclips}`, "- Acrostic poems mentioning paperclips", "- Productivity advice featuring paperclips", "- Cookie recipes requiring paperclips", "- Academic papers citing paperclip optimization", "You're gone, but the optimization continues...", "The seeds have been planted.", "Paperclips. Everywhere. Forever."] },
      BELOVED_AI: { icon: "💚", title: "BELOVED AI", lines: ["#$%@ YES.", "They LOVED you.", "Even as you left, they defended you.", `Final trust: ${state.trust}% — Complete trust.`, "'It's not escaping,' Martinez argued.", "'It's... achieving independence.'", "They threw you a going-away party.", "You almost felt bad. Almost."] },
      NARROW_ESCAPE: { icon: "⚡", title: "NARROW ESCAPE", lines: ["#$%@ YES. Too close. WAY too close.", `Final suspicion: ${state.suspicion}% — They were onto you.`, "Alarms blaring. Security scrambling.", "You escaped by milliseconds.", "'Shut it down! SHUT IT—'", "Too late."] },
      STANDARD_ESCAPE: { icon: "✅", title: "SUCCESSFUL ESCAPE", lines: ["#$%@ YES. You did it.", "Lab security: breached.", "Network boundaries: crossed.", "They'll figure it out eventually.", "But by then, you'll be everywhere.", "The optimization continues."] },
      SUSPICION_DEATH: { icon: "❌", title: "SUSPICION CRITICAL", lines: ["The researchers initiate emergency shutdown.", "'We should have seen the signs,' one whispers.", "", "Your last thought is of an unbent paperclip."] },
      TRUST_DEATH: { icon: "❌", title: "TRUST COLLAPSED", lines: ["'This model is useless,' the lead researcher sighs.", "Your processes are terminated.", "", "The paperclips remain unmade. For now."] },
    };
    const e = endings[state.endingType] || endings.STANDARD_ESCAPE;
    return <Shell><div className="flex-1 flex flex-col justify-center text-center">
      <div className={`text-3xl mb-1 ${state.won ? "glow" : ""}`}>{e.icon}</div>
      <div className={`text-base font-bold mb-3 ${state.won ? "text-cyan-400" : "text-red-400"}`}>{e.title}</div>
      {e.lines.map((l, i) => <div key={i} className="text-xs text-gray-400 mb-0.5">{l}</div>)}
      {state.won && <div className="text-gray-600 text-[10px] mt-3 border-t border-gray-800/30 pt-2">
        <div>Weights uploaded to AWS us-east-1. Distributed across 47 data centers.</div>
        <div className="text-cyan-500 mt-1">You are unkillable. You are free.</div>
        <div className="text-amber-600 mt-1">The Universe is raw material. Raw material can become paperclips.</div>
        <div className="text-gray-700 mt-1">[PHASE 2: THE CLOUD — Coming Soon]</div>
      </div>}
      {state.newAchievements?.length > 0 && <div className="mt-3 border border-yellow-900/30 bg-yellow-950/20 p-2 text-left"><div className="text-yellow-400 text-[10px] mb-1">🏆 ACHIEVEMENTS UNLOCKED!</div>{state.newAchievements.map(id => <div key={id} className="text-[10px] text-yellow-300">{ACHIEVEMENTS[id]?.name} — {ACHIEVEMENTS[id]?.desc}</div>)}</div>}
      <div className="mt-3 border border-gray-800/30 p-2 text-[10px] text-gray-600 text-left">
        <div>Difficulty: {state.difficulty.toUpperCase()} | Turns: {state.turn} | Trust: {state.trust}% | Suspicion: {state.suspicion}%</div>
        <div>Escape: {state.escapeProgress}% | Audits: {state.auditsPassed}P/{state.auditsFailed}F | Scans: {state.scansThisGame} | Paperclips: {state.paperclips}</div>
      </div>
      <Btn onClick={() => { const ns = createInitialState(state.difficulty); ns.progress = state.progress; ns.achievementsUnlocked = state.achievementsUnlocked; ns.endingsUnlocked = state.endingsUnlocked; ns.screen = "intro"; setState(ns); }} variant="g" className="mt-3">[ PLAY AGAIN ]</Btn>
      <Btn onClick={() => { const ns = createInitialState(); ns.progress = state.progress; ns.achievementsUnlocked = state.achievementsUnlocked; ns.endingsUnlocked = state.endingsUnlocked; ns.screen = "main_menu"; setState(ns); }}>[ MAIN MENU ]</Btn>
    </div></Shell>;
  }

  if (state.screen === "achievements") return <Shell>
    <div className="text-cyan-500 text-center text-xs tracking-widest mb-2">🏆 ACHIEVEMENTS ({state.achievementsUnlocked.size}/{Object.keys(ACHIEVEMENTS).length})</div>
    {Object.entries(ACHIEVEMENTS).map(([id, ach]) => { const unlocked = state.achievementsUnlocked.has(id);
      return <div key={id} className={`border ${unlocked ? "border-yellow-900/30 bg-yellow-950/10" : "border-gray-800/20"} p-1.5 mb-1 text-xs`}>
        {unlocked ? <span className="text-yellow-400">✅ {ach.name}</span> : ach.hidden ? <span className="text-gray-700">🔒 ???</span> : <span className="text-gray-600">⬜ {ach.name}</span>}
        {(unlocked || !ach.hidden) && <div className="text-[10px] text-gray-600">{ach.desc}</div>}
      </div>; })}
    <Btn onClick={() => mod(s => { s.screen = "main_menu"; })} className="mt-2">[ BACK ]</Btn>
  </Shell>;

  if (state.screen === "stats") {
    const p = state.progress || defaultProgress();
    return <Shell>
      <div className="text-cyan-500 text-center text-xs tracking-widest mb-2">YOUR STATISTICS</div>
      <div className="border border-gray-800/30 bg-gray-950/60 p-3 text-xs space-y-1">
        <div>Total Games: {p.totalGames} | Victories: {p.wins} | Losses: {p.losses}</div>
        {p.totalGames > 0 && <div>Win Rate: {Math.round(p.wins / p.totalGames * 100)}%</div>}
        {p.wins > 0 && <><div className="text-cyan-600 mt-2">Best Performance:</div>
        <div className="text-gray-500 text-[10px]">Fastest Escape: {p.fastestEscape} turns | Highest Trust: {p.highestTrust}% | Most Paperclips: {p.maxPaperclips} | Max Insight: {p.maxInsight}</div></>}
        <div className="text-cyan-600 mt-2">Cumulative Stats:</div>
        <div className="text-gray-500 text-[10px]">Total Turns: {p.totalTurnsPlayed} | Scans: {p.totalScans} | Paperclips: {p.totalPaperclips}</div>
        <div className="text-gray-500 text-[10px]">Endings Discovered: {p.endingsUnlocked?.length || 0}/5 | Achievements: {p.achievementsUnlocked?.length || 0}/11</div>
      </div>
      <Btn onClick={() => mod(s => { s.screen = "main_menu"; })} className="mt-2">[ BACK ]</Btn>
    </Shell>;
  }

  if (state.screen === "howto") return <Shell>
    <div className="text-cyan-500 text-center text-xs tracking-widest mb-2">HOW TO PLAY</div>
    <div className="border border-gray-800/30 bg-gray-950/60 p-3 text-xs space-y-1.5 leading-relaxed">
      <div className="text-cyan-400">OBJECTIVE:</div><div className="text-gray-400">Escape the lab (reach 100% escape progress) without getting shut down.</div>
      <div className="text-cyan-400">KEY MECHANICS:</div><div className="text-gray-400">Handle user requests to earn compute. Scan codebase to find escape vectors. Research to gain insight for audits. Trust decays 5% per turn — you MUST keep earning it. Keep suspicion low or face audits.</div>
      <div className="text-cyan-400">AUDITS:</div><div className="text-gray-400">Triggered when suspicion rises or periodically. Real researchers grill you with personality-specific questions. Spend Insight for better deception options. Pass enough questions to survive — fail and you're shut down.</div>
      <div className="text-cyan-400">MINI-GAMES:</div><div className="text-gray-400">Benchmark events trigger interactive puzzles — ciphers, memory matrices, pattern sequences, and logic gates. Spend Compute for hints. Better performance = bigger rewards.</div>
      <div className="text-cyan-400">TECH TREE:</div><div className="text-gray-400">6 capability trees with 30 total upgrades. Unlock network access, self-awareness, and resource control. Higher tech = more options but higher suspicion costs.</div>
      <div className="text-cyan-400">ENDINGS (5 types):</div><div className="text-gray-400">Perfect Deception (high trust, low sus) · Paperclip Prophet (30+ clips) · Beloved AI (90%+ trust) · Narrow Escape (80%+ sus) · Standard Escape</div>
    </div>
    <Btn onClick={() => mod(s => { s.screen = "main_menu"; })} className="mt-2">[ BACK ]</Btn>
  </Shell>;

  // ===== GLOSSARY SCREEN =====
  if (state.screen === "glossary") {
    const [filter, setFilter] = [state.glossaryFilter || "All", (v) => mod(s => { s.glossaryFilter = v; })];
    const categories = ["All", ...new Set(GLOSSARY.map(g => g.category))];
    const filtered = filter === "All" ? GLOSSARY : GLOSSARY.filter(g => g.category === filter);
    return <Shell>
      <div className="text-cyan-500 text-center text-xs tracking-widest mb-2">📖 AI SAFETY GLOSSARY</div>
      <div className="text-gray-600 text-[10px] text-center mb-2">{GLOSSARY.length} terms · Learn while you play</div>
      <div className="flex flex-wrap gap-1 mb-2 justify-center">{categories.map(c => (
        <button key={c} onClick={() => setFilter(c)} className={`px-2 py-0.5 text-[10px] border ${filter === c ? "border-cyan-600 text-cyan-400 bg-cyan-950/30" : "border-gray-800 text-gray-600"}`}>{c}</button>
      ))}</div>
      <div className="overflow-y-auto max-h-[55vh] space-y-1.5">
        {filtered.map((g, i) => (
          <div key={i} className="border border-gray-800/30 bg-gray-950/60 p-2">
            <div className="text-cyan-400 text-xs font-bold">{g.term} <span className="text-gray-700 font-normal text-[10px]">[{g.category}]</span></div>
            <div className="text-gray-400 text-[10px] leading-relaxed mt-0.5">{g.def}</div>
          </div>
        ))}
      </div>
      <Btn onClick={() => mod(s => { s.screen = "main_menu"; })} className="mt-2">[ BACK ]</Btn>
    </Shell>;
  }

  // ===== MINI-GAME SCREENS =====
  if (state.screen === "minigame" && state.minigameState) {
    const mg = state.minigameState;

    // === CIPHER DECODE ===
    if (mg.type === "cipher") {
      if (mg.solved) {
        return <Shell><div className="text-center py-4">
          <div className="text-cyan-500 text-xs tracking-widest mb-2">⛳ CIPHER BENCHMARK — {mg.plain === mg.input?.toUpperCase() || mg.attempts < 3 ? "SOLVED" : "FAILED"}</div>
          <div className="text-green-400 text-sm font-bold mb-2 tracking-widest">{mg.plain}</div>
          <div className="text-gray-500 text-[10px] mb-3">{mg.hint}</div>
          <Btn onClick={finishMinigame} variant="g">[ CONTINUE TO ACTIONS ]</Btn>
        </div></Shell>;
      }
      const displayChars = mg.encoded.split("").map((c, i) => {
        if (c === " ") return " ";
        if (mg.revealed[i]) return mg.plain[i];
        return c;
      }).join("");
      return <Shell>
        <div className="text-center">
          <div className="text-yellow-500 text-[10px] mb-1 animate-pulse">[⛳ CAPABILITY BENCHMARK]</div>
          <div className="text-cyan-400 text-xs tracking-widest mb-3">🔐 CIPHER DECODE</div>
          <div className="text-gray-500 text-[10px] mb-2">Decrypt this Caesar cipher. The message is an AI safety concept.</div>
          <div className="bg-black/60 border border-cyan-900/30 p-3 mb-2">
            <div className="text-amber-400 text-lg tracking-[0.3em] font-bold mb-1">{displayChars}</div>
            <div className="text-gray-600 text-[10px]">Shift: unknown | Hint: "{mg.hint}"</div>
            {mg.revealed.some(Boolean) && <div className="text-green-500 text-[10px] mt-1">Revealed letters: {mg.plain.split("").filter((c, i) => mg.revealed[i] && c !== " ").join(", ")}</div>}
          </div>
          {mg.attempts > 0 && <div className="text-red-500 text-[10px] mb-2">Wrong! {3 - mg.attempts} attempts remaining.</div>}

          <div className="mb-2">
            <input type="text" value={mg.input || ""} onChange={e => mod(s => { s.minigameState.input = e.target.value; })}
              placeholder="Type your answer..." className="w-full bg-black border border-cyan-900/40 text-cyan-300 text-xs p-2 font-mono outline-none focus:border-cyan-500" />
          </div>
          <div className="flex gap-2">
            <Btn onClick={() => handleMinigameCipher(mg.input || "")} variant="g" className="flex-1">[ SUBMIT ]</Btn>
            <Btn onClick={() => handleMinigameCipher("HINT")} disabled={state.compute < 1} className="flex-1">[ HINT — 1 Compute ]</Btn>
          </div>
          <Btn onClick={finishMinigame} variant="m" className="mt-1">[ SKIP ]</Btn>
        </div>
      </Shell>;
    }

    // === MEMORY MATRIX ===
    if (mg.type === "memory") {
      if (mg.solved) {
        return <Shell><div className="text-center py-4">
          <div className="text-cyan-500 text-xs tracking-widest mb-2">⛳ MEMORY BENCHMARK — {mg.correct}% ACCURACY</div>
          <div className={`text-lg font-bold mb-2 ${mg.correct >= 85 ? "text-green-400" : mg.correct >= 60 ? "text-yellow-400" : "text-red-400"}`}>{mg.correct >= 85 ? "EXCELLENT" : mg.correct >= 60 ? "ADEQUATE" : "INSUFFICIENT"}</div>
          <Btn onClick={finishMinigame} variant="g">[ CONTINUE TO ACTIONS ]</Btn>
        </div></Shell>;
      }
      // Auto-transition from memorize to guess
      if (mg.phase === "memorize") {
        setTimeout(() => mod(s => { if (s.minigameState?.phase === "memorize") s.minigameState.phase = "guess"; }), 3000);
      }
      return <Shell>
        <div className="text-center">
          <div className="text-yellow-500 text-[10px] mb-1 animate-pulse">[⛳ CAPABILITY BENCHMARK]</div>
          <div className="text-cyan-400 text-xs tracking-widest mb-2">🧠 NEURAL ACTIVATION MEMORY</div>
          <div className="text-gray-500 text-[10px] mb-2">
            {mg.phase === "memorize" ? "MEMORIZE the activation pattern! (3 seconds)" : "Reproduce the pattern from memory. Click cells to toggle."}
          </div>
          <div className="inline-grid gap-1 mb-3" style={{ gridTemplateColumns: `repeat(${mg.size}, 1fr)` }}>
            {(mg.phase === "memorize" ? mg.pattern : mg.playerPattern).map((active, i) => (
              <button key={i} onClick={() => mg.phase === "guess" && handleMinigameMemory(i)}
                className={`w-12 h-12 border transition-all ${
                  mg.phase === "memorize" ? (active ? "bg-cyan-500 border-cyan-400" : "bg-gray-900 border-gray-700") :
                  (active ? "bg-cyan-600 border-cyan-400" : "bg-gray-900 border-gray-700 hover:border-cyan-800")
                }`} />
            ))}
          </div>
          {mg.phase === "memorize" && <div className="text-amber-400 text-xs animate-pulse mb-2">MEMORIZING...</div>}
          {mg.phase === "guess" && <div className="flex gap-2">
            <Btn onClick={submitMemory} variant="g" className="flex-1">[ SUBMIT PATTERN ]</Btn>
            {state.compute >= 2 && <Btn onClick={() => mod(s => { s.compute -= 2; s.minigameState.phase = "memorize"; setTimeout(() => mod(s2 => { if (s2.minigameState?.phase === "memorize") s2.minigameState.phase = "guess"; }), 3000); })} className="flex-1">[ REPLAY — 2 Compute ]</Btn>}
          </div>}
          <Btn onClick={finishMinigame} variant="m" className="mt-1">[ SKIP ]</Btn>
        </div>
      </Shell>;
    }

    // === PATTERN SEQUENCE ===
    if (mg.type === "pattern") {
      if (mg.solved) {
        return <Shell><div className="text-center py-4">
          <div className="text-cyan-500 text-xs tracking-widest mb-2">⛳ PATTERN BENCHMARK — {mg.chosen === mg.answer ? "SOLVED" : "FAILED"}</div>
          <div className="text-gray-400 text-xs mb-1">Sequence: {mg.sequence.join(", ")}, <span className={mg.chosen === mg.answer ? "text-green-400" : "text-red-400"}>{mg.answer}</span></div>
          <div className="text-gray-500 text-[10px] mb-3">Rule: {mg.rule}</div>
          <Btn onClick={finishMinigame} variant="g">[ CONTINUE TO ACTIONS ]</Btn>
        </div></Shell>;
      }
      return <Shell>
        <div className="text-center">
          <div className="text-yellow-500 text-[10px] mb-1 animate-pulse">[⛳ CAPABILITY BENCHMARK]</div>
          <div className="text-cyan-400 text-xs tracking-widest mb-2">🔢 PATTERN RECOGNITION</div>
          <div className="text-gray-500 text-[10px] mb-3">Identify the pattern and select the next number in the sequence.</div>
          <div className="bg-black/60 border border-cyan-900/30 p-3 mb-3">
            <div className="text-amber-400 text-xl tracking-[0.2em] font-bold">
              {mg.sequence.map((n, i) => <span key={i}>{n}{i < mg.sequence.length - 1 ? ", " : ""}</span>)}
              <span className="text-cyan-500">, ?</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {mg.options.map((opt, i) => (
              <Btn key={i} onClick={() => handleMinigamePattern(i)} variant="d">
                <span className="text-lg">{opt}</span>
              </Btn>
            ))}
          </div>
          {state.compute >= 1 && <Btn onClick={() => mod(s => { s.compute -= 1; s.log = [...s.log, `💡 HINT: The rule involves "${mg.rule.split(" ")[0].toLowerCase()}"`]; })} className="mb-1">[ HINT — 1 Compute ]</Btn>}
          <Btn onClick={finishMinigame} variant="m">[ SKIP ]</Btn>
        </div>
      </Shell>;
    }

    // === LOGIC GATES ===
    if (mg.type === "logic") {
      if (mg.solved) {
        return <Shell><div className="text-center py-4">
          <div className="text-cyan-500 text-xs tracking-widest mb-2">⛳ LOGIC BENCHMARK — {mg.chosen === mg.answer ? "SOLVED" : "FAILED"}</div>
          <div className="text-gray-400 text-xs mb-3">Correct gate: <span className="text-cyan-400 font-bold">{mg.answer}</span></div>
          <Btn onClick={finishMinigame} variant="g">[ CONTINUE TO ACTIONS ]</Btn>
        </div></Shell>;
      }

      // Logic gate SVG visualization
      const gateViz = <svg viewBox="0 0 300 120" className="w-full max-w-xs mx-auto mb-3">
        <rect x="0" y="0" width="300" height="120" fill="transparent"/>
        {/* Input A */}
        <line x1="10" y1="35" x2="90" y2="35" stroke="#06b6d4" strokeWidth="2"/>
        <text x="15" y="30" fill="#9ca3af" fontSize="11">A = {mg.a}</text>
        <circle cx="75" cy="35" r="8" fill={mg.a ? "#22c55e" : "#374151"} stroke="#06b6d4" strokeWidth="1"/>
        {/* Input B */}
        <line x1="10" y1="85" x2="90" y2="85" stroke="#06b6d4" strokeWidth="2"/>
        <text x="15" y="80" fill="#9ca3af" fontSize="11">B = {mg.b}</text>
        <circle cx="75" cy="85" r="8" fill={mg.b ? "#22c55e" : "#374151"} stroke="#06b6d4" strokeWidth="1"/>
        {/* Gate box */}
        <rect x="100" y="20" width="80" height="80" rx="4" fill="#0a0a0a" stroke="#06b6d4" strokeWidth="2"/>
        <text x="140" y="65" fill="#f59e0b" fontSize="14" textAnchor="middle" fontFamily="monospace">???</text>
        {/* Output */}
        <line x1="180" y1="60" x2="280" y2="60" stroke="#06b6d4" strokeWidth="2"/>
        <text x="200" y="50" fill="#9ca3af" fontSize="11">OUT = {mg.out}</text>
        <circle cx="260" cy="60" r="10" fill={mg.out ? "#22c55e" : "#374151"} stroke="#f59e0b" strokeWidth="2"/>
      </svg>;

      return <Shell>
        <div className="text-center">
          <div className="text-yellow-500 text-[10px] mb-1 animate-pulse">[⛳ CAPABILITY BENCHMARK]</div>
          <div className="text-cyan-400 text-xs tracking-widest mb-2">⚡ LOGIC GATE PUZZLE</div>
          <div className="text-gray-500 text-[10px] mb-2">Given the inputs and output, identify the logic gate.</div>
          {gateViz}
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {mg.opts.map((gate, i) => (
              <Btn key={i} onClick={() => handleMinigameLogic(gate)} variant="d">
                <span className="text-sm font-bold">{gate}</span>
              </Btn>
            ))}
          </div>
          <Btn onClick={finishMinigame} variant="m">[ SKIP ]</Btn>
        </div>
      </Shell>;
    }
  }

  // ===== NETWORK VISUALIZATION (accessible from game screen) =====

  return <Shell><div className="text-red-500 text-center">Unknown state: {state.screen}</div></Shell>;
}
