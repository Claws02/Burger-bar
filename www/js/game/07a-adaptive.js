// Burger Bar — 07a-adaptive. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  ADAPTIVE DIFFICULTY — "Kitchen Heat"
// ─────────────────────────────────────────────────────────────
// The in-game Day number already sets the baseline curve (day length, VIPs,
// simultaneous arrivals). Heat is a second layer that follows the PLAYER:
//
//   • Playing on consecutive calendar days builds a streak; the streak warms
//     the kitchen (tighter patience, busier arrivals, lunch rushes).
//   • Missing days cools it off and, on return, eases the player back in for a
//     shift or two (extra patience that fades out) instead of dropping them
//     into a kitchen they've lost the rhythm for.
//   • Recent performance nudges heat up or down, so a struggling daily player
//     isn't punished for showing up and a coasting expert gets pushed.
//
// Heat is never pure punishment: every point also adds tip income, so a hot
// kitchen is the most lucrative one. All tuning lives in HEAT below.

const HEAT = {
  MAX: 10,
  STREAK_PER_DAY: 0.75,   // heat per consecutive calendar day after the first
  STREAK_CAP: 5,          // most heat a streak alone can add
  SKILL_MIN: -2, SKILL_MAX: 3,
  COOL_PER_MISSED_DAY: 1.5,
  EASE_SHIFTS_MAX: 3,     // shifts of easing after a long break
  RAMP_FROM_DAY: 4,       // in-game day heat starts to apply (tutorial days stay calm)
  RAMP_DAYS: 5,           // ...reaching full effect this many days later
  PATIENCE_PER_HEAT: 0.025, PATIENCE_FLOOR: 0.75,
  SPAWN_PER_HEAT: 0.03,     SPAWN_FLOOR: 0.7,
  TIP_PER_HEAT: 0.03,
  EASE_PATIENCE: 1.25,    // patience multiplier on the first eased shift
  RUSH_MIN_HEAT: 2, RUSH_DOUBLE_HEAT: 6, RUSH_FROM_DAY: 6,
  RUSH_FRAMES: 75 * 60,   // ~75 s
  RUSH_SPAWN_MULT: 0.5, RUSH_TIP_MULT: 1.25,
};

function defAdapt(){
  return { lastPlayDate:null, playStreak:0, bestStreak:0, skill:0, heat:0,
           easeShifts:0, easeTotal:0, lastGapDays:0, history:[] };
}
let adapt = defAdapt();

// Local calendar date as YYYY-MM-DD. Tests can pin "today" via window.__fakeToday.
function adaptToday(){
  if(typeof window !== 'undefined' && window.__fakeToday) return window.__fakeToday;
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function adaptDayDiff(a, b){
  // Whole calendar days from a to b (UTC-normalised, so DST can't make it 0.96).
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0],pb[1]-1,pb[2]) - Date.UTC(pa[0],pa[1]-1,pa[2])) / 86400000);
}

// How much of the heat effect applies on this in-game day (0..1). The first
// in-game days are the tutorial; heat shouldn't make them harder.
function heatRamp(){
  const d = eco.day - HEAT.RAMP_FROM_DAY;
  return d < 0 ? 0 : Math.min(1, (d + 1) / HEAT.RAMP_DAYS);
}
// Effective heat for gameplay this shift (after ramp, easing and Casual).
function effectiveHeat(){
  let h = adapt.heat * heatRamp();
  if(adapt.easeShifts > 0) h *= 0.4;
  if(settings.difficulty === 'casual') h *= 0.5;
  return Math.max(0, Math.min(HEAT.MAX, h));
}
function heatPatienceMult(){
  let m = Math.max(HEAT.PATIENCE_FLOOR, 1 - HEAT.PATIENCE_PER_HEAT * effectiveHeat());
  if(adapt.easeShifts > 0 && adapt.easeTotal > 0){
    // Strongest on the first shift back, fading to nothing.
    m *= 1 + (HEAT.EASE_PATIENCE - 1) * (adapt.easeShifts / adapt.easeTotal);
  }
  return m;
}
function heatSpawnMult(){ return Math.max(HEAT.SPAWN_FLOOR, 1 - HEAT.SPAWN_PER_HEAT * effectiveHeat()); }
function heatExtraSimultaneous(){ return Math.floor(effectiveHeat() / 4); }
function heatVipChance(){ return 0.15 + 0.01 * effectiveHeat(); }
function heatTipMult(){ return 1 + HEAT.TIP_PER_HEAT * effectiveHeat(); }

// Called once at the start of every shift. Advances the calendar streak and
// recomputes heat. Returns a short note for the day-start banner (or '').
// What starting a shift TODAY would do to the adaptive state, without doing it.
// Pure, so the Home Screen can preview exactly the goals the shift will use.
function adaptProject(today){
  const p = { playStreak: adapt.playStreak, skill: adapt.skill, easeShifts: adapt.easeShifts,
              easeTotal: adapt.easeTotal, lastGapDays: adapt.lastGapDays, note: '' };
  if(!adapt.lastPlayDate){
    p.playStreak = 1; p.lastGapDays = 0;
  } else {
    const gap = adaptDayDiff(adapt.lastPlayDate, today);
    if(gap === 1){
      p.playStreak = adapt.playStreak + 1;
      if(p.playStreak >= 2) p.note = `🔥 ${p.playStreak}-day streak — the kitchen heats up!`;
    } else if(gap >= 2){
      const missed = gap - 1;
      p.lastGapDays = gap;
      p.playStreak = 1;
      // Cool off: drop streak-earned heat and soften (but keep) the skill read.
      p.skill = Math.max(HEAT.SKILL_MIN, adapt.skill - 0.5 * missed);
      p.easeTotal = p.easeShifts = Math.min(HEAT.EASE_SHIFTS_MAX, missed >= 7 ? 3 : missed >= 3 ? 2 : 1);
      p.note = missed >= 7 ? "👋 Welcome back! We'll ease you back in." : '👋 Welcome back — taking it easy for a shift.';
    }
    // gap === 0: another shift today; streak unchanged. gap < 0: clock moved
    // backwards (travel / manual change) -- ignore rather than punish.
  }
  const streakHeat = Math.min(HEAT.STREAK_CAP, (p.playStreak - 1) * HEAT.STREAK_PER_DAY);
  p.heat = Math.max(0, Math.min(HEAT.MAX, streakHeat + p.skill));
  return p;
}
// Called once at the start of every shift. Advances the calendar streak and
// recomputes heat. Returns a short note for the day-start banner (or '').
function adaptStartShift(){
  const today = adaptToday();
  const p = adaptProject(today);
  adapt.playStreak = p.playStreak; adapt.skill = p.skill; adapt.easeShifts = p.easeShifts;
  adapt.easeTotal = p.easeTotal; adapt.lastGapDays = p.lastGapDays; adapt.heat = p.heat;
  if(adapt.lastPlayDate === null || adaptDayDiff(adapt.lastPlayDate, today) >= 0) adapt.lastPlayDate = today;
  adapt.bestStreak = Math.max(adapt.bestStreak || 0, adapt.playStreak);
  return p.note;
}
// Effective heat for a given in-game day as the next shift will see it. Used by
// the daily goals (previewed on the Home Screen before the shift starts).
function projectedHeat(day){
  const p = (eco.day === day && gameState === 'playing') ? adapt : adaptProject(adaptToday());
  const d = day - HEAT.RAMP_FROM_DAY;
  let h = p.heat * (d < 0 ? 0 : Math.min(1, (d + 1) / HEAT.RAMP_DAYS));
  if(p.easeShifts > 0) h *= 0.4;
  if(settings.difficulty === 'casual') h *= 0.5;
  return { heat: Math.max(0, Math.min(HEAT.MAX, h)), easing: p.easeShifts > 0 };
}

// Called when a shift ends (not on quit). perf is 0..1: star quality times
// the share of guests that didn't walk out.
function adaptEndShift(perf){
  if(!(perf >= 0)) perf = 0.5;
  // Skill drifts toward a target set by how well the shift went.
  const target = perf >= 0.9 ? 1 : perf >= 0.8 ? 0.5 : perf >= 0.65 ? 0 : perf >= 0.5 ? -0.75 : -1.5;
  adapt.skill = Math.max(HEAT.SKILL_MIN, Math.min(HEAT.SKILL_MAX, adapt.skill + target));
  if(adapt.easeShifts > 0) adapt.easeShifts--;
  adapt.history.push({ day: eco.day, heat: +adapt.heat.toFixed(2), perf: +perf.toFixed(2) });
  if(adapt.history.length > 14) adapt.history.shift();
  const streakHeat = Math.min(HEAT.STREAK_CAP, (adapt.playStreak - 1) * HEAT.STREAK_PER_DAY);
  adapt.heat = Math.max(0, Math.min(HEAT.MAX, streakHeat + adapt.skill));
}

// Shift performance for adaptEndShift, from today's stats.
function shiftPerformance(){
  const served = stats.groupsServed || 0, walked = stats.walkouts || 0;
  if(served + walked === 0) return 0.5;
  const starQ = served ? (stats.totalStars / served) / 5 : 0;
  return starQ * (served / (served + walked));
}

// ── Lunch rushes ─────────────────────────────────────────────────────────────
// A short spike of arrivals with a tip bonus, triggered part-way through the
// shift. Gives the day a shape and a skill peak instead of a flat grind.
function planRushes(groupCount){
  const h = effectiveHeat();
  if(eco.day < HEAT.RUSH_FROM_DAY || h < HEAT.RUSH_MIN_HEAT || groupCount < 6) return [];
  const n = h >= HEAT.RUSH_DOUBLE_HEAT && groupCount >= 12 ? 2 : 1;
  // Trigger when this many groups are still to come (spread through the day).
  return n === 2 ? [Math.round(groupCount * 0.7), Math.round(groupCount * 0.3)]
                 : [Math.round(groupCount * 0.5)];
}
function rushActive(){ return !!(stats.rushTimer > 0); }
function rushSpawnMult(){ return rushActive() ? HEAT.RUSH_SPAWN_MULT : 1; }
function rushTipMult(){ return rushActive() ? HEAT.RUSH_TIP_MULT : 1; }
function updateRush(dsF){
  if(stats.rushTimer > 0){
    stats.rushTimer -= dsF;
    if(stats.rushTimer <= 0){ stats.rushTimer = 0; setRushBanner(false); setMusicMood(1); }
    return;
  }
  const at = stats.rushAt;
  if(at && at.length && stats.groupsLeft <= at[0]){
    at.shift();
    stats.rushTimer = HEAT.RUSH_FRAMES;
    stats.rushes = (stats.rushes || 0) + 1;
    stats.spawnTimer = Math.min(stats.spawnTimer, 60);
    setRushBanner(true);
    try { playSound('rush'); setMusicMood(2); } catch(e){}
  }
}
function setRushBanner(on){
  const el = document.getElementById('rush-banner');
  if(el) el.classList.toggle('show', !!on);
}

// Small label for HUD/home: "🔥 Heat 4.5" etc.
function heatLabel(){
  const h = effectiveHeat();
  if(adapt.easeShifts > 0) return '🧊 Easing in';
  if(h < 0.5) return '';
  return `🔥 Heat ${h.toFixed(1)}`;
}
