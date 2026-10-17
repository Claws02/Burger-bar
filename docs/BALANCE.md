# Burger Bar — Economy & Balance

How money comes in, what it should be spent on, and when. Every number here
comes from the code (`06-shop-edit.js`, `14-main.js`, `07-progress.js`) and
from the model in `tools/balance-sim.js`. Re-run the model after any retune:

```
node tools/balance-sim.js 4.0 0.85 1.0   # average player: ~4.0★, 85% of groups served
node tools/balance-sim.js 4.4 0.92 1.3   # strong player: 4★+ rating brings 1.3x groups
```

---

## 1. What was wrong

| Problem | Effect by Day 15–18 |
|---|---|
| Every station type was hard-capped at 4 (`maxEquip()`), counters included | A robot crew (up to 10) fought over 2–5 counters to stage food. Robots stalled and the bar couldn't scale |
| A guest paid the same $16 per burger on Day 1 and Day 100 | Income only grew with the number of groups, which stops growing at 28 groups (~Day 20). Shop prices kept climbing |
| Buying everything cost ~$19,000; the robot crew alone was $7,400 | An average player had earned ~$7k by Day 15 and could not keep up |
| Tables capped at 8 | Day 18+ brings 24–28 groups |
| `freeSpot()` only kept station centres 3.5 apart | Stations could be placed **overlapping** (3 overlaps on a small floor in testing), and space ran out unpredictably |
| The camera zoomed out 2.5 units per expansion (26 → 41) | Characters shrank to ~60% at full size, so animations were hard to read on a phone |
| Nothing new to buy after ~Day 20 | Cash piled up with no use |

## 2. What changed

| Change | Detail |
|---|---|
| **Equipment caps grow with floor size** | Each Expand adds +2 counters, +1 grill, +1 sink, +1 table, and +1 soda fountain per two expansions. Full size (floor 6): **16 counters, 10 grills, 10 sinks, 6 fountains, 14 tables**. A capped item shows **🏗️ EXPAND** while more floor would raise its cap |
| Extra Counter price | `70 + 35n` (was `70 + 50n`), since you now buy up to 14 |
| **📈 Menu Prices** (new, Day 4+) | +15% on every order per level, 10 levels (up to 2.5×). Cost `150 × 1.4^level`: $150, 210, 295, 410, 575, 805, 1,125, 1,575, 2,205, 3,085. The daily "Earn $X" goal follows half the boost |
| **🤖 Robot hire price** | `200 + 60n` (was `200 + 120n`). The full crew of 10 costs $4,700 (was $7,400) |
| **⚙️ Robot Overclock** (new, Day 15+) | +12% robot move speed and faster washing per level, 5 levels: $600, 1,000, 1,600, 2,400, 3,500. This is the late-game cash sink |
| **Station spacing** | `freeSpot(w, d)` checks each station's real footprint and keeps a 1.75-unit walkway around it (wider than the player). Stations never overlap now. With everything bought, every cap fits from floor 4 up (on smaller floors, rearrange in Edit Mode or Expand) |
| **Camera** | View size is `26 + 0.7 × floor`, capped at **30** (was up to 41). The camera already follows the player, so a big bar scrolls instead of shrinking |

Existing saves pick everything up automatically. A Day-18 bar can buy more
counters right away (caps depend on its current floor level), and Menu Prices
and Overclock are already unlocked.

## 3. Income per day

The model buys along the plan in §4. "Average" means ~4.0★ and 85% of groups served.

| Day | Groups | Average $/day | Average earned so far | Strong $/day | Strong earned so far |
|---:|---:|---:|---:|---:|---:|
| 1 | 2 | $48 | $48 | $58 | $58 |
| 5 | 6–7 | $189 | $687 | $271 | $902 |
| 10 | 11–14 | $552 | $2,626 | $808 | $3,822 |
| 15 | 16–20 | $982 | $6,661 | $1,439 | $9,827 |
| 18 | 19–24 | $1,257 | $10,153 | $1,868 | $15,200 |
| 20 | 21–27 | $1,494 | $12,968 | $2,264 | $19,645 |
| 25 | 26–28 | $1,974 | $21,738 | $2,540 | $32,126 |
| 30 | 28 | $2,279 | $32,734 | $2,911 | $46,112 |

Before this change an average Day-18 bar made about $1,000/day, flat from
there on. Menu Prices make the late game grow: about +80% by Day 25.

## 4. Suggested bar by day

What a bar should own **by the end of** each day to keep up with that day's
load. Counts are totals on the floor (the bar starts with 2 counters, 1 grill,
1 sink and 1 table).

| By day | Tables | Counters | Grills | Sinks | Soda | Robots | Floor | Menu Price | Trays | Other |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | 1 | 2 | 1 | 1 | – | – | 0 | – | 4 | Turbo Grill Lv1 |
| 5 | 2–3 | 3 | 1 | 1 | 0–1 | – | 0 | 1 | 8 | Skates Lv1 |
| 10 | 4 | 4 | 1–2 | 2 | 1 | 2 | 1 | 2–3 | 12 | Decor ×2 |
| 15 | 5 | 8 | 3 | 2 | 1 | 4 | 2–3 | 4–5 | 16 | Fry Station, Skates Lv2 |
| 18 | 6 | 10 | 3 | 3 | 1 | 6 | 3 | 5–6 | 16 | |
| 20 | 8 | 11–12 | 3 | 3 | 1 | 6–7 | 4 | 6 | 20 | Turbo Grill maxed |
| 25 | 10 | 14 | 5 | 5 | 2 | 8–9 | 5 | 7–8 | 20 | Overclock 1–2, Decor maxed |
| 30 | 12 | 16 | 5 | 5 | 2 | 10 | 6 | 9–10 | 20 | Overclock 2–3 |

Rules of thumb behind the plan:

- **About 1.5 counters per robot, plus 2 for yourself.** Counters are where
  chefs leave food and waiters pick it up. When every counter is full, robots
  wait.
- **One table per ~3 groups in the day**, until the 14-table cap. Groups arriving
  at the same time are capped by your table count.
- **Buy Menu Prices when a level costs about 5 days of profit or less.** At Day 10
  (~$550/day) that's levels 1–3; at Day 18 (~$1,250/day), levels 5–6.
- **Expand before you hit a cap, not after.** It unlocks both floor space and
  more equipment.
- An average player runs about one purchase behind this plan, which is the
  goal: there's always something worth saving for. A strong player stays on
  plan and builds savings for Overclock and the Day-100 Crown.

## 5. Tuning knobs

| Constant | File | Controls |
|---|---|---|
| `EQUIP_CAPS` | `06-shop-edit.js` | Per-type cap growth per expansion and ceilings |
| `MENU_PRICE_STEP`, `MENU_PRICE_MAX`, `menuPriceCost()` | `06-shop-edit.js` | Menu Prices strength and price curve |
| `OVERCLOCK_COSTS`, `robotOverclockMult()` | `06-shop-edit.js` | Late-game sink |
| `robotCost()` | `06-shop-edit.js` | Robot hire price |
| `FREE_SPOT_GAP` | `05-player.js` | Walkway left around auto-placed stations |
| `CAMERA_FRUSTUM_*` | `01-renderer.js` | How far the camera zooms out per expansion |
| `priceBoost` in `dailyGoalPool` | `07-progress.js` | How much Menu Prices raise the Earn goal |

`tests/run.js` §12 locks in the caps, that every cap fits on a fully expanded
floor with no overlaps, the price curves, and the camera limit.
