# Burger Bar — Gameplay & Code Review

> A complete pass over the game in its current **single-bar** state, focused on
> what to fix, tune, and build next to make the first Burger Bar genuinely fun
> to play continuously. Severity tags: 🔴 fix soon · 🟠 worth doing · 🟢 polish/idea.
> Line numbers are approximate jump-off points.
>
> Recently fixed: multi-guest serve now checks off the correct customer
> (`serveHeldToGroup`); Soda Fountain is a clean Day-6 shop purchase; game
> locked to the first bar; type-to-confirm reset.

---

## A. Correctness / bugs

- 🔴 **Passive income leaks from dormant maps (old saves).** `endDay()` pays
  passive income for every `store` where `idx !== activeStoreIdx && store.unlocked`
  (~L3700). New saves have only one store, but a returning player whose save
  still holds the old Seafood Shack keeps earning free idle cash from a map they
  can't see. In single-bar mode, gate this loop behind `!SINGLE_BAR_MODE`.
- 🟠 **A walkout counts as a served group with ~0 stars.** Both patience
  timeouts do `g.state='leave'; stats.groupsServed++` (~L4993, ~L5013), so a
  no-sale drags the day's star average (and `totalServed`). The rolling-rating
  fail check softens it, but it still feels punishing and inflates "served"
  metrics/achievements. Consider tracking walkouts separately (e.g. a small
  reputation hit) instead of as a 0-star serve.
- 🟢 **Dead variable.** `const burgerItems=['burger','soda'];` (~L4137) is
  unused. Remove.
- 🟢 **No feedback on a rejected serve.** Bringing the wrong plate to a table
  silently does nothing (`serveHeldToGroup` returns false). A short `error`
  sound / shake would teach the order-matching rule faster.

---

## B. Gameplay & balance (mastering one bar)

- 🟠 **Early grind.** Day *N* spawns ~`N+1` groups at ~$16×stars/5 each, while
  Day-1 shop items cost $55–80. The first few days are slow. Either nudge early
  payouts up ~20–30% or lower Tier-1 prices so the first upgrade lands on Day 2.
- 🟠 **Turbo Grill is the only "cook speed" lever and tops out fast** (max
  `grillMult=3`). Once maxed, cooking is trivial and the bottleneck shifts
  entirely to walking/plating. Add a mid-game station upgrade that changes
  *flow* (e.g. a prep station that pre-stacks trays, or a pass-through window)
  rather than just more speed.
- 🟠 **Soda combos are pure upside with no added pressure.** After Day 6 every
  order can become a combo for +$7, but the only extra work is one tap at the
  fountain. Consider making combos require a distinct soda "fill" beat, or have
  soda demand spike at certain times, so the fountain is a real decision.
- 🟢 **Streak system is good but invisible until it triggers.** Surface the
  streak timer (a thin decaying bar near the cash HUD) so players chase it.
- 🟢 **VIP/Heavy customers all arrive at once on Day 10.** Stagger them: VIPs
  from Day 8, heavies from Day 12, so each new mechanic is introduced alone.

---

## C. Onboarding & UX

- 🟠 **Order-matching is the core skill and is under-taught.** Now that serving
  is per-seat-correct, make the rule legible: when holding a plate, briefly
  highlight (pulse/outline) the seats whose order matches what you're carrying,
  and dim the rest. This single cue removes most "why didn't it serve?" moments.
- 🟠 **Stations are unlabeled in-world.** New players can't tell the Fridge from
  the Tray Rack without Practice. Add small floating labels (toggleable, or just
  for the first ~3 days). The contextual ACT prompt helps but only once you're
  already standing on the station.
- 🟢 **Edit Mode is where the Day-6 fountain gets arranged** (per the new soda
  flow) but it's a tiny home button. Consider auto-suggesting Edit Mode the
  first time a new station is bought ("Arrange your new Soda Fountain →").
- 🟢 **Results screen** is nice; add a one-line "what hurt your stars today"
  (e.g. "3 customers walked out") to guide improvement.

---

## D. Content & depth — how it can be upgraded

- ✅ **Daily goals** (done) — three per-day objectives on the achievement
  engine (`dailyGoalPool`/`rollDailyGoals`/`checkDailyGoals`), with cash
  rewards, a Results recap, and a live/preview list on the Achievements screen.
- ✅ **Menu customization v1** (done) — `eco.menu` + a 📋 Your Menu panel in the
  Shop; customers order only from switched-on categories (combos toggle). The
  framework future menu items slot into.
- 🟢 **Endless framing.** The day loop still just escalates group counts;
  consider a rolling/endless mode on top of the daily-goal cadence.
- ✅ **Fries** (done) — a Fry Station unlocks on Day 11 and adds `fries_on_tray`
  as a toggleable menu item (a second timed cook to juggle). Next item:
  milkshake (~Day 15). Robots don't cook fries yet (documented).
- 🟢 **More menu items on the one bar.** The recipe state machine (see
  ARCHITECTURE §6) generalizes cleanly — each item = station + recipe + order +
  menu toggle. Keep the ~4–5 day cadence so each is learned before the next.
- 🟢 **Rush / lunch-hour events.** A timed wave where groups arrive fast for
  90s with bonus pay — uses the existing spawn system, adds a skill peak.
- 🟢 **Robot depth.** Robots level by days only; add a visible competence stat
  and let the player assign a *specific* station to a chef robot (which grill),
  turning automation into a light puzzle.
- 🟢 **Cosmetic goals.** A few skins are already achievement-gated; add bar
  decor/theme unlocks tied to day milestones so the room visibly grows with you.

---

## E. Technical / performance / robustness

- 🟠 **`floatUI.innerHTML` is rebuilt from a string every frame** (~L4750) —
  all bars, bubbles, checkmarks re-parsed each tick. Fine on desktop; on low-end
  mobile this is the most likely jank source. Consider diffing or throttling the
  float layer to ~20–30 Hz.
- 🟠 **Three live WebGL contexts** (main + home chef + restaurant preview). The
  home ones animate behind `cancelAnimationFrame` but the contexts persist;
  some mobile GPUs cap at ~8 contexts. Dispose the home renderers when entering
  gameplay, or share one renderer across the two home canvases.
- 🟢 **Single `localStorage` save slot.** Writes are wrapped in try/catch but
  failures are swallowed silently. Surface a "couldn't save" toast so a full
  quota doesn't lose progress invisibly. (Export/import already exists — good.)
- 🟢 **CDN dependency.** Three.js + font still load from CDNs (multi-CDN
  fallback exists). For offline/itch/app-wrapper, commit a local `three.min.js`
  and `@font-face` fallback.
- 🟢 **No main-loop guardrail.** A thrown error mid-frame blanks the canvas.
  Wrap `animate()` in try/catch with a friendly "reload" overlay.

---

## F. Accessibility

- 🟢 Heavy emoji reliance for orders/state; the colorblind toggle helps the
  patience bars but orders themselves are emoji-only. A shape/letter tag option
  would help.
- 🟢 Small fixed font sizes on the HUD; a "larger text" toggle in Settings.
- 🟢 Audio-only serve/burn cues; the float bars cover burn, but a subtle visual
  pulse on "order about to walk out" would help players who miss the patience bar.

---

## Suggested order of attack

1. **A (correctness):** gate passive income in single-bar mode; stop counting
   walkouts as 0-star serves; remove the dead var; add a rejected-serve cue.
2. **C (teach the core skill):** highlight matching seats when holding a plate +
   in-world station labels.
3. **B (balance):** early-payout nudge; stagger VIP/Heavy intro.
4. **D (depth):** daily goals using the existing achievement engine, then one
   new menu item (fries) to enrich order-matching.
5. **E (perf/robustness):** throttle the float layer; dispose home renderers;
   save-failure toast.

The foundation is strong and the single-bar focus is the right call — most of
the above is additive and low-risk on top of the current loop.
</content>
