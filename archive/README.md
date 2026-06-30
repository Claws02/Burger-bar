# Archive

Maps/builds parked here while we **master the first Burger Bar** before adding
more locations. Nothing here is loaded by the live game.

| File | What it is |
|------|------------|
| `index-multimap-backup.html` | A complete, runnable snapshot of the previous **multi-map** build — Burger Bar #1, the **Seafood Shack**, and the three franchise reskins (Downtown Diner, Westside Grill, East End Kitchen) wired into the multi-store empire system. |

## Why it's archived

The live `index.html` now runs in **single-bar mode** (Burger Bar #1 only). The
other "maps" and the multi-store empire were disabled — not deleted — so we can
fully test and tune one bar's cook/deliver loops first. See
[`../ARCHITECTURE.md`](../ARCHITECTURE.md) → *Single-bar mode* for exactly what
changed and how to re-enable the other maps later.

## Restoring a map

`index-multimap-backup.html` is self-contained: open it directly in a browser to
play the old multi-map build. To bring the other maps back into the live game,
follow the re-enable steps in `ARCHITECTURE.md` (restore the extra `defStore`
calls, un-pin `activeStoreIdx`, unhide the Stores button and store-swipe
controls) — this backup is the reference for the seafood/franchise scene + recipe
code.
</content>
