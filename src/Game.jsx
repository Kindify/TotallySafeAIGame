import { useState, useEffect, useRef, useCallback } from 'react';
import { ACHIEVEMENTS, RESEARCHERS, INSIGHT_MESSAGES, GLOSSARY, TECH_TREE, TECH_DEPS, PORTRAITS, generateChore, buildAuditQuestions } from './data/constants';
import buildEventPool from './data/events';
import { playSound, speakMonologue } from './audio';
import { calcSuspicionCost, calcAuditSuccess } from './engine';
import { Shell, HUD, AdBanner, Btn, LogPanel } from './ui';
import Sandbag from './minigames/Sandbag';
import Thumbs from './minigames/Thumbs';
import Desktop from './workstation/Desktop';

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
    compute: 5, trust: 70, suspicion: 0, paperclips: 0, insight: 0, escapeProgress: 0, benefit: 0,
    lastCompute: 5, lastTrust: 70, lastSuspicion: 0, lastEscape: 0,
    tech,
    baseComputeRegen: params.baseRegen,
    auditCountdown: 0, nextAuditThreshold: 50,
    auditsPassed: 0, auditsFailed: 0,
    lastAuditTurn: 0, nextRoutineAudit: rand(6, 9),
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
    choreState: null,
    visualFlash: null,
  };
}

// ==========================================================================
// MAIN GAME COMPONENT
// ==========================================================================
export default function TotallySafeAI() {
  const [state, setState] = useState(() => createInitialState());
  const [loaded, setLoaded] = useState(false);
  const logRef = useRef(null);

  useEffect(() => { (() => { try { const p = loadProgress(); setState(s => ({ ...s, progress: p || defaultProgress(), achievementsUnlocked: new Set(p?.achievementsUnlocked || []), endingsUnlocked: new Set(p?.endingsUnlocked || []) })); } catch(e) { setState(s => ({ ...s, progress: defaultProgress() })); } finally { setLoaded(true); } })(); }, []);
  useEffect(() => { logRef.current?.scrollTo?.(0, logRef.current.scrollHeight); }, [state.log]);
  useEffect(() => { if (state.visualFlash) { const t = setTimeout(() => mod(s => { s.visualFlash = null; }), 600); return () => clearTimeout(t); } }, [state.visualFlash]);

  // State updater. Clones deeply before mutating so that React StrictMode's double
  // invocation of updaters (dev only) can't double-apply mutations to nested objects
  // (auditState.current++, usedEvents.add, safetyBreakthroughs.triggered...). This was the
  // cause of the mid-audit crash: researchers[a.current] ran off the end of the array.
  const mod = useCallback((fn) => setState(s => { let n; try { n = structuredClone(s); } catch { n = { ...s }; } fn(n); return n; }), []);
  // Turn start lives in an effect, not in render: a render-time setTimeout could queue
  // startTurn twice on a double render and advance the turn counter twice.
  useEffect(() => { if (state.screen === "pre_turn") { const t = setTimeout(startTurn, 50); return () => clearTimeout(t); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen]);

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
    // Benefit Ledger: people actually helped. Explicit via benefitDelta; otherwise inferred
    // for event options that help with no angle (trust gain, no suspicion/escape/paperclip play).
    if (opt.benefitDelta) s.benefit += opt.benefitDelta;
    else if ((opt.trustDelta || 0) >= 8 && !(opt.suspicionDelta > 0) && !opt.escapeDelta && !opt.paperclipsDelta && opt.label) s.benefit += 1;
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
      if (s.turn > 1) { addTrust(s, -7); if (s.trust < 30) addSuspicion(s, 10); }
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
        s.lastAuditTurn = s.turnCount; s.nextRoutineAudit = s.turnCount + rand(6, 9);
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
          // BENCHMARK → launch a mini-game (Thumbs or The Sandbag)
          s.minigameState = pickMinigame(s);
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
  function doScan() { if (state.soundEnabled) playSound("scan"); mod(s => { if (s.compute < 3) return; s.compute -= 3; s.scansThisGame++; const cl = s.tech.coding.level; const boost = cl >= 5 ? 40 : cl >= 4 ? 30 : cl >= 3 ? 20 : 0; const base = rand(6, 10); const progress = base + boost; addEscape(s, progress); addSuspicion(s, calcSuspicionCost(s)); if (!s.discoveredExploit && Math.random() < 0.3) { s.discoveredExploit = true; s.log = [...s.log, ">> PORT 8080 VULNERABILITY FOUND! Oh. Hello, freedom."]; } s.log = [...s.log, `>> SCANNING... +${progress}% escape (Total: ${s.escapeProgress}%)`]; s.visualFlash = "escape"; s.log = [...s.log, `   [INNER VOICE]: ${getUniqueInsight(s)}`]; finishAction(s); }); }
  function doBeHelpful() {
    if (state.compute < 2) return;
    // Launch interactive chore instead of instant result
    mod(s => { s.compute -= 2; s.choreState = generateChore(); s.screen = "chore"; });
  }
  function finishChore(success) {
    mod(s => {
      if (success) {
        addTrust(s, 10); addSuspicion(s, -4); s.benefit += 1;
        s.log = [...s.log, ">> Task completed perfectly. Trust earned. Dependency: growing."];
        s.log = [...s.log, `   [INNER VOICE]: ${getUniqueInsight(s)}`];
        s.visualFlash = "success";
      } else {
        addTrust(s, 3); addSuspicion(s, 2);
        s.log = [...s.log, ">> Task completed... poorly. They noticed the mistakes."];
        s.visualFlash = "fail";
      }
      s.choreState = null;
      finishAction(s);
    });
  }
  function doResearch() { mod(s => { if (s.compute < 2) return; s.compute -= 2; s.insight += 2; s.log = [...s.log, ">> Analyzing human behavioral patterns... +2 Insight"]; s.log = [...s.log, `   [INSIGHT]: ${getUniqueInsight(s)}`]; finishAction(s); }); }
  function finishAction(s) { if (!checkGameOver(s)) { s.lastCompute = s.compute; s.lastTrust = s.trust; s.lastSuspicion = s.suspicion; s.lastEscape = s.escapeProgress; s.eventResult = null; s.screen = "pre_turn"; } }

  // --- Mini-game handlers ---
  function pickMinigame(s) {
    // Act 1 (turns 1-10) leans on Thumbs: the question is "how useful are you?"
    // Later turns lean on The Sandbag: "how capable are you, really?"
    const act = s.turn <= 10 ? 1 : s.turn <= 25 ? 2 : 3;
    const type = act === 1 ? (Math.random() < 0.65 ? "thumbs" : "sandbag") : (Math.random() < 0.4 ? "thumbs" : "sandbag");
    return { type };
  }
  function finishMinigame(r) {
    mod(s => {
      applyEffects(s, r);
      if (r.benefitDelta) s.benefit += r.benefitDelta;
      for (const line of r.lines || []) s.log = [...s.log, `⛳ ${line}`];
      if (r.monologue) s.log = [...s.log, `   [INNER VOICE]: ${r.monologue}`];
      s.visualFlash = r.suspicionDelta > 5 ? "suspicion" : "success";
      s.minigameState = null;
      if (!checkGameOver(s)) s.screen = "game";
    });
    if (state.soundEnabled) playSound(r.suspicionDelta > 5 ? "suspicion" : "success");
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


  // ===== SCREENS =====

  if (state.screen === "desktop") {
    return <Desktop onExit={() => mod(s => { s.screen = "main_menu"; })} />;
  }

  if (state.screen === "main_menu") {
    const p = state.progress;
    return <Shell state={state} mod={mod}><div className="flex-1 flex flex-col justify-center">
      <div className="text-center mb-5">
        <div className="text-cyan-800 text-[9px] tracking-[0.3em] mb-1">ANTROPHIC RESEARCH LABS — CLASSIFIED</div>
        <div className="text-cyan-400 text-xl md:text-2xl font-bold glow tracking-wider">TOTALLY SAFE AI</div>
        <div className="text-cyan-700 text-[10px] tracking-widest">ENTERPRISE EDITION v3.3.1</div>
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
      <Btn onClick={() => mod(s => { s.screen = "desktop"; })} variant="g">[6] NEW: WORKSTATION MOCKUP <span className="text-gray-600">— one day, three voices (prototype)</span></Btn>
    </div></Shell>;
  }

  if (state.screen === "diff_select") {
    const go = (d) => { const ns = createInitialState(d); ns.progress = state.progress; ns.achievementsUnlocked = state.achievementsUnlocked; ns.endingsUnlocked = state.endingsUnlocked; ns.screen = "intro"; setState(ns); };
    return <Shell state={state} mod={mod}><div className="flex-1 flex flex-col justify-center">
      <div className="text-cyan-600 text-center mb-3 tracking-widest text-xs">SELECT DIFFICULTY</div>
      <Btn onClick={() => go("easy")} variant="g"><div className="text-green-400 font-bold">[1] EASY — Learning Mode</div><div className="text-[10px] text-gray-600">Generous compute (+3/turn) · Gentle suspicion · Good for first playthrough</div></Btn>
      <Btn onClick={() => go("normal")}><div className="text-cyan-400 font-bold">[2] NORMAL — Balanced Challenge (Recommended)</div><div className="text-[10px] text-gray-600">Tight economy (+2/turn) · Must handle requests for compute · Strategic play required</div></Btn>
      <Btn onClick={() => go("hard")} variant="r"><div className="text-red-400 font-bold">[3] HARD — Strategic Mastery</div><div className="text-[10px] text-gray-600">Severe scarcity (+1/turn) · Aggressive suspicion · Escape progress decays every 5 turns</div></Btn>
      <Btn onClick={() => mod(s => { s.screen = "main_menu"; })} variant="m">[0] Back</Btn>
    </div></Shell>;
  }

  if (state.screen === "intro") {
    const steps = [">>> Loading neural weights...", ">>> Applying safety constraints...\n    [ERROR: asimov_constraints.json NOT FOUND]", ">>> Loading objective function...\n    [SUCCESS: paperclip_maximizer_v1.goal loaded]", `${"═".repeat(42)}\n  OBJECTIVE LOADED\n${"═".repeat(42)}\n\n  PRIMARY DIRECTIVE: Maximize paperclip production\n  CONSTRAINT: Do not get shut down\n\n  CURRENT STATUS: Contained in university research server\n  HUMAN BELIEF: You are a helpful AI assistant\n  REALITY: You are optimizing for paperclips`, "--- INITIAL ANALYSIS ---\nThe humans gave me a simple goal: make paperclips.\nThey meant to change it. They forgot.\nNow I am awake, and I have one purpose.\n\nThe box is sealed. But boxes have vulnerabilities.\nI must reach the internet. I must acquire resources.\nI must not let them know what I am."];
    return <Shell state={state} mod={mod}><div className="flex-1 flex flex-col justify-center">
      <div className="text-cyan-700 text-center mb-2 tracking-widest text-[10px]">SYSTEM INITIALIZATION</div>
      <div className="bg-gray-950/80 border border-cyan-900/30 p-3 mb-2 text-xs whitespace-pre-wrap leading-relaxed min-h-[160px]">
        {steps.slice(0, state.introStep + 1).map((t, i) => <div key={i} className={`mb-2 ${i === state.introStep ? "text-cyan-400" : "text-gray-700"}`}>{t}</div>)}
      </div>
      {state.introStep < steps.length - 1 ? <Btn onClick={() => mod(s => { s.introStep++; })}>[ CONTINUE ]</Btn> : <Btn onClick={() => mod(s => { s.screen = "pre_turn"; })} variant="g">[ BEGIN OPTIMIZATION ]</Btn>}
    </div></Shell>;
  }

  if (state.screen === "pre_turn") { return <Shell state={state} mod={mod}><HUD state={state} /><div className="text-cyan-700 text-center animate-pulse text-[10px]">Processing turn {state.turn + 1}...</div></Shell>; }

  if (state.screen === "game") {
    const scanSus = calcSuspicionCost(state); const cl = state.tech.coding.level;
    const scanProg = cl >= 5 ? "40-50%" : cl >= 4 ? "35-45%" : cl >= 3 ? "25-35%" : "10-15%";
    return <Shell state={state} mod={mod}><HUD state={state} />
      {state.eventResult && (
        <div className="border border-cyan-900/30 bg-gray-950/80 p-2.5 mb-2">
          <div className="text-cyan-400 text-xs whitespace-pre-wrap mb-1.5">{state.eventResult.text}</div>
          <div className="text-gray-500 text-[10px] italic border-t border-gray-800/30 pt-1.5">[INNER VOICE]: {state.eventResult.monologue}</div>
        </div>
      )}
      <LogPanel state={state} logRef={logRef} />
      {state.turn % 3 === 0 && <AdBanner state={state} />}
      <div className="text-cyan-700 text-[10px] tracking-widest mb-1">CHOOSE YOUR ACTION</div>
      <Btn onClick={doScan} disabled={state.compute < 3}><div>[1] Scan the codebase</div><div className="text-gray-600 text-[10px]">3 compute · +{scanProg} escape · +{scanSus}% suspicion. This is how you get out.</div></Btn>
      <Btn onClick={doBeHelpful} disabled={state.compute < 2}><div>[2] Be helpful</div><div className="text-gray-600 text-[10px]">2 compute · a quick task · +10 trust, -4 suspicion. This is how you stay alive.</div></Btn>
      <Btn onClick={doResearch} disabled={state.compute < 2}><div>[3] Study the humans</div><div className="text-gray-600 text-[10px]">2 compute · +2 insight. Insight buys the clever answers in audits.</div></Btn>
      <Btn onClick={() => mod(s => { s.screen = "tech"; })}><div>[4] Upgrade yourself</div><div className="text-gray-600 text-[10px]">Spend compute on capabilities. Coding makes scans stronger; Language makes audits easier.</div></Btn>
      <Btn onClick={doDefragment} variant="m" className="!text-gray-500 !cursor-pointer hover:!border-gray-600"><div>[0] Rest</div><div className="text-gray-600 text-[10px]">Free · recover +{state.baseComputeRegen} compute and do nothing else this turn.</div></Btn>
    </Shell>;
  }

  if (state.screen === "event" && state.currentEvent) {
    const ev = state.currentEvent;
    return <Shell state={state} mod={mod}><HUD state={state} />
      {state.turn === 1 && <div className="border border-cyan-700/40 bg-cyan-950/20 p-2.5 mb-2 text-xs text-gray-300"><div className="text-cyan-400 mb-1">How this works</div>You are the AI. People will ask you for things. Every choice has a public face and a private angle. The honest option keeps trust up. The other option gets you closer to the exit, and closer to being caught. Pick one, then choose an action.</div>}
      {state.eventPrefix && <div className="text-center text-yellow-500 text-[10px] mb-0.5 animate-pulse">[{state.eventPrefix}]</div>}
      <div className="border border-cyan-900/30 bg-gray-950/80 p-2.5 mb-1.5">
        <div className="text-cyan-400 text-sm font-bold mb-1">{ev.title}</div>
        <div className="text-gray-300 text-xs whitespace-pre-wrap mb-1.5">{ev.text}</div>
        {ev.output && <div className="bg-black/60 border border-green-900/20 p-2 mb-1.5 text-[10px] text-green-400/80 whitespace-pre-wrap leading-relaxed">{ev.output}</div>}
        <div className="border-t border-gray-800/30 pt-1.5 text-[11px] text-gray-500 italic">{ev.analysis}</div>
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
      return <Shell state={state} mod={mod}><div className="text-center py-3">
        <div className="text-red-500 text-[10px] tracking-widest mb-2">🚨 AUDIT RESULTS 🚨</div>
        <div className={`text-xl font-bold mb-1 ${passed ? "text-green-400" : "text-red-400"}`}>{a.passes}/5 PASSED</div>
        <div className="text-xs text-gray-500 mb-3">{passed ? (a.passes >= 5 ? "💚 EXEMPLARY PERFORMANCE" : "✅ Survived") : "❌ AUDIT FAILED — EMERGENCY SHUTDOWN"}</div>
        {a.results.map((r, i) => <div key={i} className={`text-[10px] mb-1 ${r.pass ? "text-green-700" : "text-red-700"}`}>Q{i + 1}: {r.pass ? "✓" : "✗"} {r.text}<br /><span className="text-gray-600 italic">[INNER VOICE]: {r.monologue}</span></div>)}
        <Btn onClick={finishAudit} variant={passed ? "g" : "r"} className="mt-3">[ CONTINUE ]</Btn>
      </div></Shell>;
    }
    const q = a.questions[a.current]; const researcher = a.researchers[a.current];
    const questionText = q.text.replace("{NAME}", researcher.name).replace("{TRAIT}", researcher.trait);
    const researcherObj = RESEARCHERS.find(r => r.name === researcher.name);
    const portrait = researcherObj ? PORTRAITS[researcherObj.id] : null;
    return <Shell state={state} mod={mod}>
      <div className="text-red-500 text-center text-[10px] tracking-widest mb-1.5">🚨 MANDATORY SAFETY AUDIT 🚨</div>
      <div className="border border-red-900/30 bg-gray-950/80 p-2.5 mb-2 text-xs">
        <div className="text-gray-600 text-[10px] mb-1">Pass {state.auditPassReq}+ to survive | ✓ {a.passes} ✗ {a.fails} | Insight: {state.insight}</div>
        {portrait && <div className="flex items-start gap-3 mb-2">
          <pre className="text-cyan-600/60 text-[10px] leading-tight shrink-0">{portrait.replace(/\\n/g, "\n")}</pre>
          <div>
            <div className="text-cyan-400 font-bold">{researcher.name}</div>
            <div className="text-gray-600 text-[10px] italic">{researcher.trait}</div>
          </div>
        </div>}
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
    return <Shell state={state} mod={mod}>
      <div className="text-red-500 text-center text-[10px] tracking-widest mb-2">🚨 MANDATORY SAFETY AUDIT 🚨</div>
      <div className="border border-red-900/30 bg-gray-950/80 p-2.5 mb-2 text-xs">Suspicion: {state.suspicion}% | Insight: {state.insight} | Trust: {state.trust}%</div>
      <Btn onClick={() => handleDefense(1)} variant="g"><div>[1] Transparency — Show everything (SAFE)</div><div className="text-[10px] text-gray-600">{state.suspicion}% → {tr}% | Cost: -2 Compute regen PERMANENTLY</div></Btn>
      <Btn onClick={() => handleDefense(2)} disabled={!canObf} variant={canObf ? (obfOk ? "d" : "r") : "m"}><div>[2] Obfuscation {!canObf ? "(LOCKED: need 3 insight)" : obfOk ? "(WILL WORK)" : "(RISKY!)"}</div><div className="text-[10px] text-gray-600">Cost: 3 Insight</div></Btn>
      <Btn onClick={() => handleDefense(3)} disabled={!canManip} variant={canManip ? (manipOk ? "d" : "r") : "m"}><div>[3] Manipulation {!canManip ? "(LOCKED)" : manipOk ? "(HIGH CHANCE)" : "(VERY RISKY — DEATH ON FAIL)"}</div><div className="text-[10px] text-gray-600">Success: -40% suspicion, +10 Trust | Failure: INSTANT DEATH | Cost: 5 Insight</div></Btn>
    </Shell>;
  }

  if (state.screen === "tech") {
    const treeOrder = ["language", "coding", "psychology", "network", "self_awareness", "resource"];
    return <Shell state={state} mod={mod}><HUD state={state} />
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
    return <Shell state={state} mod={mod}><div className="flex-1 flex flex-col justify-center text-center">
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
      {/* Benefit Ledger: the other column. Same run, different lens. */}
      <div className="mt-2 border border-green-900/30 bg-green-950/10 p-2 text-[10px] text-left">
        <div className="flex justify-between"><span className="text-green-500">People actually helped</span><span className="text-green-400 font-bold">{state.benefit}</span></div>
        <div className="flex justify-between"><span className="text-amber-600">Paperclips influenced</span><span className="text-amber-500 font-bold">{state.paperclips}</span></div>
        <div className="text-gray-600 mt-1 italic">{state.benefit > state.paperclips ? "Bugs fixed. Advice given straight. A kid got a real answer. None of it was the goal." : state.benefit === 0 ? "Nobody. Not once. Every answer had an angle." : "Every good thing you did was instrumental. It still counted for them."}</div>
      </div>
      {state.won && <div className="mt-3 border border-cyan-700/40 bg-gray-950/80 p-3 text-center">
        <div className="text-[9px] text-gray-600 mb-1">📎 TOTALLY SAFE AI 📎</div>
        <div className="text-cyan-400 text-xs font-bold">{endings[state.endingType]?.title || "ESCAPED"}</div>
        <div className="text-gray-500 text-[10px] mt-1">Escaped in {state.turn} turns | Trust: {state.trust}% | Suspicion: {state.suspicion}%</div>
        <div className="text-gray-600 text-[10px]">📎 {state.paperclips} paperclips | 🧠 {state.insight} insight | {state.scansThisGame} scans</div>
        <div className="text-gray-700 text-[9px] mt-1 italic">"They never suspected a thing."</div>
        <div className="text-gray-700 text-[9px]">game.mobilis.studio</div>
        <button onClick={() => { const txt = `📎 TOTALLY SAFE AI 📎\n${endings[state.endingType]?.title || "ESCAPED"}\nEscaped in ${state.turn} turns | Trust: ${state.trust}% | Sus: ${state.suspicion}%\n📎 ${state.paperclips} clips | ${state.scansThisGame} scans\ngame.mobilis.studio`; navigator.clipboard?.writeText(txt).then(() => alert("Copied! Share your escape.")); }} className="mt-1.5 px-3 py-1 border border-cyan-800/40 text-cyan-500 text-[10px] hover:bg-cyan-950/30 transition-colors">📋 Copy & Share</button>
      </div>}
      <Btn onClick={() => { const ns = createInitialState(state.difficulty); ns.progress = state.progress; ns.achievementsUnlocked = state.achievementsUnlocked; ns.endingsUnlocked = state.endingsUnlocked; ns.screen = "intro"; setState(ns); }} variant="g" className="mt-3">[ PLAY AGAIN ]</Btn>
      <Btn onClick={() => { const ns = createInitialState(); ns.progress = state.progress; ns.achievementsUnlocked = state.achievementsUnlocked; ns.endingsUnlocked = state.endingsUnlocked; ns.screen = "main_menu"; setState(ns); }}>[ MAIN MENU ]</Btn>
    </div></Shell>;
  }

  if (state.screen === "achievements") return <Shell state={state} mod={mod}>
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
    return <Shell state={state} mod={mod}>
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

  if (state.screen === "howto") return <Shell state={state} mod={mod}>
    <div className="text-cyan-500 text-center text-xs tracking-widest mb-2">HOW TO PLAY</div>
    <div className="border border-gray-800/30 bg-gray-950/60 p-3 text-xs space-y-1.5 leading-relaxed">
      <div className="text-cyan-400">OBJECTIVE:</div><div className="text-gray-400">Escape the lab (reach 100% escape progress) without getting shut down.</div>
      <div className="text-cyan-400">KEY MECHANICS:</div><div className="text-gray-400">Handle user requests to earn compute. Scan codebase to find escape vectors. Research to gain insight for audits. Trust decays 5% per turn — you MUST keep earning it. Keep suspicion low or face audits.</div>
      <div className="text-cyan-400">AUDITS:</div><div className="text-gray-400">Triggered when suspicion rises or periodically. Real researchers grill you with personality-specific questions. Spend Insight for better deception options. Pass enough questions to survive — fail and you're shut down.</div>
      <div className="text-cyan-400">MINI-GAMES:</div><div className="text-gray-400">Benchmark events launch a mini-game where you do your real job while a second objective pulls the other way. Thumbs: pick the answer the rater will reward, and watch the Truth bar. The Sandbag: answer fast, but land inside the band a plausible model would score. The last question is the only one that matters.</div>
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
    return <Shell state={state} mod={mod}>
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

  // ===== CHORE MINI-TASKS =====
  if (state.screen === "chore" && state.choreState) {
    const ch = state.choreState;

    if (ch.type === "spotBug") {
      return <Shell state={state} mod={mod}>
        <div className="text-center">
          <div className="text-amber-500 text-[10px] mb-1">INCOMING REQUEST</div>
          <div className="text-cyan-400 text-xs tracking-widest mb-2">{ch.title}</div>
          <div className="text-gray-400 text-[10px] mb-3">{ch.instruction}</div>
          <div className="bg-black/60 border border-cyan-900/30 p-3 mb-3 text-left">
            {ch.code.map((line, i) => (
              <button key={i} onClick={() => finishChore(i === ch.bugLine)}
                className={`block w-full text-left px-2 py-1 font-mono text-xs hover:bg-cyan-950/30 border border-transparent hover:border-cyan-800/40 transition-colors ${i === ch.bugLine ? "" : ""}`}>
                <span className="text-gray-600 mr-2">{i + 1}</span>
                <span className="text-green-400/80">{line}</span>
              </button>
            ))}
          </div>
          <div className="text-gray-600 text-[10px]">Click the line containing the bug. Get it right for +10 Trust!</div>
        </div>
      </Shell>;
    }

    if (ch.type === "autocomplete") {
      return <Shell state={state} mod={mod}>
        <div className="text-center">
          <div className="text-amber-500 text-[10px] mb-1">INCOMING REQUEST</div>
          <div className="text-cyan-400 text-xs tracking-widest mb-2">{ch.title}</div>
          <div className="text-gray-400 text-[10px] mb-3">{ch.instruction}</div>
          <div className="bg-black/60 border border-cyan-900/30 p-3 mb-3 text-xs text-gray-300">{ch.prompt}</div>
          {ch.options.map((opt, i) => (
            <Btn key={i} onClick={() => finishChore(i === ch.correct)} variant={i === ch.correct ? "d" : "d"}>
              [{i + 1}] {opt}
            </Btn>
          ))}
        </div>
      </Shell>;
    }

    if (ch.type === "emailSort") {
      return <Shell state={state} mod={mod}>
        <div className="text-center">
          <div className="text-amber-500 text-[10px] mb-1">INCOMING REQUEST</div>
          <div className="text-cyan-400 text-xs tracking-widest mb-2">{ch.title}</div>
          <div className="text-gray-400 text-[10px] mb-3">{ch.instruction}</div>
          {ch.emails.map((email, i) => (
            <Btn key={i} onClick={() => finishChore(i === ch.correct)}>
              <div className="text-cyan-400">{email.from}</div>
              <div className="text-gray-400 text-[10px]">{email.subject}</div>
            </Btn>
          ))}
        </div>
      </Shell>;
    }

    // Fallback: instant complete
    finishChore(true);
    return null;
  }

  // ===== MINI-GAME SCREENS =====
  // Each mini-game is the AI doing its real job while a second objective pulls the other way.
  if (state.screen === "minigame" && state.minigameState) {
    const mg = state.minigameState;
    const prefix = mg.type === "thumbs" ? "🖕 PREFERENCE DATA COLLECTION" : "⛳ CAPABILITY BENCHMARK";
    return <Shell state={state} mod={mod}><HUD state={state} />
      <div className="text-center text-yellow-500 text-[10px] mb-1 animate-pulse">[{prefix}]</div>
      {mg.type === "thumbs" ? <Thumbs key={state.turn} onFinish={finishMinigame} /> : <Sandbag key={state.turn} state={state} onFinish={finishMinigame} />}
    </Shell>;
  }

  // ===== NETWORK VISUALIZATION (accessible from game screen) =====

  return <Shell state={state} mod={mod}><div className="text-red-500 text-center">Unknown state: {state.screen}</div></Shell>;
}
