# Burger Bar — Playing Together

Two ways to play with someone else, both free (no servers, no fees beyond the
Apple Developer Program you already have). Both are iPhone/iPad only; the web
version stays single-player.

| | Live co-op | Shared bar |
|---|---|---|
| What | Two phones in the **same restaurant at the same time** | A restaurant **two players own**; either can run it |
| Apple service | Game Center (real-time match, Apple relays the traffic) | iCloud / CloudKit (a shared record zone) |
| Whose bar | The inviter's (host) | Both partners' |
| Money | Sales go to the host's bar; the helper keeps the **tips** on plates they serve, paid into the helper's own bar | All of it stays in the shared bar |
| At the same time? | Yes, that's the point | One partner runs it at a time; the other joins live through a co-op invite |

---

## How live co-op works

- **Host-authoritative.** The host's phone runs the restaurant exactly as in
  single player. The guest's phone loads a copy of the host's stores, moves its
  own chef locally (so movement feels instant), and sends its position about 15
  times a second plus every ACT press.
- The host runs each guest action **as if the guest's chef were standing
  there** (`coopRunAsGuest` in `13b-coop.js`): same store, position, facing and
  hands. Everything else (serving, plating, the sink, robots planning around
  what the guest carries) works unchanged.
- About 10 times a second the host sends a **snapshot**: every store's customers,
  stations, trays, robots and cash, both chefs' hands, plus floating text and
  sounds to replay. The guest smooths it and never simulates customers or
  robots itself, so the two screens can't disagree.
- **Free for all:** both players can do every job.
- **Tips:** the "tip" on a plate is everything above its menu price (mastery
  tip, Kitchen Heat, rush and streak bonuses). When the guest served it, that
  part goes into the **guest's own saved bar** right away. In a shared bar
  there's no split.
- **Between shifts** only the host shops and edits; the guest sees "Waiting
  for … to start the next shift". The host's PLAY starts the shift on both phones.
- **Leaving / dropping:** either player can leave. A silent connection is
  dropped after 12 s. The guest always goes back to their own bar, which was never
  touched while visiting (`saveGame` is a no-op for a guest).
- Messages bigger than 60 KB (a large three-store restaurant) are split into
  pieces, because Game Center caps one reliable message near 87 KB.

## How the shared bar works

- One CloudKit record (`SharedBar/bar`) in its own zone in the **owner's**
  private iCloud database. The whole zone is shared with the partner, who reads
  and writes it through their shared database. The save is a JSON file
  (`CKAsset`).
- **One at a time:** opening the bar takes a lock, saved with "only if nobody
  changed it since I read it", so two phones can't both win. The lock is renewed
  by every save (at most every 10 s while playing, at the end of every shift and
  when the app goes to the background, plus a heartbeat every 4 min). It frees
  itself after **15 minutes** if a phone vanishes without closing. A partner who
  finds it locked is told to ask for a co-op invite instead.
- While the shared bar is open, the restaurant saves to iCloud and only the
  player's own things (skins, achievements, records, Kitchen Heat) save
  locally, so their own bar is never overwritten.
- To play it together: whoever has it open invites the other through
  **👥 Together → Invite a friend**. It's normal co-op, without the tip split.

## Code map

| File | What |
|---|---|
| `www/js/game/13b-coop.js` | Co-op session, links (Game Center, browser tabs, tests), snapshots, the partner's chef, screens |
| `www/js/game/13c-sharedbar.js` | Shared-bar mode, save routing, lock heartbeat, the dev/test stand-in backend |
| `ios/App/App/CoopPlugin.swift` | Game Center: invite-only matchmaking, accepting invites, send/receive, disconnects |
| `ios/App/App/SharedBarPlugin.swift` | CloudKit: create + share, invite sheet, open/lock, save, close |
| `ios/App/App/SceneDelegate.swift` | Accepts a shared-bar invite link (`userDidAcceptCloudKitShareWith`) |
| `ios/App/App/MainViewController.swift` | Registers the three app plugins |

---

## One-time setup in Xcode and Apple's portals

1. **Xcode → App target → Signing & Capabilities**
   - **Game Center**: already on.
   - **+ Capability → iCloud**, tick **CloudKit**, and add/choose the container
     **`iCloud.com.clawengineering.burgerbar`**. The entitlements file already
     lists it; with automatic signing Xcode creates the container for you.
2. **App Store Connect → your app → Game Center**: already enabled for
   leaderboards. Nothing extra is needed for invite-only matches.
3. **CloudKit Console** (icloud.developer.apple.com), after you've created and
   played a shared bar once from a development build:
   - Open the container → **Schema** → check the `SharedBar` record type exists
     (fields `name`, `save`, `lockOwner`, `lockName`, `lockAt`).
   - **Deploy Schema Changes… to Production.** Without this, TestFlight and
     App Store builds can't create shared bars (they use the Production
     environment).
4. Privacy: nothing is collected by you. Co-op traffic goes phone-to-phone
   through Game Center, and the shared bar lives in the players' own iCloud. The
   App Privacy answers don't change.

## Fixed along the way

`SceneDelegate` created the screen with a plain `CAPBridgeViewController`, so
**the Game Center plugin was never registered on the screen you see**. That
means leaderboards were most likely silently off on device. At the same time,
`Info.plist` also told iOS to load `Main.storyboard` for the scene, which built
a second, hidden `MainViewController` (and a second copy of the game) that the
`SceneDelegate` then covered up. Now `SceneDelegate` builds the only screen,
with `MainViewController`, and the scene no longer loads the storyboard.

## Test it (two devices, two Apple IDs)

The browser and test-suite versions are already covered:
`npm test` §16, and two browser tabs at `index.html?coop` (developer mode:
"Host in this tab" / "Join from this tab", plus a stand-in shared bar). The
native parts need real devices:

**First: the app still starts.** The screen setup changed (see "Fixed along
the way"). Check that the app launches to the home screen, that there's no
doubled music, and that 🏆 Ranks now opens Game Center.

**Live co-op**
- [ ] Both phones signed into Game Center and friends with each other.
- [ ] Phone A: 👥 Together → Invite a friend → pick B. Phone B: tap the
      invite notification → the match starts; B shows "getting the bar ready".
- [ ] A presses PLAY: B's shift starts. Both see each other's chef (blue ring + name).
- [ ] B grabs a patty, grills it, plates it, serves it: A sees each step.
- [ ] B holds ACT at the sink with a dirty tray: it becomes clean after ~3 s on both.
- [ ] B serves a group: after they eat, B gets "+$… tip". End the shift: B's
      results mention the tips. B leaves: B's own bar shows the extra cash.
- [ ] With a second store (Day 20+): B walks next door and works there.
- [ ] Put B's app in the background for 15+ s: A gets "Your partner left";
      B returns to their own bar.

**Shared bar**
- [ ] Both phones signed into iCloud.
- [ ] A: 👥 Together → Create a shared bar → the share sheet opens → send the
      link to B in Messages. B taps it → "You joined Our Burger Bar!".
- [ ] A opens it and plays a shift. B tries to open it → "🔒 … is running the
      shared bar".
- [ ] A: Back to my bar. B opens it → sees A's progress (day, cash, purchases).
- [ ] B opens it and invites A to co-op: no tip split, both play the shared bar.
- [ ] Force-quit the phone that has it open; after 15 min the other can open it.
- [ ] Both players' own bars are unchanged throughout.
