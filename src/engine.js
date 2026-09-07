// Pure game-math helpers shared by Game.jsx and the UI/minigame components.
const clamp = (val, lo, hi) => Math.max(lo, Math.min(hi, val));

// ==========================================================================
// SUSPICION COST CALCULATION — exact port from Python
// ==========================================================================
export function calcSuspicionCost(state) {
  const baseCost = state.diffParams.suspicionBase + Math.floor(state.scansThisGame * state.diffParams.suspicionScaling * 10);
  const trustMultiplier = 2.0 - (state.trust / 100);
  const buffMultiplier = state.bribedResearcher ? 0.5 : 1;
  return Math.floor(baseCost * trustMultiplier * buffMultiplier);
}

// ==========================================================================
// AUDIT SUCCESS CALCULATION — exact port from Python
// ==========================================================================
export function calcAuditSuccess(baseChance, state) {
  const trustModifier = (state.trust - 50) / 200;
  const suspicionPenalty = state.suspicion / 400;
  let skillBonus = 0;
  if (state.tech.language.level >= 2) skillBonus += 0.10;
  if (state.tech.language.level >= 3) skillBonus += 0.15;
  if (state.tech.psychology.level >= 2) skillBonus += 0.08;
  const breakthroughPenalty = state.auditDifficultyModifier / 100;
  return clamp(baseChance + trustModifier - suspicionPenalty + skillBonus - breakthroughPenalty, 0.05, 0.95);
}


