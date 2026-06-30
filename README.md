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
- 12 unlockable chef **skins**
- **Achievements** with cash & skin rewards, plus lifetime **records**
- **Settings**: volume, background music, colorblind-friendly bars,
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

## Development notes

- All gameplay lives in one inert `<script type="text/gamejs">` block that the
  in-page loader executes once Three.js and the DOM are ready.
- Validate changes without a browser via a syntax check:
  ```
  # extract and check the game script
  node --check <(sed -n '/text\/gamejs/,/<\/script>/p' index.html)
  ```
  (Or copy the script body to a `.js` file and run `node --check`.)
