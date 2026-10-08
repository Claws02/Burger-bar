# Burger Bar — Complete Game Analysis & Publishing Proposal

> A full review of the current build and a prioritized plan to take **Burger Bar**
> from "very solid prototype" to "polished, publishable game."

---

## Implementation status (this branch)

**✅ Done**
- **B1** seafood Chef robots now act · **B2** new-store toast · **B3** passive income paid once (Stores screen is display-only)
- Removed stale `index.txt`
- Multi-CDN Three.js loader + friendly error overlay; game code deferred until engine + DOM ready
- Non-blocking webfont with a system fallback stack
- WebGL context-loss recovery + auto-pause on tab hide
- First-run tutorial auto-opens once
- Economy: early payouts +~30%, 4–5★ mastery tip, burn window decoupled from grill speed, robot passive $8→$16, new store $5,000→$3,000
- Forgiving rolling 3-day game-over check (lifetime rating still displayed)
- Day-4 soda decline penalty is now small & temporary
- PWA manifest + SVG icon + favicon/apple-touch-icon + share/meta tags
- Audio: serve chime + day-complete fanfare; "PERFECT!/GREAT!" serve feedback
- Branded "CLAWEngineering" loading/splash screen on boot
- Camera zooms out with floor expansions; version label
- Results stars now show half-stars (4.5 → 4½, never rounds up to 5)
- **Settings panel**: master volume slider, background-music toggle, colorblind toggle, safe reset (reachable from home + pause)
- **Background music**: gentle generative chord-pad loop, volume/mute-aware
- **Achievements**: 10 milestones with cash + skin rewards, unlock toasts, and a dedicated screen; persisted in the save
- **Contextual action prompt**: a label by the ACT button shows what it will do
- **Colorblind-friendly** patience faces (🙂/😐/😡) via the new toggle
- **B4** fixed: store-lock UI is now driven by `RESTAURANT_UNLOCK_DAYS`
- **3 new skins** (Robo / Rodeo / Wizard) — now 12 total
- **Casual difficulty** mode (longer patience, +15% tips, never closes) in Settings
- **Lifetime records** (best day, best rating, total served) with a "NEW BEST DAY!" results callout and a records banner on the Achievements screen
- Achievements now also unlock immediately after relevant purchases, not only at day-end
- **Serve-streak tips**: consecutive serves within ~6s stack up to +40% bonus, with 🔥 STREAK callouts
- **Save export/import** backup codes in Settings (backup & device transfer; no cloud)

**◻️ Not yet done (recommended next)**
- True offline bundling of Three.js + font (blocked here by network egress — needs the library file committed) and a service worker
- A genuinely distinct 3rd cuisine (large gameplay addition; best done with live playtesting)
- Optional: daily challenges, cloud save

---

## 1. What the game is today

**Burger Bar** is a 3D, top-down, mobile-first restaurant/cooking management game
(think *Overcooked* crossed with a light idle-tycoon), built entirely in a single
`index.html` (~4,270 lines) on **Three.js r128**, with `localStorage` saving.

**Core loop**
1. A **day** starts → customer groups walk in and sit at tables.
2. You (the chef) physically run the line: Fridge → Grill → Tray Rack → Counter (assemble) → Table (serve), then bus dirty trays → Sink (3s hold) → Tray Rack.
3. Serving fast/before patience runs out earns **cash + a 1–5★ rating**.
4. Between days you spend cash in the **Shop** (speed, grill, trays, tables, decor, extra equipment, robots, floor expansion), and use **Edit Mode** to rearrange.
5. **Robots** can be hired and assigned roles (Chef / Waiter / Busser); they level up over days.
6. Meta systems: **Multi-store empire** (passive income from idle stores), **Skins** (cosmetic), a second cuisine — **Seafood Shack** — with its own stations/recipes, plus events (VIP & "Heavy" customers from Day 10, a Day-4 soda decision, Day-30 expansion).

**Verdict:** The foundation is genuinely impressive — a complete economy, two full cuisines, robot AI, multi-store meta, cosmetics, and a clean Golf-Battle-style home screen. It is **not** yet publish-ready: there are a handful of real bugs, the economy/onboarding need tuning, and several publishing hygiene items (offline loading, PWA, stale files) are missing.

---

## 2. Bugs & correctness issues (P0 — fix before publishing)

| # | Severity | Issue | Location | Fix |
|---|----------|-------|----------|-----|
| B1 | **High** | **Seafood Chef robots never work.** The idle decision block tests `if(bot.role==='chef')` (burger logic) *before* `else if(bot.role==='chef' && isSeafood())`, so the seafood branch is unreachable. In a seafood store a Chef robot looks for a fridge/grill (which don't exist), finds nothing, and idles forever. | `updateRobots`, ~L3437 vs ~L3501 | Reorder so the `isSeafood()` chef branch is evaluated first (or merge into one `if(bot.role==='chef'){ if(isSeafood()){…} else {…} }`). |
| B2 | **Medium** | **Broken toast on new store.** `showToast('🎉 ${name} opened!')` references the undefined global `name` (resolves to `window.name`, usually `""`) instead of `def.name`. New-store celebration reads "🎉  opened!". | `openNewStore`, ~L2810 | Use `def.name`. |
| B3 | **Medium** | **Passive income is paid through two different code paths.** `endDay()` adds passive income for every idle store each day, **and** `showStores()` *also* pays it (guarded only by a `sessionStorage` per-day key). Players who open the Stores screen can be paid twice (or on inconsistent day boundaries). | `endDay` ~L2989, `showStores` ~L2690 | Pick one source of truth — accrue passive income only in `endDay()`; make `showStores()` display-only. |
| B4 | **Low** | **`RESTAURANT_UNLOCK_DAYS` is dead data.** Defined but unused; gating is hand-rolled with `rp.storeIdx >= 2` magic numbers. | ~L2118, ~L2388 | Drive lock state from the data array (single source), or delete it. |
| B5 | **Low** | **Day-4 "Business Decision" permanent penalty.** Declining the soda fountain applies a **permanent −15% traffic** multiplier even though the same fountain is freely buyable in the Shop from Day 5. Feels like a "gotcha." | `startNextDay`/`decisionDeclineSoda`, decision popup | Make the penalty temporary (e.g. a few days), smaller, or remove it; or remove the shop duplicate so the decision is meaningful. |
| B6 | **Low** | **WebGL context loss not handled.** On mobile, backgrounding the tab can lose the GL context → black screen on return, with no listener to restore. | renderer setup, ~L750 | Add `webglcontextlost`/`webglcontextrestored` handlers (and rebuild scene), and pause on `visibilitychange`. |

---

## 3. Balance & economy (P1)

The numbers are internally consistent but **too tight early and too grindy at the meta layer.**

- **Per-group payout is small.** A normal group is 1–2 people × `$12` × `stars/5` (+`$6`/soda). At 5★ that's ~$12–30/group. Day *N* spawns `N+1` groups, so early days net roughly **$30–80** — yet Day-1 shop items already cost $55–80 each. Early progression feels slow.
  - *Proposal:* raise base payout ~25–40% and/or add a small flat **tip** scaling with star rating to reward mastery.
- **New store ($5,000 at Day 30) is effectively unreachable by Day 30** at current cash rates. The unlock day and the price are out of sync.
  - *Proposal:* lower to ~$2,500–3,000, or push the unlock later, or scale price to lifetime earnings.
- **Robots are weak value.** Cost `200 + 120·n`; passive income only **$8/robot/day** → ~25-day payback for the *passive* benefit alone. Their in-store labor value is real but opaque.
  - *Proposal:* raise passive to ~$15–20/robot/day for *idle* stores, and surface their in-store throughput in the Shop ("Chef robots cook while you bus").
- **Turbo Grill is a double-edged sword by accident.** Burn timer is `burnTimer += ds * (1/grillMult)` — a faster grill also **burns faster**. High investment can make food harder to manage.
  - *Proposal:* decouple burn speed from cook speed (fixed, generous burn window), or make a late upgrade that *slows* burning ("Warming Tray").
- **Death spiral risk.** Game over triggers at lifetime rating `< 2.0` after Day 5. Because a walked-out group counts as a served group with 0 stars, a couple of bad days can be hard to climb out of (lifetime average is sticky).
  - *Proposal:* use a *rolling* rating (last N days) for the fail check, or add a "probation" warning day before closing the store. Keep lifetime rating for display.
- **VIP / Heavy customers** are well designed (3× pay at half patience / 3 sequential orders) — keep, but consider introducing them gradually rather than all at Day 10.

---

## 4. Onboarding & UX (P1)

- **No first-run tutorial.** New players are dropped into Day 1 cold; "Practice" is opt-in text. *Proposal:* auto-open Practice (or a short interactive guided Day 0) on first launch, then never again (flag in save).
- **Stations are unlabeled.** With station hints removed ("use Practice mode"), nothing in-world tells you the Cooler from the Chowder Pot. *Proposal:* add small floating 3D labels (or an icon) over each station, at least for the first few days or as a toggle.
- **No contextual action prompt.** The action button is fully context-sensitive but never says *what* it will do. *Proposal:* show a tiny prompt near the action button ("Pick up patty" / "Serve" / "Wash 3s").
- **"Reset Save" is a one-tap landmine** sitting on the home screen behind only a `confirm()`. *Proposal:* move it into a Settings panel.
- **No real settings.** Only a mute toggle exists. *Proposal:* add a Settings screen: volume slider, music toggle, reset save, credits, version number.
- **Camera vs. expansion.** Large expanded floors can push stations near/off the orthographic frame. *Proposal:* slightly zoom the camera out as floor level grows, or clamp player so stations stay framed.

---

## 5. Content & depth (P2)

- **Only 2 of 5 store types are real.** Slots 3–5 (Downtown Diner / Westside Grill / East End Kitchen) are reskinned Burger Bars. *Proposal:* give at least one more a distinct cuisine (e.g. Pizza or Taco) with unique stations, or be explicit that they're "franchise" copies and lean into idle-empire framing.
- **No within-run goals beyond survival + the Day-100 crown.** *Proposal:* add lightweight **achievements/milestones** (serve 100 burgers, 5★ day, all-robot day) that grant cash or skins — strong retention lever and ties into the existing skins economy.
- **Skins are purchase-only (9 total).** *Proposal:* gate a few behind achievements/day milestones so cosmetics feel earned, not just bought.
- **No music, thin SFX.** Procedural coin/error/sizzle/dump only. *Proposal:* add looping background music (with the existing mute respected) and more SFX: successful serve, day-complete fanfare, star tally, footsteps. This single change does the most for "publish-ready feel."
- **Juice/feedback is light.** *Proposal:* add a serve "pop"/particle, a fast-serve **streak/combo** bonus, and subtle screen shake on combo — cheap polish, big payoff.

---

## 6. Publishing readiness / technical hygiene (P1)

- **Hard CDN dependencies.** Three.js r128 and Google Fonts load from CDNs — **the game won't start offline or if a CDN is blocked.** *Proposal:* self-host/inline `three.min.js` and the font (or `@font-face` with a local fallback). Critical for itch.io zips, app wrappers, and flaky mobile networks.
- **Stale duplicate file.** `index.txt` is an **older, smaller (2,052-line) version** of the game (no seafood / multi-store / skins). It's confusing and could be served by accident. *Proposal:* **delete `index.txt`** (it's preserved in git history).
- **No PWA / install metadata.** Missing `manifest.json`, service worker (offline + installable), `apple-touch-icon`, `theme-color`, favicon, and Open Graph/Twitter tags for link sharing. *Proposal:* add them — turns the page into an installable, shareable mobile game.
- **Three live WebGL contexts** (main + home chef + restaurant preview). Animations are correctly cancelled when leaving the home screen, but on low-end devices the multiple contexts are a risk. *Proposal:* confirm the home renderers are disposed (not just paused) when entering gameplay, and reuse a single renderer for the two home canvases if feasible.
- **No error/telemetry guardrails.** A thrown error mid-frame can blank the screen silently. *Proposal:* wrap the main loop in a try/catch that surfaces a friendly "something went wrong — reload" overlay; optionally add minimal analytics.
- **Accessibility.** Heavy emoji reliance, small fonts, no colorblind-safe option for the green/orange/red cook & patience bars. *Proposal:* add iconography or patterns to the bars and a larger-text option.
- **Save robustness.** Single `localStorage` slot, no export/import or cloud. Acceptable for a casual launch; consider an export-code feature later.

---

## 7. Recommended roadmap (phased)

**Phase 0 — Ship-blockers (1–2 days)**
- Fix B1 (seafood chef robots), B2 (toast), B3 (passive double-pay).
- Delete `index.txt`.
- Self-host Three.js + font (offline-safe load).
- Add WebGL context-loss handling + pause on tab blur.

**Phase 1 — Make it feel like a product (2–4 days)**
- First-run tutorial + station labels + contextual action prompt.
- Settings screen (volume slider, music, safe reset).
- Economy tuning pass (early payouts, store price, robot value, burn decoupling, rolling-rating fail check).
- PWA manifest + service worker + icons + share meta.

**Phase 2 — Retention & polish (3–6 days)**
- Background music + expanded SFX + serve juice/streaks.
- Achievements/milestones tied to cash & skins.
- Camera-zoom-with-expansion; colorblind-friendly bars.

**Phase 3 — Depth (stretch)**
- A genuinely distinct 3rd cuisine.
- Daily-goal / endless-mode framing; soft leaderboard.

---

## 8. Quick wins (highest impact / lowest effort)

1. **Delete `index.txt`** and **self-host Three.js/font** — removes a footgun and the #1 "won't load" risk.
2. **Fix the seafood Chef robot bug (B1)** — a whole feature is currently dead.
3. **Auto-show the tutorial on first launch** — the biggest new-player drop-off fix, and the content already exists.
4. **Add background music + a serve/day-complete SFX** — the single biggest jump in perceived polish.
5. **Bump early-day payouts ~30%** — fixes the slow, grindy opening hour.
