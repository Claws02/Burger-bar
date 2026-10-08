# 🍔 Burger Bar

A 3D cooking & restaurant tycoon game for iPhone (and the web). Grill burgers,
serve impatient customers, earn stars and tips, and grow a tiny diner into a
staffed, neon-lit Day-20 machine.

Built with [Three.js](https://threejs.org/) r128 and plain JavaScript (no
bundler), wrapped for iOS with [Capacitor](https://capacitorjs.com/) 8.

## Layout

```
www/                    the game — Capacitor's web dir, also a static website
  index.html            markup only
  css/game.css          all styles (safe-area aware; launch polish at the end)
  js/boot.js            loader: Capacitor bridge → Three.js → game files, in order
  js/native.js          iOS bridge: save mirror to UserDefaults, haptics, splash, lifecycle
  js/vendor/            three.min.js (r128), capacitor.js — shipped in the bundle
  js/game/*.js          the game, as ordered classic scripts sharing one scope
  fonts/, icons/        Nunito (OFL), PWA / apple-touch icons
ios/                    Xcode project (Swift Package Manager, no CocoaPods)
store/                  App Store icon (1024, opaque) and 6.9" screenshots
tests/                  headless test suite (real game code, stubbed THREE + DOM)
tools/                  browser smoke/perf runs, art + screenshot renderers, checks
docs/                   architecture, audits, App Store release guide
archive/                the parked multi-map build
```

The game files load in the order listed in `www/js/boot.js` (`GAME_FILES`).
Code that runs at load time may only call functions from the same or an
earlier file; `npm run check` enforces that.

| File | What lives there |
|------|------------------|
| `00-settings-audio` | settings, synthesized SFX/music, haptics |
| `01-renderer` | renderer, colour pipeline, lights, quality tiers, shared materials/geometry |
| `01a-modelkit` | rounded boxes, canvas textures, signage, `bake()` mesh merging |
| `02-world` | scenery, room + decor tiers, station models, upgrade tiers, station batching |
| `03-items` | food/tray models (baked) |
| `04-state-save` | game data, save/load with backup recovery |
| `05-player` … `06-shop-edit` | player, collision, edit mode, shop |
| `07-progress` | achievements, daily goals |
| `07a-adaptive` | **Kitchen Heat** adaptive difficulty, lunch rushes |
| `08-home` | home screen chef + live bar showcase |
| `09-menus-dayflow` | menus, settings, day start/end, results |
| `10-customers` … `12-robots` | customers, actions, robot AI |
| `13-hud-input` | pooled floating UI, touch/keyboard input |
| `14-main` | boot sequence and main loop |

## Run it

```bash
npm install            # Capacitor packages (only needed for iOS)
npm run serve          # http://localhost:8000 — or open www/index.html
```

## Test it

```bash
npm test               # load-order check + 58 headless tests
npm run test:native    # simulated iOS bridge: save restore/mirror, splash, haptics
npm run perf           # Day-20 full-restaurant run in headless Chromium
npm run visual         # screenshot tour (landscape) → .smoke/visual
npm run portrait       # screenshot tour (portrait)  → .smoke/portrait
```

## Ship it (iOS)

```bash
npm run ios:sync       # copy www/ into the Xcode project
npm run ios:open       # open in Xcode (macOS)
```

Full checklist, metadata and privacy answers: [`docs/APP_STORE.md`](docs/APP_STORE.md).

## How the game gets harder

- **The day number** sets the baseline: more customers per day up to 28, then
  more simultaneous arrivals and tighter patience. New mechanics arrive one at a
  time (combos, VIPs on Day 8, busy hours on Day 10, big appetites on Day 12, fries on Day 11).
- **Kitchen Heat** follows the player. Each consecutive calendar day played
  warms the kitchen: shorter patience, quicker arrivals, extra arrival slots, more
  VIPs, lunch rushes, and stiffer daily goals — and every point of heat also
  raises tips. Miss days and it cools off; the first shift or two back are
  eased in with extra patience and softer goals. Recent performance nudges heat
  up or down so a struggling daily player isn't buried. Never applies on the
  tutorial days; Casual halves it. Tuning: `HEAT` in `07a-adaptive.js`.

## Docs

- [`docs/APP_STORE.md`](docs/APP_STORE.md) — release checklist, store listing, privacy
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stations, state machines, economy, save format
- [`docs/AUDIT.md`](docs/AUDIT.md) — the earlier technical & design audit
