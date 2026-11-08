# Burger Bar — context for Claude

3D cooking/restaurant tycoon for iPhone and web. three.js **r128**, plain JS,
no bundler, Capacitor 8 iOS (Swift Package Manager). Online co-op via Game
Center (app) or MQTT lobby + WebRTC (web); shared bar via iCloud.

## Run / verify

```
npm run serve          # www/ on :8000
npm test               # load-order check + 66 headless tests (stubbed THREE + DOM)
npm run test:native    # simulated iOS bridge: save mirror, splash, haptics
npm run perf           # Day-20 full restaurant, headless Chromium
npm run visual | portrait   # screenshot tours → .smoke/
```

## The one architectural rule

`www/js/game/*.js` are **classic scripts sharing one global scope**, loaded in
the order of `GAME_FILES` in `www/js/boot.js`. Code that runs at load time may
only call functions from the same or an earlier file. `npm run check` enforces
it. A new file gets a numbered name in that order and an entry in `GAME_FILES`.
No `import`/`export` in game files.

## Map (file → system; README has the full table)

`00` settings/audio/haptics · `01` renderer, quality tiers, shared materials ·
`01a` model kit + `bake()` merging · `02` world/stations · `04` state + save
(backup recovery) · `04a` multi-store street · `07a` Kitchen Heat adaptive
difficulty (`HEAT`) · `09` menus/dayflow (948 lines) · `10–12a` customers,
actions, robots + A* · `13*` HUD/input, tutorial, co-op, shared bar, web link ·
`14` boot + main loop. `www/js/native.js` = iOS bridge.

## Rules

- Save format changes: `docs/ARCHITECTURE.md` save section + a migration + a test in `tests/run.js`. Saves mirror to UserDefaults in the app.
- Balance numbers live in `docs/BALANCE.md` and the named constants. Change both.
- `archive/` is a parked build (incl. Seafood Shack). Don't read it or revive from it unasked.

## Docs (read on demand)

Architecture/save format → `docs/ARCHITECTURE.md` · co-op → `docs/MULTIPLAYER.md` ·
tuning → `docs/BALANCE.md` · release → `docs/APP_STORE.md`. `AUDIT.md`, `REVIEW.md`,
`PROPOSAL.md` are history.

## Token rules

Don't read `www/js/vendor/`, `ios/`, `store/`, `archive/`, `.smoke/`.
`tests/run.js` is 1.5k lines: grep for the test you need.
