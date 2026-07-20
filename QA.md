# Burger Bar — QA & Test Plan

> A practical, repeatable checklist for verifying the game **flows** end to end,
> scene by scene, plus the automated tooling that guards against the
> memory-leak class of crash (see [§6](#6-performance--the-day-11-crash-class)).
> Companion to [`ARCHITECTURE.md`](ARCHITECTURE.md) (how it's built) and
> [`REVIEW.md`](REVIEW.md) (what to tune next). Line numbers are approximate.

Legend: **✅ pass criteria** · **⚠️ watch for** · line refs point into
[`index.html`](index.html)'s single `#game-code` script.

---

## 1. Scene / state map

The game is a single page that swaps full-screen overlays over one persistent
3D canvas. `gameState` gates the *simulation*; the render loop always runs.

| Scene (entry fn) | `gameState` | What happens here |
|------------------|-------------|-------------------|
| Boot / CDN load (`startGame`, head script) | `boot` | Load Three.js (multi-CDN fallback), then run `#game-code` in global scope. Friendly error overlay if every CDN fails. |
| Home Screen (`showStartMenu` ~L3299) | `start_menu` | PLAY, animated chef preview, next Achievements, Daily-Goals preview, Shop/Skins/Settings, day-boundary heads-ups (`flushDayHeadsUp`). |
| Day in progress (`executeDayStart` ~L3788) | `playing` | The core loop: spawn → cook → serve → bus. Pause guard on tab-hide. |
| Pause (`togglePause` ~L3473) | `playing` (paused) | Freezes sim; resume / quit to menu. Also auto-invoked on `visibilitychange`. |
| Edit Mode (`enterEditMode`) | `edit` | Drag stations; face a robot + ACT to cycle busser→chef→waiter. |
| Practice (`showPractice` ~L3582) | `practice` | Walkthrough overlay of the cook/serve line. |
| Shop (`showShop` ~L3893) | overlay | Buy gear (tiered by `unlockDay`), 📋 Your Menu toggles (combos/fries). |
| Achievements (`showAchievements` ~L2626) | overlay | Lifetime records, locked-by-achievability, earned, live Daily Goals. |
| Settings (`showSettings` ~L3378) | overlay | Volume, music, colorblind bars, Casual mode, export/import, Reset (type-to-confirm ~L3393). |
| Results (`showResults` ~L3995) | overlay | End-of-day tally: cash, stars, 🎯 daily-goal recap, records; animates then → Home. |
| Stores (`showStores` ~L3659) | overlay | **Single-bar mode:** redirects Home; VISIT/buy hidden. |

⚠️ In **single-bar mode** (`SINGLE_BAR_MODE = true`) every path to a second map
is gated off; the Seafood Shack / franchise code is dormant, not deleted.

---

## 2. Smoke test — the game must flow (run this first)

Serve locally and play through, in order. Each step is a hard gate.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

1. **Boot** → Home Screen appears; no console errors. ✅
2. **Day 1** (PLAY) → customers approach, queue, sit, show an order bubble. ✅
3. **Cook & serve a burger:** fridge→`raw`, grill→`cooked` (before it chars),
   tray rack→`burger_on_tray`, table→served; `+$` floater, star rating. ✅
4. **Bus:** table→`dirty_tray`, sink hold 3 s→`tray`, rack→returned. ✅
5. **End of day** → Results tally animates, returns Home; cash persists. ✅
6. **Shop Day 1 items** buyable (Trays / Skates / Turbo Grill); prices deduct. ✅
7. **Reload the page** → save restored (day, cash, upgrades, skins). ✅
8. **Progress to Day 6**, buy **Soda Fountain**, toggle **combos** on, serve a
   `burger_soda_on_tray`. ✅
9. **Day 10** → VIP (½ patience, 3× pay) and Heavy (3 back-to-back orders)
   customers appear; Busy-Hours heads-up was shown on the prior Home Screen. ✅
10. **Day 11 → Fry Station** (see §4). ✅
11. **Long-session / crash guard** (see §6). ✅

---

## 3. Recipe & serve matrix (must all be satisfiable)

Every generated order must be produceable and match a `player.holding` string.
Full derivation lives in [`ARCHITECTURE.md` §6]; QA-verify each still serves:

| Order (bubble) | Hold to serve | Requires |
|----------------|---------------|----------|
| 🍔 `burger_on_tray` | `burger_on_tray` | base |
| 🥤 `soda_on_tray` | `soda_on_tray` | Soda Fountain + combos on |
| 🍔🥤 `burger_soda_on_tray` | `burger_soda_on_tray` | Soda Fountain + combos on |
| 🍟 `fries_on_tray` | `fries_on_tray` | Fry Station + fries on |

⚠️ A serve only succeeds when the plate in hand is in `group.unservedOrders`
(exact string) and that seat is still unserved (`serveHeldToGroup` ~L4023).
Bringing the wrong plate silently does nothing — expected today.

---

## 4. Day-11 Fry Station acceptance

The Fry Station unlocks after Day 10 (`unlockDay:11`, first buyable on the
Day-11 prep Home Screen). Verify the whole feature:

1. **Purchase** ($170) → a `fryer0` station appears; camera fits; `upg.fryerCount=1`;
   `eco.menu.fries=true`. ✅
2. **Menu panel** shows 🍟 Fries ON/OFF; toggling it changes whether 🍟 orders
   are generated (`menuFriesActive` ~L1865). ✅
3. **Cook fries:** empty-handed ACT at fryer drops a basket (`raw_fries`, no
   ingredient fetch); cooks at fixed rate 0.6 (no Turbo bonus); `fries` at
   progress ≥200; `burnt_fries` after the fixed ~5 s burn window. ✅
4. **Plate & serve:** `fries` + tray → `fries_on_tray` at rack/counter; serve to
   a 🍟 seat; payout `+5 × stars/5` per fries (~L5331). ✅
5. **Robots:** chef robots do **not** cook fries (by design); waiters still carry
   plated `fries_on_tray`. ✅
6. ⚠️ **Regression focus:** the fryer adds a second timed-cook station whose
   slots rebuild visuals on every state change — this *accelerates* the geometry
   churn that §6 guards. Play Day 11 with fries on for ≥8 min and confirm no
   slowdown/crash.

---

## 5. Systems checklist

- **Economy** (`endDay` ~L3904): cash/stars tally; records (best day, rating,
  total served); passive income accrued **only** in `endDay`. ⚠️ Old multi-map
  saves may still pay idle income for a dormant Seafood Shack (REVIEW.md A).
- **Daily Goals**: deterministic per-day pick (`rollDailyGoals`); a reload can't
  reroll; rewards credited in `checkDailyGoals` before results math.
- **Achievements**: `metrics[metric] >= goal`; Home shows next-3-most-achievable.
- **Save/Load**: single `localStorage` slot (`burgerBoss_save`); Export/Import
  codes; Reset requires typing `RESET`. ⚠️ Save failures are swallowed silently.
- **Robots**: chef / waiter / busser FSMs; validate a re-roled robot resumes
  cleanly; level 1→5 by in-store days.
- **Settings**: volume/music, colorblind patience bars, Casual (`diff*` mults),
  export/import round-trips.
- **Robustness**: `animate()` is wrapped in try/catch → a one-time "Something
  glitched · Reload" toast instead of a frozen black canvas; WebGL
  context-loss/`visibilitychange` handlers pause & rebuild.

---

## 6. Performance & the "Day-11 crash" class

**Root cause of the reported crash (fixed).** Three.js `scene.remove()` only
*detaches* a mesh; the geometry's GPU buffers (and non-shared materials) stay
resident until `.dispose()` is called. Every item, held-item, station-visual,
customer, and trail mesh is rebuilt constantly (each cook transition, serve,
pickup, and — for trail skins — ~20×/sec while moving) and the old build never
disposed any of them. GPU memory therefore climbed for the whole session until
the context was lost and the tab crashed — "around day 11" was simply how long a
typical session lasted (≈15–20 min), and the Day-11 fryer's extra visual churn
brought the tipping point closer.

**The fix.** A `disposeObject3D()` helper (frees geometry always; frees
materials except boot-time shared ones tagged `_keep`) is now called at every
removal site via `removeAndDispose()`:
`updateStationVisuals`, `updateHolding`, the movement trail, customer despawn,
station/robot rebuilds, world/room rebuilds, scene cleanups, and the two
home-screen preview renderers.

### 6.1 Automated leak regression (repeatable)

`renderer.info.memory.geometries` is Three's count of **live** (uploaded,
un-disposed) geometries. Under heavy churn it must stay **flat**, not grow.

Harness: [`scratchpad/verify.js`] drives the real game in headless Chromium,
forces `updateStationVisuals()` + `render()` in a loop, and samples the counter.
Run against a build dir (with a local `three.min.js`):

```bash
NODE_PATH=/opt/node22/lib/node_modules node verify.js <build-dir> <label> <port>
```

**Pass:** `delta ≈ 0` and `perCall ≈ 0` over thousands of churn iterations.
**Fail (pre-fix):** `delta` grows ~linearly (geometries leaked per rebuild).

**Measured result** (headless Chromium, 600 rebuilds, 9 stations, `gameState:playing`):

| Rebuilds | OLD (pre-fix) live geometries | FIXED live geometries |
|---:|---:|---:|
| 100 | 3,511 | 203 |
| 300 | 10,111 | 203 |
| 600 | **20,011** | **203** |

Pre-fix leaked **~33 geometries per rebuild, unbounded** (20,011 orphaned GPU
buffers after only 600 rebuilds); post-fix stays **flat at 203** (`delta 0`). In
a real session `updateStationVisuals` fires many times per day, so the pre-fix
curve reaches tens of thousands of leaked buffers within ~15–20 min — the crash.

### 6.2 Manual long-session check

Play continuously ≥20 min through Day 11+ with combos **and** fries on the menu,
a robot hired, and a trail skin selected (worst case for churn). ✅ Frame rate
stays stable; no "Something glitched" toast; no tab crash. In DevTools, the JS
heap and GPU memory should plateau, not ramp.

### 6.3 Known remaining perf items (not crashes — see REVIEW.md E)

- `floatUI.innerHTML` is rebuilt from a string every frame (CPU jank on low-end
  mobile) — candidate to throttle to ~20–30 Hz.
- Three live WebGL contexts (main + 2 home previews); consider disposing the
  home renderers when entering gameplay.

---

## 7. Validating changes without a browser

```bash
# extract the inert game script and syntax-check it
sed -n '/text\/gamejs/,/<\/script>/p' index.html > /tmp/game.js && node --check /tmp/game.js
```

Then run the §2 smoke test, the §4 fryer acceptance, and the §6.1 leak
regression before shipping.
