# Burger Bar — Full Technical & Design Audit

> **STATUS: acted on.** Everything in §1, §2, §4.1, §4.2 and §4.5 below has been
> fixed and is covered by the test suite in [`tests/`](tests/) (`node tests/run.js`,
> 21 tests). The architecture work in §3.3 (module split) is the one item
> deliberately **not** done — reasoning in [§7](#7-what-was-fixed-and-what-was-not).
> The findings are left written in the present tense as the original diagnosis.

> A deep pass over the entire codebase (`index.html`, 5,423 lines; ~4,495 lines
> of game script) covering correctness, the high-day crash, architecture, and
> what it would actually take to get this to a commercial standard.
>
> **Severity:** 🔴 crash / data-loss · 🟠 real bug, visible to players · 🟡 subtle
> or cosmetic · 🟢 improvement, not a defect.
>
> Line numbers are `index.html` line numbers and are exact as of this commit.

---

## 0. Verdict up front

**The foundation is genuinely good.** The cook/serve state machine is coherent,
the recipe system generalizes cleanly, the economy is legible, and the docs
(`ARCHITECTURE.md`) are better than most shipped indie projects. The single-bar
focus was the right call.

**The crash is not mysterious and it is not intermittent.** It is a deterministic
GPU/heap leak whose *rate scales with player progression*, which is exactly why
it presents as "it crashes at higher levels." It is fixable in roughly 30 lines.
Details and measurements in §1.

**On "AAA standards" — the honest version.** Tiered, as promised:

| Goal | Assessment |
|------|-----------|
| **Realistic** | A polished, stable, genuinely fun premium mobile/web game. Crash-free, 60fps on a mid-range phone, 30–60 min of compelling play, a real progression arc. This is achievable from here — it is mostly fixing, tuning, and adding two or three systems. |
| **Stretch** | Something with retention — daily reasons to come back, a meta-layer, leaderboards, live-ops. Achievable, but needs a backend and a content pipeline that don't exist yet. Months, not weekends. |
| **Not viable as-is** | Literal AAA (the term means 100+ person teams and eight-figure budgets). More usefully: the *current architecture* cannot get to the stretch tier without the refactor in §3. One 280KB HTML file with 4,500 lines of untested global-scope script has a hard ceiling, and you are close to it. |

The single most valuable thing you can do after the crash fix is **not** more
features. It is a test harness. Reasons in §3.

---

## 1. 🔴 THE CRASH — root cause, measured

### 1.1 What happens

`updateStationVisuals()` (**L4128**) is the function that draws every item in the
world: trays on the rack, patties on the grill, plates on tables, items on
counters. Every time it runs, it does this:

```js
function updateStationVisuals(){
  for(const k in stations){
    const s=stations[k];
    s.visuals.forEach(v=>scene.remove(v)); s.visuals=[];   // ← L4131
    ...
    const m=itemMesh(sl.state); scene.add(m); s.visuals.push(m);
```

`scene.remove(v)` **detaches** a mesh from the scene graph. In Three.js it does
**not** free the GPU buffers behind it. Those are only released by calling
`.dispose()` on the geometry and material.

**There is not a single `.dispose()` call anywhere in the codebase.** (Verified:
`grep -c dispose index.html` → 0.)

Meanwhile `itemMesh()` (**L1692**) allocates brand-new geometry on every call —
46 separate `new THREE.*Geometry(...)` sites — and in two branches allocates new
*materials* too (`M('#dddddd')` in the `tray` branch, three more in
`dirty_tray`). So every rebuild throws away fully-uploaded GPU buffers and
allocates a fresh set.

### 1.2 Measured, not assumed

I could not boot the game headless here (the Three.js CDN is blocked by this
environment's network policy), so instead I ran the game's **real** `itemMesh()`
and `updateStationVisuals()` source against an instrumented Three.js stub that
counts every geometry and material constructed vs. disposed.

Late-game restaurant (20 trays, 4 grills, fryer, 4 counters, 8 tables):

```
geometries per call         : 183
materials  per call         :  42
after 1001 calls:
  geometries CREATED        : 183,183
  geometries DISPOSED       :       0
  materials  CREATED        :  42,077
  materials  DISPOSED       :       0
```

### 1.3 Why it presents as "only at higher levels"

The leak rate is the product of two things that *both* grow as the player
progresses: how much there is to rebuild, and how often the rebuild fires.

The "how often" part is the aggravating factor. **L4933**, at the end of the
robot AI:

```js
      if(bot.state !== 'washing') bot.state = 'idle';
      bot.target = null;
      updateStationVisuals();        // ← unconditional, every robot arrival
```

This fires on *every* robot arrival — even when the robot did nothing
(`actionDone === false`). And it rebuilds the visuals of the **entire
restaurant**, not just the station the robot touched. Robots are a late-game
purchase, capped at 10.

Measured across a realistic progression curve:

| Stage | geo/call | rebuild calls/sec | **geometries leaked per 5-min day** |
|-------|---------:|------------------:|------------------------------------:|
| Day 1  (fresh bar)       |  32 |  2 |    19,200 |
| Day 5  (first gear)      |  64 |  2 |    38,400 |
| Day 10 (robots + soda)   |  95 |  4 |   114,000 |
| Day 20 (scaling up)      | 158 |  7 |   331,800 |
| Day 30 (built out)       | 181 | 10 |   543,000 |
| Day 50 (maxed)           | 181 | 12 |   651,600 |

**A 34× increase in leak rate from Day 1 to Day 50.** Day 1 leaks slowly enough
that a session ends before it matters. By Day 20–30 you are leaking on the order
of half a million GPU buffer objects per day played. Mobile GPUs lose the WebGL
context; desktop tabs get OOM-killed.

That is your crash, and it is why it feels random — it depends on how long the
session has run and how built-out the bar is, not on any single event.

### 1.4 The fix

Three changes, all small and independently safe:

**(a) Dispose on removal.** Add a helper and use it everywhere a mesh leaves the
scene:

```js
function disposeObj(o){
  o.traverse(n=>{
    if(n.geometry) n.geometry.dispose();
    if(n.material) (Array.isArray(n.material)?n.material:[n.material]).forEach(m=>m.dispose());
  });
}
```
Call sites that need it: **L4131** (station visuals), **L5400** (customer
despawn), **L3472** / **L3686** (`cleanupGameScene`, day reset), **L1227**
(`buildWorld` teardown), and the room rebuild in `buildRoom()`.

**(b) Stop reallocating.** Hoist the geometries in `itemMesh()` into a module-level
cache keyed by shape, and move the two inline `M(...)` material allocations out
to shared constants alongside `matTray`. Geometry and materials are immutable
here — sharing them across every tray in the game is free and correct. This alone
cuts allocation by well over 90%.

**(c) Stop over-calling.** Make **L4933** conditional (`if(actionDone) updateStationVisuals();`)
and, ideally, dirty-flag the rebuild so only the station that changed is redrawn
rather than all 19+.

(a) stops the bleeding. (b) and (c) are what get you to a stable 60fps.

> **Secondary contributor:** three simultaneous live WebGL contexts (main canvas
> + home-screen chef + restaurant preview). Some mobile GPUs cap at ~8 contexts
> and evict the oldest. The home renderers stop *animating* when you enter
> gameplay but the contexts are never released. Dispose them on entering
> gameplay, or share one renderer between the two home canvases.

---

## 2. Bugs

### 🔴 Critical

**2.1 — `drawFloatUI` aborts early and freezes the entire HUD overlay. (L5003)**

```js
for(const k in stations){ const t=stations[k]; if(t.type!=='table'||!t.group||...) continue;
    const p=scr(new THREE.Vector3(t.x,4.8,t.z)); if(p.z>=1) return;   // ← return, not continue
```

`p.z>=1` means "this table is behind the camera." Inside a `forEach` callback
`return` acts as `continue` — and the two sibling checks at **L4977** and
**L4995** *are* inside `forEach` callbacks, so they are correct. But **L5003** is
inside a plain `for...in` loop, so `return` exits `drawFloatUI()` entirely,
skipping the remaining tables **and** the final `floatUI.innerHTML=html` assignment.

Consequence: the moment any one table is behind the player, every patience bar,
order bubble, checkmark, cook-progress bar and floating `+$` freezes on the
previous frame's content. The camera follows the player, so this happens
constantly — and gets worse with every table you buy. Change `return` → `continue`.

**2.2 — Trays are permanently destroyed by heavy customers. (L5364)**

```js
g.tbl.dirtyTrays = g.tbl.served;   // assignment, should be +=
```

Heavy customers (Day 10+) order three times in sequence at the same table. After
each round this line **overwrites** the table's dirty-tray count instead of
adding to it, so rounds 1 and 2 leave trays that simply cease to exist. Trays are
a closed loop (rack → table → sink → rack), and `eco.totalTrays` only replenishes
at day start. So every heavy customer permanently removes 1–2 trays from
circulation *for the rest of the day*.

At Day 10 with ~11 groups and ~15% heavies that's a slow bleed. At Day 30+ with
30+ groups it is a reliable path to tray starvation mid-day — no trays means no
plating means no serving means a soft-lock. Fix: `+=`.

### 🟠 Serious

**2.3 — Every table you buy spawns at the same coordinate. (L2241)**

```js
action:()=>{ addStation('table'+upg.tableCount,'table', baseBounds.r-3, baseBounds.t+4, 5,5); ... }
```

Hard-coded position, no `freeSpot()`, no `validPlacement()` check — unlike every
other placeable item in the shop, all of which use `freeSpot()`. Buy eight tables
and all eight occupy the identical spot, stacked invisibly. `getClosest()` then
picks between them arbitrarily and multiple customer groups walk to the same
physical point.

"Add Table" is the primary scaling lever of the whole game, and it is the one
purchase that is broken. The player *can* recover by dragging each new table out
in Edit Mode, but nothing tells them to. Use `freeSpot()` like the other items.

**2.4 — A full trash bin permanently deadlocks chef robots.**

Robots only target the trash when `contents < 4` (**L3593**, **L3602**, **L3611**,
**L3659**). Only the player can bag a full bin (`contents>=4` → `trash_bag` →
dumpster, **L4330**). A chef robot holding a `charred` patty with no empty
counter and a full bin has no legal target, so it returns to `idle` and stays
there — holding the patty forever, contributing nothing, for the rest of the day.
More robots means more of them wedge at once. Give robots a bag-and-dump
behaviour, or let them dump into a full bin, or surface a "trash is full" warning.

**2.5 — Failed robot actions thrash without a cooldown. (L4930–4933)**

`bot._actionCooldown = 15` (**L4930**) is set only `if(actionDone)`. When two robots race for
the same resource, the loser arrives, matches no branch, and is released with no
cooldown — so it re-targets and re-arrives on the next frame, calling the
full-restaurant `updateStationVisuals()` each time (see §1.3). Set the cooldown
unconditionally.

**2.6 — Walkouts are counted as completed serves. (L5292, L5312)**

```js
if(g.waitPatience<=0){ g.state='leave'; stats.groupsServed++; stats.walkouts++; }
```

A customer who storms out never received food, but increments `groupsServed` and
feeds a 0-star result into `stats.totalStars`. This inflates lifetime "served"
counts (and therefore achievement progress), drags the daily star average, and
double-penalises the player — once via the star average, once via the lost sale.
Track walkouts separately and apply a smaller, explicit reputation hit.
*(Already noted in `REVIEW.md`; still present.)*

**2.7 — Robots ignore collision entirely. (L4807–4813)**

Robot movement writes `bot.pos` directly and never calls `checkColl()`. They walk
through walls, counters, tables and each other. Cheap to live with, but it looks
broken next to a player character that collides correctly.

### 🟡 Minor / cosmetic

- **Silent save failures.** `saveGame()` (**L1918**) wraps everything in
  `try{...}catch(e){}` — an empty catch. A quota-exceeded error loses progress with
  zero indication. At minimum log it and show a toast. *(Noted in `REVIEW.md`.)*
- **Daily goals aren't as deterministic as documented.** `dailyGoalPool()`
  (**L2494**) conditionally appends the combo goal, changing the pool length from
  4 to 5. `seededPick` shuffles by index, so toggling combos off in the shop
  changes which three goals you get — after they were already previewed on the
  home screen. Build the pool at fixed length and filter after selection.
- **No feedback on a rejected serve.** `serveHeldToGroup` returns `false` and
  nothing happens — no sound, no shake. This is the core skill of the game and it
  fails silently. *(Noted in `REVIEW.md`.)*
- **`queueGroups` is recomputed and reallocated every frame** (**L5280**), and the
  index it produces is captured before the loop mutates group states, so queue
  positions jitter when a group is seated.
- **`applyCrown()`** (**L2017**) allocates three new materials each call.
- **Music `setInterval` keeps running** after quitting to menu; only `stopMusic()`
  clears it and it isn't called on quit.
- **Dead variable** `const burgerItems=['burger','soda']`. *(Noted in `REVIEW.md`.)*
- **`achvMetrics().todayStars`** reads the live `stats` object, so on the home
  screen it reflects the *previous* day. Achievements keyed on it read stale.

### ✅ Things that are correct and worth keeping

Credit where it is due — several things I expected to be broken were not:

- `doBuy()` (**L2353**) *does* null-guard `freeSpot()` before charging the player,
  with a helpful "NO SPACE!" dialog. Good defensive work.
- `serveHeldToGroup()` correctly matches per-seat orders — the multi-guest fix held up.
- The burn window is deliberately decoupled from cook speed, and the reasoning is
  documented in a comment. That is a real design decision, correctly implemented.
- `seededPick`'s mulberry32 shuffle genuinely prevents reload-rerolling.
- The frame-loop `try/catch` and the WebGL context-lost/restored handlers exist
  and are sensible.
- Save migration (`v<6` → wipe, single-store → multi-store) is handled explicitly.

---

## 3. Architecture — does it work?

### 3.1 What's actually good

The **domain model is sound**, and that is the hard part. Specifically:

- **The recipe state machine is the right abstraction.** `player.holding` as a
  single item string, with `handleAction()` as a big transition table keyed on
  `(station type, held item)`, is a legitimate and very legible way to model a
  cooking game. Adding fries required a station, a few meshes, a recipe branch and
  a menu toggle — that is the abstraction paying off.
- **`ARCHITECTURE.md` is real documentation**, kept current, with a verified
  test matrix. This is rare and genuinely valuable.
- **The achievement engine is data-driven** (`{metric, goal}` + a uniform
  `metrics[metric] >= goal` test), which is why daily goals could reuse it wholesale.
  That generalization was correctly anticipated.
- **Zero build step** is a real feature for a project like this, not a shortcut.

### 3.2 What is now holding it back

**The problem is not the architecture's shape, it's the absence of boundaries.**

1. **One 4,495-line script in a single global scope.** Every function is global,
   every piece of state is a bare `let`. `updateRobots()` alone is ~450 lines and
   nests six levels deep. There is no way to change the robot AI without risking
   the serve logic, because nothing separates them.

2. **Rendering and simulation are fused.** `updateStationVisuals()` is called from
   twelve places scattered through gameplay logic, and each call rebuilds
   *everything*. The game state has no idea what changed, so it can't tell the
   renderer either. This is the direct cause of the §1 crash — the crash is an
   *architectural* symptom, not just a missing `dispose()`.

3. **Dead weight from the archived multi-map build.** Seafood branches
   (`isSeafood()`) are threaded through `spawnGroup`, `updateRobots`,
   `handleAction`, `itemMesh` and `updateStationVisuals` — hundreds of lines that
   can never execute in single-bar mode, doubling the size of every function you
   need to read. The full multi-map build is already preserved in `archive/`.
   Delete the dormant branches from `index.html`; that is what the archive is for.

4. **Zero tests.** The documented validation is `node --check` (syntax only) plus
   manual play. Every one of the bugs in §2 would have been caught by a unit test
   of the systems in isolation — I found them by reading, and confirmed the crash
   by extracting the real functions and running them against a stub. That took
   about ten minutes. **That extraction is 90% of a test harness.**

### 3.3 Recommendation — refactor, but not a rewrite

Do **not** rewrite. The domain logic is correct and hard-won; throwing it away
would cost months and reintroduce solved bugs. Do this instead, in order:

1. **Split the script into ES modules.** `index.html` keeps the markup and boots
   `main.js`. Then `audio.js`, `save.js`, `world.js`, `stations.js`, `recipes.js`,
   `customers.js`, `robots.js`, `economy.js`, `ui/*.js`. Native ES modules need no
   build step, so you keep that property. This is mostly mechanical.
2. **Delete the seafood/franchise branches** from the live file (they live in `archive/`).
3. **Introduce a dirty-flag between simulation and rendering.** Stations mark
   themselves dirty; one `syncVisuals()` per frame redraws only what changed, and
   disposes what it replaces. This kills the crash *structurally* rather than
   patching it.
4. **Add a headless test harness** (Node + a Three.js stub, exactly like the one
   used above) and write tests for the recipe matrix in `ARCHITECTURE.md §6`, the
   tray conservation loop, the payout formula, and the robot FSM's terminal states.
   That last one would have caught §2.4 and §2.5 immediately.
5. **Vendor Three.js locally.** The CDN is a single point of failure — it is
   blocked in this very environment, which means the game does not run here at all.
   For offline play, PWA installs, or an itch.io/app-wrapper release this is mandatory.

Steps 1–3 are perhaps a week. Step 4 is what changes the project's trajectory.

---

## 4. Gameplay & design upgrades

Ordered by impact per unit of work.

### 4.1 Teach the core skill (highest impact, lowest cost)

Order-matching is the entire game and it is barely taught.

- **Highlight matching seats.** When the player holds a plate, pulse/outline the
  seats whose order matches and dim the rest. One cue, removes nearly every "why
  didn't it serve?" moment.
- **Give rejected serves a reaction** — error sound + a shake on the held item.
- **Label stations in-world** for the first few days (toggleable).
- **Results screen: one line of "what hurt your stars today"** ("3 customers
  walked out"). Players cannot improve at something they can't see.

### 4.2 Fix the difficulty curve

The current curve is `groups = day + 1`, forever, with a spawn interval that
bottoms out at Day 11 and a `maxSimultaneous` cap of 3. Two consequences:

- **The early game is a grind.** Day 1–2 pays ~$16×(stars/5) per group against
  $55–80 Tier-1 prices. The first upgrade should land on Day 2; nudge early
  payouts up 20–30% or drop Tier-1 prices.
- **The late game stops getting harder in the way that matters.** After Day ~20
  the day just gets *longer*, not more demanding — the same loop, more repetitions.
  That is fatigue, not difficulty. Cap groups-per-day (~25–30) and escalate via
  *complexity* instead: more simultaneous orders, tighter patience, more combos.

Also: **stagger the Day 10 cliff.** VIPs, heavy customers and simultaneous
spawning all arrive at once. Introduce VIPs at Day 8, heavies at Day 12, so each
mechanic is learned alone.

### 4.3 Add pressure, not just speed

Turbo Grill is the only cook-speed lever and maxes at `grillMult=3` (~1.1s per
patty). Once maxed, cooking is trivial and the game becomes pure walking. The
bottleneck should *move*, not disappear:

- A **prep station** that pre-stacks trays, or a **pass-through window** that
  changes the route rather than the speed.
- **Rush events** — a 90-second lunch spike with bonus pay, using the existing
  spawn system. Gives the day a skill peak and a shape.
- **Soda combos are currently pure upside** — +$7 for one extra tap. Make the
  fountain a real decision (a fill beat, or demand spikes).

### 4.4 Depth worth building

- **Milkshake (~Day 15)** — teaches a hold action, mirroring the sink. Already
  scoped in `ARCHITECTURE.md §11b`.
- **Robot depth** — let the player assign a robot to a *specific* station. Turns
  automation from a purchase into a light puzzle. (And teach chefs the fryer.)
- **Visible streak timer.** The streak system is well-designed and completely
  invisible until it fires. A thin decaying bar near the cash HUD would make
  players chase it.
- **Bar decor unlocks** tied to day milestones, so the room visibly grows with you.

### 4.5 Accessibility (currently thin)

- Orders are emoji-only. The colorblind toggle helps patience bars but not orders
  — add a shape/letter tag option.
- HUD font sizes are small and fixed. Add a "larger text" setting.
- Add a visual pulse for "about to walk out" — that cue is currently audio + a
  small bar.

---

## 5. Suggested order of attack

1. **Crash fix** (§1.4 a/b/c) + **§2.1** `return`→`continue` + **§2.2** `+=` +
   **§2.3** table placement. Small, surgical, and it makes the game *stable and
   correct*. This is the whole ballgame.
2. **Robot deadlock & thrash** (§2.4, §2.5) and **walkout accounting** (§2.6).
3. **Teach the core skill** (§4.1) — seat highlighting is the single best
   gameplay change available.
4. **Delete seafood branches + split into modules + test harness** (§3.3 1–4).
   Do this *before* adding content, not after.
5. **Curve rebalance** (§4.2), then new content (§4.4) on the stable base.

---

## 6. Verification status

**Verified in this environment:**
- Full read of all 5,423 lines of `index.html`.
- `node --check` on the extracted game script — syntax is valid.
- `grep -c dispose index.html` → **0**. No disposal anywhere.
- **The leak in §1 was measured, not inferred.** The game's real `itemMesh()`,
  `updateStationVisuals()`, geometry helpers and material definitions were
  extracted verbatim and executed against an instrumented Three.js stub that
  counts construction vs. disposal. Results in §1.2 and §1.3 are that harness's
  output. Harness is reproducible from `index.html` lines 1142–1179, 1216–1221,
  1692–1810, 4128–4180.
- All line-number references were confirmed by direct `grep` against `index.html`.
- Control-flow claims (§2.1 `return` vs `continue`; §2.2 `=` vs `+=`; §2.5
  cooldown placement) were confirmed by reading the enclosing block in each case.

**NOT verified — requires a browser:**
- **The game was never actually run.** The Three.js CDN is blocked by this
  environment's network policy, so no live session, no rendering, no input, no
  frame timing was observed. Everything here is static analysis plus the isolated
  harness above.
- The *absolute time to crash* is not measured. The leak and its scaling are
  confirmed; how many minutes it takes to kill a given device is not. The
  calls/sec figures in §1.3 are reasoned estimates, not instrumented — the
  per-call allocation counts beside them **are** measured.
- Visual/UX claims (§2.3 stacked tables looking broken, §2.1's frozen HUD as it
  appears on screen) follow from the code but were not seen.
- Balance claims in §4.2 come from reading the formulas, not from playtesting.

**Recommended next verification step:** vendor `three.min.js` locally (§3.3.5 —
needed regardless), then play to ~Day 15 with the DevTools memory profiler open
and watch `renderer.info.memory.geometries` climb monotonically. That confirms
§1 end-to-end on real hardware in about ten minutes.


---

## 7. What was fixed, and what was not

Everything below was verified by `node tests/run.js` (21 tests) plus A/B runs
against the pre-fix revision using the same harness.

### Fixed

| § | Finding | Evidence |
|---|---------|----------|
| 1 | GPU leak / the crash | 183 geometries + 42 materials per rebuild → **0**. A 30-day soak leaks **3 geometries total**. |
| 1 (2nd) | Three live WebGL contexts | Home renderers disposed on gameplay entry, rebuilt on return. |
| 2.1 | `drawFloatUI` froze the whole HUD | `return` → `continue`; test drives a table behind the camera. |
| 2.2 | Heavy customers destroyed trays | `=` → `+=`; test runs a heavy group through a round. |
| 2.3 | All tables spawned on one tile | Placed via `freeSpot()`; test buys 6 and asserts 6 unique spots. |
| 2.4 | Full trash bin deadlocked robots | Universal fallback + robots can bag/dump; exhaustive sweep is green. |
| 2.5 | Failed robot actions thrashed | Cooldown now applies to failed arrivals; rebuild gated on `actionDone`. |
| 2.6 | Walkouts counted as serves | Removed from `groupsServed`; reputation hit at half weight instead. |
| 2.7 | Robots ignored collision | Sliding collision + a progress watchdog (see the regression note below). |
| 2.x | Silent save failures, daily-goal determinism, O(n²) queue indexing, stale `todayStars` | All fixed. |
| 4.1 | Core skill untaught | Matching seats pulse / others dim while carrying a plate; wrong plate now says so; station labels for the first 4 days; results screen explains the score. |
| 4.2 | Curve | Day length capped at 28 groups; late days escalate by pressure; VIPs Day 8, heavies Day 12; early payout nudge. |
| 4.3 | Streak invisible | Live streak meter in the HUD. |
| 4.5 | Accessibility | Order text labels, larger-text mode, station labels — all toggleable in Settings. |

### A regression this caught, worth recording

Adding robot collision (§2.7) **broke the serve loop**: robots wedged between
the tray rack and the back wall, sliding freely on one axis while never getting
closer on the other, so an "is either axis blocked" escape hatch never fired. A
10-day A/B against the pre-fix build showed 2 served → 0 served.

The fix was to watch **progress toward the target** rather than per-axis
blocking: if a robot hasn't got meaningfully closer in ~1.5s it phases through
obstacles until it arrives. Reaching the target outranks looking correct.

The lesson is in the test suite now: the original robot test only checked that
bussers moved dirty trays, and it passed throughout. The test that catches this
is `a staffed bar actually serves customers end to end` — a full day driven to
`results` with only robots working.

### Not done, deliberately

**§3.3 steps 1–3 — the ES-module split, deleting the dormant seafood branches,
and the dirty-flag render layer.** This is still the right long-term call and
the reasoning in §3.2 stands. It is not done here because it is a large,
mechanical, whole-file refactor whose only honest verification is *running the
game in a browser*, and the Three.js CDN is blocked in this environment. Shipping
a blind restructure of all 4,500 lines on top of the behavioural fixes above
would put the fixes at risk for no immediate player benefit.

The leak that made it urgent is fixed at the source, so the pressure is off. It
should be done in a session where the game can actually be loaded and played.

**§3.3 step 5 — vendoring `three.min.js` locally.** Same blocker: the CDN cannot
be reached from here to download it. Still worth doing, and still required for
offline/PWA/itch.io builds.
