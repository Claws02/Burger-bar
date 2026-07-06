# Burger Bar — First-Bar Architecture

> A complete reference for how the **first Burger Bar** is set up: its stations,
> the cook-each-item / deliver-each-item state machines, the day loop, economy,
> robots, shop, achievements, and save format — written so the single bar can be
> mastered and then *adapted* into a continuously-played game.
>
> The game currently runs in **single-bar mode**: only **Burger Bar #1** is
> active. The Seafood Shack and the three franchise reskins are archived in
> [`archive/index-multimap-backup.html`](archive/index-multimap-backup.html)
> (a full, runnable copy of the previous multi-map build) and are intentionally
> not created at boot. See [Single-bar mode](#single-bar-mode) below.

All gameplay lives in one `<script type="text/gamejs" id="game-code">` block in
[`index.html`](index.html) (≈ lines 919–5083). Line numbers below are
approximate and meant as jump-off points, not exact anchors.

---

## 1. Boot pipeline

```
<head> CDN loader (multi-CDN Three.js r128 + system-font fallback)
      │  on success →
      ▼
runGame()  ──►  reads #game-code text  ──►  eval/Function() once DOM + THREE ready
      │
      ▼
loadSave() ──► bootstrapNewSave() (first run) ──► loadActiveStore()
      │
      ▼
showStartMenu()  (Home Screen, gameState='start_menu')
```

- A friendly error overlay is shown if every CDN fails.
- WebGL context-loss handlers + `visibilitychange` auto-pause guard the canvas.

---

## 2. Game states (`gameState`)

| State          | Meaning                                             |
|----------------|-----------------------------------------------------|
| `boot`         | Engine/DOM not ready yet                             |
| `start_menu`   | Home Screen visible                                  |
| `playing`      | A day is in progress (the core loop runs)           |
| `edit`         | Edit Mode: drag stations / re-role robots           |
| `practice`     | Practice walkthrough overlay                         |

The render loop always runs; `gameState==='playing'` gates simulation
(spawning, cooking, customers, robots, payouts).

---

## 3. Single-bar mode

The multi-store empire is paused so the first bar can be perfected. A single
flag — **`const SINGLE_BAR_MODE = true`** (declared next to `stores`/
`activeStoreIdx`) — gates every path that could reach another map:

| Concern                | Behaviour now                                                             | Code |
|------------------------|---------------------------------------------------------------------------|------|
| New saves              | `bootstrapNewSave()` creates **only** `Burger Bar #1` (`type:'burger'`).   | ~L1910 |
| Old multi-map saves    | Extra stores are **kept** in the `stores[]` array but `activeStoreIdx` is pinned to `0`; nothing is deleted. | `loadSave` else-branch ~L1898 |
| Preview swipe gesture  | `initRestaurantSwipe()` + `homeSwipeStore()` early-return under the flag.  | ~L2956, ~L2970 |
| PLAY button            | `homePlaySelected()` always launches store `0` under the flag.            | ~L3682 |
| Stores screen          | `showStores()` redirects home under the flag; its VISIT/buy buttons never render. | ~L3434 |
| Stores button / arrows / dots | Hidden in `showStartMenu()` / Home markup.                         | ~L3070, ~L614 |
| Seafood / franchise code | Untouched and dormant (`isSeafood()` is simply never true with one burger store). | throughout |

To **re-enable** more locations later: flip `SINGLE_BAR_MODE` to `false`,
restore the extra `defStore(...)` calls in `bootstrapNewSave()`, and unhide the
Stores button + swipe controls. The archived backup is the reference
implementation.

### Resetting progress

The Settings panel's **Reset All Progress** uses a **type-to-confirm** modal
(`showResetConfirm` → type `RESET` → `doReset`), not a one-tap `confirm()`, so a
destructive wipe can't happen by accident. It clears `burgerBoss_save` +
`burgerBoss_tutorialSeen` and reloads. Suggest **Export Save** first.

---

## 4. The first bar's stations

Default layout, built in `buildRoom()`/`addStation()` (~L1651):

| id          | type       | role in the line                                  |
|-------------|------------|---------------------------------------------------|
| `fridge`    | `fridge`   | Source of **raw** patties                         |
| `grill0`    | `grill`    | Cooks patties (2 slots)                           |
| `rack0`     | `trayrack` | Holds **clean trays**; plate a cooked patty here  |
| `counter0`  | `counter`  | Assembly / staging surface                        |
| `counter1`  | `counter`  | Second assembly / staging surface                 |
| `sink0`     | `sink`     | Hold-to-wash **dirty trays** (3 s)                |
| `trash0`    | `trash`    | Dump burnt/wrong food; fills to 4 → bag it        |
| `dumpster0` | `dumpster` | Drop the **trash bag** (off the floor edge)       |
| `table0`    | `table`    | Seat a customer group; serve here; bus dirty trays |

A station is the nearest interactable to the player; `getClosest()` picks it and
`handleAction()` (~L3847) decides what the ACT button does. The contextual
`#act-label` shows the next action ("Pick up patty", "Serve", "Wash 3s", …).

---

## 5. Items & the cook state machine

`player.holding` is a single string. Burger-bar item vocabulary:

| Item                   | What it is                          |
|------------------------|-------------------------------------|
| `raw`                  | Raw patty (from fridge)             |
| `cooked`               | Cooked patty (off the grill)        |
| `charred`              | Burnt patty → trash only            |
| `tray`                 | Clean tray                          |
| `burger_on_tray`       | Plated burger                       |
| `soda_on_tray`         | Soda on a tray (needs Soda Fountain) |
| `burger_soda_on_tray`  | Combo meal                          |
| `raw_fries`            | Basket of fries cooking in the fryer |
| `fries`                | Cooked fries (off the fryer)         |
| `burnt_fries`          | Over-fried → trash only              |
| `fries_on_tray`        | Plated fries (needs Fry Station)     |
| `shake`                | A blended milkshake (hold-to-fill)   |
| `shake_on_tray`        | Plated milkshake (needs Shake Machine) |
| `dirty_tray`           | Used tray left after a group eats   |
| `trash_bag`            | Full trash, carried to the dumpster |

The **fryer** works exactly like the grill (2 slots, `raw_fries → fries →
burnt_fries` via `progress`/`burnTimer`) but has **no ingredient fetch** — an
empty-handed ACT drops a fresh basket in (fries are always stocked) — and cooks
at a **fixed** rate (no Turbo Grill bonus). Plate `fries` + `tray` →
`fries_on_tray` at the Tray Rack or a Counter.

### Grill cooking (per-slot), update loop ~L4900

```
place raw → slot = {state:'raw', progress:0, burnTimer:0}
            progress += upg.grillMult * ds        (ds ≈ 1 per frame @60fps)
   progress >= 200  → state:'cooked', burnTimer:0   (play 'sizzle')
            burnTimer += ds          ← FIXED window, independent of grill speed
   burnTimer >= 300 → state:'charred'                (play 'error')
```

- Cook time = `200 / grillMult` frames. At base `grillMult=0.5` ≈ **6.7 s**;
  fully upgraded `grillMult=3` ≈ **1.1 s**.
- Burn window is a fixed **~5 s** (300 frames) **after** cooking — upgrading the
  grill makes food cook faster **without** making it burn faster (intentional;
  see comment ~L4911).

---

## 6. Recipe & delivery test matrix (verified against code)

Every burger-bar order and the exact ACT-button sequence that produces and
delivers it. Each row was traced through `handleAction()` (~L3949–4034) and the
order generator (`spawnGroup`, ~L3799) and the table-serve match (~L4023).

> **Order ↔ holding match rule:** at a `table`, a serve succeeds only when
> `player.holding` is found in `group.unservedOrders` (exact string match), the
> group is `ordering`, and that exact order is still unserved (~L4024). So the
> plate in your hand must equal the order bubble over the customer's head.

### Order types generated (`spawnGroup`)
Orders are drawn only from the **active menu** (`menuComboActive` /
`menuFriesActive` / `menuShakeActive` — owned **and** switched on in the Shop's
Your Menu panel), checked in this order:
- Milkshakes on the menu: ~15 % **`shake_on_tray`**.
- Fries on the menu: ~22 % of the rest **`fries_on_tray`**.
- Combos on the menu: of the rest, 25 % `soda_on_tray`, 45 %
  `burger_soda_on_tray`.
- Otherwise: **`burger_on_tray`**.

### A. Plain burger → `burger_on_tray`
| # | At station | Hold before → Hold after | Notes |
|---|------------|--------------------------|-------|
| 1 | `fridge`   | (empty) → `raw`          | Pick up raw patty |
| 2 | `grill`    | `raw` → (empty)          | Place patty; wait for `cooked` |
| 3 | `grill`    | (empty) → `cooked`       | Pick up before it chars |
| 4 | `trayrack` | `cooked` → `burger_on_tray` | Auto-plates onto a clean tray (decrements `cleanTrays`) |
| 5 | `table`    | `burger_on_tray` → (empty) | Serve; `served++`, order removed |

**Alternate plating** (matches the in-game "build on the counter" tutorial):
- `trayrack` (empty)→`tray`, then `counter` place `tray`, place `cooked` on the
  same counter → auto-combines to `burger_on_tray` (~L4008–4009); **or**
- `grill` while holding `tray` → `burger_on_tray` directly (~L3979).

### A2. Fries → `fries_on_tray`  *(requires Fry Station, Day 11)*
| # | At station | Hold before → Hold after | Notes |
|---|------------|--------------------------|-------|
| 1 | `fryer`    | (empty) → (empty)        | ACT drops a basket cooking (no ingredient) |
| 2 | `fryer`    | (empty) → `fries`        | Pick up when done, before it burns |
| 3 | `trayrack` | `fries` → `fries_on_tray` | Auto-plates onto a clean tray |
| 4 | `table`    | `fries_on_tray` → (empty) | Serve the customer who ordered 🍟 |

### A3. Milkshake → `shake_on_tray`  *(requires Shake Machine, Day 15)*
| # | At station | Hold before → Hold after | Notes |
|---|------------|--------------------------|-------|
| 1 | `shakemachine` | (empty) → `shake`    | **Hold** ACT ~2.2 s to blend (shared hold system with the sink) |
| 2 | `trayrack` | `shake` → `shake_on_tray` | Auto-plates onto a clean tray |
| 3 | `table`    | `shake_on_tray` → (empty) | Serve the customer who ordered 🥛 |

### B. Soda only → `soda_on_tray`  *(requires Soda Fountain)*
| # | At station     | Hold before → Hold after |
|---|----------------|--------------------------|
| 1 | `trayrack`     | (empty) → `tray`         |
| 2 | `sodafountain` | `tray` → `soda_on_tray`  |
| 3 | `table`        | `soda_on_tray` → (empty) |

### C. Combo → `burger_soda_on_tray`  *(requires Soda Fountain)*
Build a burger (A.1–A.4) **or** a soda (B.1–B.2), then add the other half:
| Path | Action |
|------|--------|
| Burger first | `sodafountain`: `burger_on_tray` → `burger_soda_on_tray` (~L3964) |
| Soda first   | `sodafountain`: a tray→soda, then `counter` combine `soda_on_tray`+`cooked` → `burger_soda_on_tray` (~L4014) |
| On counter   | place `burger_on_tray` + `soda_on_tray` on a counter → combine (~L4011) |
Then `table`: `burger_soda_on_tray` → (empty).

### D. Busing (after a group eats — every order)
| # | At station | Hold before → Hold after | Notes |
|---|------------|--------------------------|-------|
| 1 | `table`    | (empty) → `dirty_tray`   | `dirtyTrays--`; table reusable once 0 |
| 2 | `sink`     | hold 3 s: `dirty_tray` → `tray` | `startSinkHold()` / `updateSinkHold()` ~L4045 |
| 3 | `trayrack` | `tray` → (empty)         | Return clean tray to the rack |

### E. Mistake recovery
| Situation | Fix |
|-----------|-----|
| Patty `charred` | `grill`/hand → `trash`; at 4 items `trash`→`trash_bag`→`dumpster` |
| Wrong/again food in hand | `trash` accepts `raw`/`cooked`/`charred`/`*_on_tray` (drops to null or back to `tray`) |

**Verification status:** all five paths above are reachable in the current
`handleAction()` and produce a `player.holding` string that exists in the
`spawnGroup` order set, so every generated order is satisfiable. Syntax of the
whole script is validated with `node --check` (see [§12](#12-validating-changes)).

---

## 7. Customers, patience & stars

`spawnGroup()` (~L3776) and the per-frame customer FSM (~L4947):

```
approach_door → queue → to_table → ordering → eating → leave → leaving (despawn)
```

- **Group size** 1–2 (heavy groups are size 1 but order 3 times in a row).
- **Types** (Day ≥ 10): 15 % `vip` (½ patience, **3× pay**), 15 % `heavy`
  (3 sequential orders).
- **Two patience clocks:** `waitPatience` (in the door queue) and `foodPatience`
  (seated, waiting for food). A trash `♨️` stink penalty drains both ~20 % faster.
- **Stars** at end of eating: `score = waitFrac*0.3 + foodFrac*0.7`, bucketed
  `>.8→5, >.6→4, >.4→3, >.2→2, else 1` (~L4983).
- A walked-out group still counts as served with low/zero stars (affects the
  rolling rating used for the soft game-over check).

---

## 8. Economy / payout (per group, ~L4987)

```
rawCash  = size * 16 * (stars/5)
         + sodaCount * 7 * (stars/5)          // combos/sodas
if stars>=4: rawCash += (stars-3) * size * 1.5  // mastery tip
if VIP:      rawCash *= 3
rawCash *= diffPayoutMult()                    // Casual mode etc.
streakBonus = 1 + min(serveStreak-1, 4) * 0.1  // up to +40%, ~6 s window
cash = round(rawCash * streakBonus, 2)
```

Day-level: `endDay()` tallies cash, stars, records (best day / best rating /
total served), runs `checkAchievements(deferToasts=true)`, then the results
screen animates the totals. Passive income is **only** accrued in `endDay()`
(single source of truth).

---

## 9. Robots (`updateRobots`, ~L4088)

Hired from the Shop, role-set in Edit Mode by facing one and pressing ACT
(cycles **busser → chef → waiter**). Each robot is a tiny FSM
(`idle → moving → acting/washing`) that mirrors a slice of the human line:

- **Chef** — fridge → grill → plate/counter; trashes charred patties.
- **Waiter** — picks up plated food and serves matching table orders.
- **Busser** — pulls dirty trays → sink (washes) → tray rack.

Robots **level 1→5** with in-store days (`getRobotLevel`), which raises their
move speed. Idle stores also pay a small passive income per robot.

---

## 10. Shop (`SHOP_DEFS`, ~L2169)

Tiered by unlock day; all relevant to the single bar:

| Tier (day) | Items |
|------------|-------|
| 1 | 🍱 Trays (+4), ⚡ Roller Skates (move speed ×5), 🔥 Turbo Grill (cook speed) |
| 3 | 🪑 Add Table, 🌸 Fancy Decor (patience), 🍽️ Extra Counter |
| 5 | 🥤 Soda Fountain (unlocks combos), 🏗️ Expand Floorplan, 🍳 Extra Grill, 🚿 Extra Sink, 🤖 Hire Robot |
| 11 | 🍟 Fry Station (unlocks fries as a menu item) |
| 15 | 🥛 Shake Machine (unlocks milkshakes — hold to blend) |

`unlockDay:N` means an item becomes buyable **after Day N is complete** (locked
while `eco.day < N`). So the **Soda Fountain** (`unlockDay:5`) first appears in
the Shop on the **Day 6** prep screen — you buy it and arrange it in Edit Mode
before Day 6 starts. (There is intentionally no earlier mid-transition "Business
Decision" popup; the fountain is a normal purchase.)

Building/equipment items call `addStation(...)` so upgrades physically appear on
the floor; the camera zooms out as `floorLevel` grows (`rebuildAll`).

---

## 11. Achievements

Data in `ACHIEVEMENTS` (~L2281). Each entry is **metric-driven**:
`{id, icon, name, desc, metric, goal, cash?, skin?}`. Completion is the uniform
test `metrics[metric] >= goal`, which also yields a **live progress fraction**
used to order them by *how achievable* they are.

- **Metrics** (`achvMetrics`): `maxDay`, `groups` (lifetime served), `robots`,
  `cash`, `tables`, `grillLv`, `todayStars`.
- **Ordering** (`lockedAchvByAchievability`): still-locked achievements sorted by
  progress fraction **closest-to-earn first**; ties fall back to the authored
  easy→hard order.
- **Home showcase** (`renderHomeAchievements`): the **next 3 most achievable**,
  each with a progress bar; the single closest one is highlighted as `next`.
- **Full screen** (`showAchievements`): locked (closest first, with progress
  bars) then earned, under the lifetime-records banner.

17 achievements span the whole first-bar journey (first day → serve 1,000 →
Day 100), with cash and three skin unlocks (gold / fire / alien). The old
multi-store "Empire" achievement was removed for single-bar mode.

---

## 11a. Daily Goals

Three light, per-day objectives on the **same metric/goal engine** as
achievements, reset each morning, each paying a small cash bonus.

- **Pool** (`dailyGoalPool(day)`): serve N groups, earn $N, finish at 4★+, no
  walkouts, and — **only when combos are on the menu** — serve N combos. Targets
  scale gently with the day. `mode:'reach'` (cur≥goal) or `'atMost'` (walkouts).
- **Selection** (`rollDailyGoals`): a **deterministic** per-day shuffle
  (`seededPick`, mulberry32 seeded by day) picks 3, so a reload can't reroll for
  an easier set. Rolled for the day being played in `executeDayStart`, and
  previewed for the upcoming day in `showStartMenu`. Persisted in the save.
- **Today-scoped metrics** (`dailyMetrics`): read from `stats`
  (`groupsServed`, `cashEarned`, today-stars, `combosServed`, `walkouts` — the
  last two added to `stats` and incremented in `serveHeldToGroup` / the walkout
  branches).
- **Award** (`checkDailyGoals`, called in `endDay` before the results math):
  credits `dg.reward` for each newly-completed goal, tracked as
  `stats._dailyEarned` (🎯 line on the Results screen).
- **Surfaces:** live/preview list at the top of the Achievements screen; a
  completed/missed recap on the Results screen.

**Day-boundary heads-ups.** Milestone alerts (Day 10 Busy Hours/VIP) and
newly-unlocked shop items are **queued at the END of the day**
(`queueNextDayHeadsUp` in `endDay`) and shown on the Home Screen
(`flushDayHeadsUp`), not at the start of the next day — so the player learns
what's coming while they still have time to buy gear and arrange the bar before
pressing PLAY.

## 11b. Menu & item growth (roadmap)

The **menu** is which optional item categories the player is currently serving.
Customers only order what's switched on, so the player controls their line.

- **State:** `eco.menu` (e.g. `{combos:true}`). `menuComboActive()` =
  owns the Soda Fountain **and** combos left on. Order generation
  (`spawnGroup`, heavy re-order) reads this instead of `upg.sodaCount` directly.
- **UI:** a **📋 Your Menu** panel at the top of the Shop (`renderMenuPanel`):
  Burgers are always-on; each unlocked optional category gets an ON/OFF switch
  (`toggleMenuCombos`). The panel only appears once there's a real choice.

**How to add the next item (spaced so players aren't overwhelmed).** Each new
item = a station + item meshes + a `handleAction` recipe + an order-generator
entry + a serve match + a payout + a `menu` toggle, following the recipe pattern
in §6. Suggested cadence — introduce **one** new item roughly every ~4–5 days so
each is learned before the next:

| ~Day | Item | New verb it teaches | Status |
|------|------|---------------------|--------|
| 1  | 🍔 Burger (grill) | the core line | ✅ shipped |
| 6  | 🥤 Soda / combos (fountain) | assembling two parts onto one tray | ✅ shipped |
| 11 | 🍟 Fries (fryer, timed like the grill) | a second timed cook to juggle | ✅ shipped |
| 15 | 🥛 Milkshake (shake machine, hold-to-blend) | a hold action | ✅ shipped |
| ~20 | 🍔 Deluxe/topping (extra assembly step) | multi-step assembly | next |

Each lands as a Shop unlock + a Menu toggle, so growth is opt-in and the bar
stays as simple or as rich as the player wants.

**Robots & fries:** robot chefs currently cook **burgers only** — fries are a
hands-on item, so enabling fries is a deliberate "I'll work the fryer myself"
choice. Waiters will still carry fries you've plated. Teaching robots the fryer
is a clean future add (mirror the grill branch in `updateRobots`).

---

## 11c. Stability & saves

- **GPU memory / late-day crash fix.** `itemMesh` builds fresh geometries
  (`GBox`/`GSph`/`GCyl` → `new …Geometry` each call), and `updateStationVisuals`
  / `updateHolding` rebuild throwaway meshes on **every serve and pickup**.
  Three.js does **not** free vertex buffers on `scene.remove()`, so the old code
  leaked geometry continuously — long/busy days (10+) eventually exhausted GPU
  memory and lost the WebGL context (a black-screen "crash"). `freeVisual`
  (and the held-mesh / group-despawn paths) now `.dispose()` geometry when
  clearing visuals. Shared materials are left intact (safe: itemMesh geometries
  are never shared).
- **Autosave.** The run autosaves every ~20 s during play (`autoSaveTimer` in the
  frame loop) and again from the frame-error handler, so a crash/refresh resumes
  from the last checkpoint (cash, upgrades, day) instead of losing the run. The
  frame loop is wrapped in try/catch with a friendly "Something glitched · Reload"
  toast so one bad frame never blanks the screen permanently.

---

## 12. Validating changes

No build step. Validate the game script without a browser:

```bash
# extract the inert game script and syntax-check it
sed -n '919,5083p' index.html > /tmp/game.js && node --check /tmp/game.js
```

Then smoke-test in a browser (`python3 -m http.server 8000`): play Day 1, cook
and serve a `burger_on_tray`, buy a Soda Fountain and serve a combo, bus a tray
through the sink, and confirm the Home Screen shows Achievements **above**
Skins/Shop with the next goal on top.

---

## 13. Adapting toward a continuously-played game

The single bar is the unit to perfect first. Natural next levers, all local to
the systems above:

1. **Endless framing** — soften/replace the day-end stop with rolling daily
   goals (the achievement metric/goal pattern generalizes directly).
2. **Order variety** — extend the item vocabulary + `spawnGroup` order table and
   add matching `handleAction` recipes (the matrix in §6 is the template).
3. **Live ops** — daily challenges keyed off `achvMetrics`, streak/score chases.
4. **Re-open the empire** — restore multi-store from the archived backup once the
   first bar's loop is tuned and fun on its own.
</content>
</invoke>
