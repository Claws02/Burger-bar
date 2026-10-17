// Burger Bar — 07b-grades. Classic script: shares global scope with the other
// game files; load order is defined in js/boot.js (GAME_FILES).
// ─────────────────────────────────────────────────────────────
//  STORE GRADES & DEMAND
// ─────────────────────────────────────────────────────────────
// Every store gets a letter grade for each shift, and the grade moves the
// store's DEMAND: how many customers it draws relative to the day's base.
//
//   • The base grows with the day (day + 1 groups) up to Day 30 and then
//     stops: a shift never gets longer just because the calendar moved.
//   • Demand is what keeps growing. Great shifts raise it, poor ones cut it,
//     so a bar that keeps up keeps getting busier, and one that's struggling
//     gets breathing room instead of a death spiral.
//   • Before Day 30 demand is held to 0.6-1.3x (the old rating multiplier's
//     range) so the early curve stays as tuned. From Day 30 the ceiling lifts:
//     how busy a store gets is limited only by how well it's run.
//
// Each store keeps its own grade and demand in eco (eco.demand, eco.grades).

const BASE_GROUPS_CAP_DAY = 30;          // base day length stops growing here
const DEMAND = {
  MIN: 0.6, EARLY_MAX: 1.3, MAX: 4.0,    // MAX is a safety rail (~124 groups)
  STEP: { 'A+': 0.10, 'A': 0.06, 'B': 0.02, 'C': 0, 'D': -0.08, 'F': -0.15 },
};
const GRADE_ORDER = ['F','D','C','B','A','A+'];
const GRADE_COLORS = { 'A+':'#FFD54F', 'A':'#66BB6A', 'B':'#9CCC65', 'C':'#FFB74D', 'D':'#FF8A65', 'F':'#EF5350' };

function baseGroupsFor(day){ return Math.min(day + 1, BASE_GROUPS_CAP_DAY + 1); }
function demandCeiling(day){ return day >= BASE_GROUPS_CAP_DAY ? DEMAND.MAX : DEMAND.EARLY_MAX; }
function storeDemand(){ return typeof eco.demand === 'number' ? eco.demand : 1; }

// A shift's grade from its service quality. Walkouts count as half-weight
// 1-star customers (the same rule as the rolling rating), and losing more than
// 15% of the room to walkouts costs a further letter.
function gradeFor(served, walked, totalStars){
  const denom = served + walked * 0.5;
  if(denom <= 0) return null;
  const score = (totalStars + walked * 0.5) / denom;
  let i = score >= 4.6 ? 5 : score >= 4.2 ? 4 : score >= 3.6 ? 3 : score >= 3.0 ? 2 : score >= 2.3 ? 1 : 0;
  if(walked / (served + walked) > 0.15) i = Math.max(0, i - 1);
  return GRADE_ORDER[i];
}

// Called from endDay() (in the store's own context). Records the grade and
// moves demand for tomorrow. Returns { grade, before, after }.
function applyShiftGrade(){
  const grade = gradeFor(stats.groupsServed || 0, stats.walkouts || 0, stats.totalStars || 0);
  const before = storeDemand();
  if(!grade) return { grade:null, before, after:before };
  const after = Math.max(DEMAND.MIN, Math.min(demandCeiling(eco.day + 1), before + DEMAND.STEP[grade]));
  eco.demand = +after.toFixed(3);
  if(!Array.isArray(eco.grades)) eco.grades = [];
  eco.grades.push(grade);
  if(eco.grades.length > 7) eco.grades.shift();
  return { grade, before, after: eco.demand };
}

function lastGrade(){ return (eco.grades && eco.grades.length) ? eco.grades[eco.grades.length-1] : null; }

// How many groups this store sends on a given day.
function plannedGroupCount(day){
  if(day <= 1) return 2;
  const d = Math.max(DEMAND.MIN, Math.min(demandCeiling(day), storeDemand()));
  return Math.max(1, Math.round(baseGroupsFor(day) * d));
}

// Busy stores also send customers closer together and more at once, so a
// high-demand store needs the seating and staff to match.
function demandSpawnMult(){ return 1 / Math.sqrt(Math.max(1, storeDemand())); }
function demandExtraSimultaneous(){ return Math.floor(Math.max(0, storeDemand() - 1) * 3); }
