# 🍔 Burger Bar

A fast, fun **3D cooking & restaurant tycoon** game that runs entirely in the
browser — built with [Three.js](https://threejs.org/) in a single `index.html`,
mobile-first, with no build step.

Grill burgers (or grill fish at the Seafood Shack), serve impatient customers,
earn cash & star ratings, then reinvest in faster gear, more tables, robot staff
and new store locations as you build a food empire.

## Play

Just open `index.html` in any modern browser, or host the folder on any static
web host (GitHub Pages, itch.io, Netlify, etc.).

```
# quick local server
python3 -m http.server 8000
# then visit http://localhost:8000
```

> The game loads Three.js from a CDN with automatic fallback across multiple
> CDNs. For fully offline play, drop a local `three.min.js` (r128) next to
> `index.html` and point the loader at it.

## Controls

- **Move:** left thumb drag (virtual joystick) or `WASD` / arrow keys
- **Act:** right thumb button or `Spacebar` (pick up, place, cook, serve, wash)
- The button shows a contextual prompt for what it will do.

## Core loop

1. Customers arrive each **day** and sit at tables.
2. Run the line: **Fridge → Grill → Tray → Counter (assemble) → Table (serve)**.
3. Bus dirty trays → **Sink** (hold to wash) → **Tray Rack**.
4. Serve fast for more **stars** and bigger **tips** (build a serve streak!).
5. Spend cash in the **Shop**; rearrange with **Edit Mode**.
6. Hire **robots** (Chef / Waiter / Busser), open new **stores**, earn passive income.

> **Single-bar focus:** the game currently runs in **single-bar mode** — only
> **Burger Bar #1** is active so we can master one bar's cook/deliver loop first.
> The Seafood Shack and franchise reskins are parked in
> [`archive/`](archive/) and the multi-store empire is temporarily disabled. See
> [`ARCHITECTURE.md`](ARCHITECTURE.md) for the complete first-bar design and how
> to re-enable the other maps.

## Features

- The **Burger Bar** cook/serve line (fridge → grill → tray → counter → table)
- A dozen **characters** — the classic human chef plus animals (cat, bear,
  penguin, frog, dino, bunny) and objects (burger, toaster, robot, avocado,
  mug) — with a 🎲 *Surprise me* roll. Characters are body shapes; the 12
  unlockable **skins** recolour whichever one you pick.
- **Achievements** with cash & skin rewards, plus lifetime **records**
- **Daily goals** visible while you play, from a button in the top-left
- **Settings**: volume, background music, colorblind-friendly bars,
  order text labels, larger text,
  Casual difficulty, and save export/import
- Installable as a **PWA** (web app manifest + icons included)
- Saves locally via `localStorage` (with backup codes for transfer)

## Project layout

| File | Purpose |
|------|---------|
| `index.html` | The entire game (markup, styles, and code) |
| `ARCHITECTURE.md` | Complete first-bar architecture: stations, cook/deliver recipes, economy, achievements |
| `archive/` | Parked multi-map build + notes (see single-bar mode) |
| `manifest.json` | PWA web app manifest |
| `icon.svg` | App / favicon icon |
| `PROPOSAL.md` | Design review, roadmap, and implementation status |
| `AUDIT.md` | Full technical & design audit: bugs, the crash root-cause, architecture |
| `tests/` | Headless test suite (`node tests/run.js`) — no build step, no network |

## Development notes

- All gameplay lives in one inert `<script type="text/gamejs">` block that the
  in-page loader executes once Three.js and the DOM are ready.
- **Run the test suite** (no install, no network, no browser needed):
  ```
  node tests/run.js
  ```
  It boots the *real* game script from `index.html` in a Node `vm` against a
  stubbed Three.js + DOM (`tests/harness.js`), then drives simulated days frame
  by frame. The Three.js stub counts every geometry and material created vs.
  disposed, which is what turns "does it leak GPU memory" into a number.

  Covers: GPU-resource disposal, an exhaustive robot state-machine sweep
  (every role × every held item), the tray economy, day pacing, and the
  player-feedback layer. A full staffed day is driven end to end.

  To A/B against another revision:
  ```
  git show <rev>:index.html > /tmp/old.html
  BURGERBAR_INDEX=/tmp/old.html node tests/run.js
  ```

- See [`AUDIT.md`](AUDIT.md) for the full technical and design audit.
