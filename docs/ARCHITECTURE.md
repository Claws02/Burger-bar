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

## 1a. Shared GPU resources (read this before adding meshes)

Three.js does **not** free GPU buffers when a mesh leaves the scene graph — only
an explicit `.dispose()` does. Rebuilding visuals used to allocate a fresh
geometry + material set every call and never release the old one, leaking ~183
geometries and ~42 materials per `updateStationVisuals()`. Because the rebuild
rate *also* rises with progression (more stations, and one rebuild per robot
arrival), the leak rate was ~34× higher at Day 50 than Day 1 — which is why it
presented as "the game crashes at higher levels".

The rule now:

| Helper | Use for | Notes |
|--------|---------|-------|
| `M(color[,opacity])` / `MB(color)` | **all** materials | Memoized. Same colour → same object, tagged `_shared`. |
| `GBox/GCyl/GSph/GCylT/GSphS/GCone` | **all** geometry | Cached by shape key, tagged `_shared`. |
| `cachedGeo(key, make)` | one-off shapes | For anything the helpers don't cover. |
| `MU(color[,opacity])` | a material you will **mutate** | Unique. You own it; you must dispose it. |
| `disposeObj(obj)` | freeing a display object | Skips anything `_shared`. |
| `discard(parent, obj)` | remove **and** free | The normal way to drop a mesh. |

Two consequences worth remembering:

- **Never mutate a material returned by `M()`/`MB()`** — every other mesh of that
  colour shares it. Use `MU()` and dispose it yourself (trail particles do this).
- **Never key a cached geometry on a random value.** Crumbs and cloud puffs used
  `Math.random()` radii, which would have made the cache unbounded; both snap to
  a small fixed set of sizes now.

Anything removed from the scene goes through `discard()` — station visuals,
customer despawn, day reset, `cleanupGameScene`, `buildWorld`/`buildRoom`
teardown, `removeStation`. The Home Screen's two extra WebGL contexts (chef +
restaurant preview) are released by `releaseHomeRenderers()` when a day starts
and rebuilt lazily on return.

## 1b. Characters vs. skins

A **character** is a body plan; a **skin** is the colour scheme painted onto it.
They are independent, so any skin works on any character.

- `CHARACTERS` lists them (`human`, six animals, five objects). `human` is the
  default and is always available.
- `buildCharacter(id, skin)` is the **single source of truth** for both the Home
  Screen chef and the in-game player, so the two cannot drift. It returns
  `{group, body, head, armL, armR, hat}`; `hat` is `null` for characters that
  don't wear one, so `applyCrown()` and skin application must null-check.
- `rebuildPlayerMesh()` swaps the in-game player. It disposes the old group and
  reassigns `pBody/pHead/pHat*` (declared with `let`, not `const`). The held item
  hangs off `pMesh`, not the character group, so it survives a rebuild.
- Every character is built from the cached geometry helpers, so switching costs
  **zero** GPU memory after first use (enforced by a test).

To add a character: add an entry to `CHARACTERS` and a `case` in
`buildCharacter`. Use only the cached helpers, and give it a `body` part.

### WebGL canvases are single-use

A `<canvas>` hands out exactly **one** WebGL context for its lifetime;
`getContext()` returns the same object forever, and after `forceContextLoss()`
that context is dead. So `releaseHomeRenderers()` also calls `recycleCanvas()`,
replacing the element with a fresh clone — otherwise the next renderer draws
nothing, which presented as "the chef doesn't load on the title screen".
Recycling the node also drops its event listeners, which is why
`initChefDrag()` is guarded per-element (`canvas._dragBound`) rather than by a
global flag.

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
`menuFriesActive` — owned **and** switched on in the Shop's Your Menu panel):
- Base: **`burger_on_tray`**.
- Fries on the menu: ~22 % **`fries_on_tray`**.
- Combos on the menu: of the rest, 25 % `soda_on_tray`, 45 %
  `burger_soda_on_tray`, else `burger_on_tray`.

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
- **Types, staggered:** `vip` (½ patience, **3× pay**) from **Day 8**; `heavy`
  (3 sequential orders) from **Day 12**. They used to both start on Day 10, the
  same day simultaneous arrivals began — three new mechanics in one shift.
- **Day length is capped at 28 groups** (`DAY_LENGTH_CAP` in `executeDayStart`).
  It used to be `day + 1` forever, so a Day-100 shift was 100+ groups of
  identical work. Past the cap days get *harder*, not *longer*: simultaneous
  arrivals ramp (up to 5) and patience tightens to a floor of 0.7×.
- **Walkouts are not serves.** They no longer increment `groupsServed` (which
  was inflating every achievement keyed off it); they feed the rolling
  reputation average as a half-weight 1-star customer instead.
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

### Robot FSM invariants (do not break these)

An exhaustive role × held-item sweep once found **32 states** where a robot
parked permanently and never worked again — every role's bin branch required
`contents < 4`, so a single full trash bin bricked the whole staff. Three rules
keep that from coming back, and `tests/run.js` enforces all of them:

1. **No dead ends.** After the role-specific planner there is a *universal
   fallback plan* (counter → bin → dumpster), universal *action* handlers for
   any `(role × holding × station)` the role handlers don't name, and a
   last-resort drop after ~5s. Robots can bag and dump the trash themselves.
2. **Cool down after every arrival, not just successful ones.** A robot that
   loses a race for a resource used to re-target and re-arrive on the next
   frame, rebuilding every visual in the restaurant each time.
3. **Navigation is watched by progress, not by blocking.** Robots slide along
   obstacles, but there is *no pathfinding*, so a robot can slide freely on one
   axis forever while never getting closer on the other. If `dist` hasn't
   improved in ~1.5 s the robot phases through until it arrives. Arriving beats
   looking correct — an "is either axis blocked" check is **not** sufficient and
   silently killed the serve loop when it was tried.

---

## 10. Shop (`SHOP_DEFS`, ~L2169)

Tiered by unlock day; all relevant to the single bar:

| Tier (day) | Items |
|------------|-------|
| 1 | 🍱 Trays (+4), ⚡ Roller Skates (move speed ×5), 🔥 Turbo Grill (cook speed) |
| 3 | 🪑 Add Table, 🌸 Fancy Decor (patience), 🍽️ Extra Counter |
| 5 | 🥤 Soda Fountain (unlocks combos), 🏗️ Expand Floorplan, 🍳 Extra Grill, 🚿 Extra Sink, 🤖 Hire Robot |
| 11 | 🍟 Fry Station (unlocks fries as a menu item) |

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
- **Surfaces:** a **top-left button + dropdown during play** (`toggleGoalsPanel`
  / `renderGoalsPanel`) showing live progress, rewards and a `done/total` badge;
  a live/preview list at the top of the Achievements screen; and a
  completed/missed recap on the Results screen. The panel re-renders only when
  the underlying stats actually change (a signature check in the frame loop),
  not every frame.

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
| ~15 | 🥤 Milkshake (hold-to-fill, like the sink) | a hold action | next |
| ~20 | 🍔 Deluxe/topping (extra assembly step) | multi-step assembly | future |

Each lands as a Shop unlock + a Menu toggle, so growth is opt-in and the bar
stays as simple or as rich as the player wants.

**Robots & fries:** robot chefs work **both cookers**. The empty-handed chef
planner is one flat priority list across the grill and the fryer:

1. burnt fries  → bin them (a burnt item occupies its slot forever)
2. charred patty → bin it
3. finished fries → collect (they burn on a fixed timer)
4. cooked patty → collect
5. empty fryer slot **and `friesDemand() > 0`** → drop a basket
6. empty grill slot → fetch a patty from the fridge

`friesDemand()` counts outstanding `fries_on_tray` orders minus the fries
already in flight (frying, staged on a counter, or in anyone's hands, the
player included). Chefs only start a basket when it is positive — fries cook on
a fixed timer and burn whether or not anyone wants them, so frying
speculatively just fills the slots with charcoal and blocks the station. This
is also what stops a chef abandoning burgers for potatoes nobody ordered
(enforced by the test *"chefs do not abandon burgers to fry"*).

Chefs stage plain `fries` on a counter exactly as they stage a cooked patty;
waiters combine `tray + fries → fries_on_tray` there, or plate straight out of
the basket by arriving at the fryer holding a tray (the player's own shortcut).
A chef will plate at the tray rack itself if every counter is occupied.

Measured effect, robots-only bar with fries on the menu, days 12–20:
served 98 → 158, walkout rate 53% → 30%, takings +49%. Before this, roughly a
fifth of all orders were fries that no robot could serve, so those customers
always walked.

---

## 12. Validating changes

No build step. Validate the game script without a browser:

```bash
node tests/run.js          # 41 tests, no install, no network, no browser
```

`tests/harness.js` boots the **real** game script from `index.html` in a Node
`vm` against a stubbed Three.js + DOM, then steps frames deterministically. The
Three.js stub counts geometry/material construction vs. disposal, so memory
regressions are a number rather than a guess. `tests/run.js` covers GPU
disposal, the robot FSM sweep, the tray economy, day pacing and the feedback
layer, and drives a full staffed day end to end.

To compare against another revision:

```bash
git show <rev>:index.html > /tmp/old.html
BURGERBAR_INDEX=/tmp/old.html node tests/run.js
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
