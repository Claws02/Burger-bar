# App Store release guide

Everything that can be prepared without a Mac is done. The remaining steps need
macOS with Xcode and an Apple Developer Program membership.

## 0. Decisions to confirm

| Item | Current value | Where |
|------|---------------|-------|
| Bundle ID | `com.clawengineering.burgerbar` | `capacitor.config.json`, Xcode target |
| Display name | Burger Bar | `ios/App/App/Info.plist` |
| Devices | iPhone only, portrait | `TARGETED_DEVICE_FAMILY = 1`, Info.plist orientations |
| Minimum iOS | 15.0 | Capacitor 8 default |
| Version / build | 1.0 / 1 | Xcode target → General |

The bundle ID must be registered to *your* team. If "Burger Bar" is taken on
the store, the store name can differ from the home-screen name (e.g. "Burger
Bar: Diner Rush").

## 1. Build on the Mac

```bash
git clone <repo> && cd Burger-bar
npm ci
npm run ios:sync          # copies www/ into ios/App/App/public
npm run ios:open          # opens Xcode
```

In Xcode:

1. Select the **App** target → *Signing & Capabilities* → choose your Team.
   Keep "Automatically manage signing".
2. Pick a real iPhone and **Run**. Play through Day 1 with sound on; then
   background the app mid-shift, return, and confirm the pause screen shows.
3. *Product → Archive* → *Distribute App* → *App Store Connect* → Upload.

Swift Package Manager fetches `capacitor-swift-pm` on first open; no CocoaPods.

## 2. Device test pass (do this before submitting)

- [ ] Cold launch: native splash → CLAW splash → home, no white flash
- [ ] Notch / Dynamic Island: HUD, home top bar and pause button clear of it
- [ ] Home indicator: nothing important under it; joystick works near the bottom
- [ ] Day 1 → results → shop → buy Turbo Grill → the grill model changes
- [ ] Haptics on serve / wrong plate / rush; Settings → Vibration off silences them
- [ ] Settings → Graphics: Auto / High / Battery Saver all render
- [ ] Kill the app from the switcher, relaunch: progress intact
- [ ] Offline (airplane mode): launches and plays normally
- [ ] Older device if you have one (iPhone XR/11 class): Day 20 bar stays smooth;
      Auto graphics should drop to a lower tier by itself if not
- [ ] Silent switch on: game audio is muted (WKWebView Web Audio follows the switch)

## 3. App Store Connect listing (draft)

**Name:** Burger Bar
**Subtitle (30):** Cook, serve & grow your diner
**Category:** Games → Casual (secondary: Simulation)
**Price:** your call. There are no in-app purchases or ads in this build.

**Promotional text (170):**
> Fire up the grill! Serve hungry guests, chase serve streaks, and turn a tiny
> burger joint into the busiest neon diner in town.

**Description:**
> Burger Bar is a fast, cozy cooking game you play with two thumbs.
>
> 🍔 RUN THE LINE — Grab patties, grill them just right, plate them on trays and
> race them to the right seat before patience runs out.
>
> 🔥 GET HOT — Play every day and the kitchen heats up: busier rushes, pickier
> guests, bigger tips. Take a break and it eases you back in.
>
> 🛠️ UPGRADE EVERYTHING — Turbo grills, roller skates, a soda fountain, a fry
> station, fancy decor and a jukebox. Every upgrade shows up in your diner.
>
> 🤖 HIRE ROBOTS — Chef, waiter and busser bots learn on the job and level up.
>
> 🎯 DAILY GOALS & ACHIEVEMENTS — Fresh challenges every shift.
>
> 👨‍🍳 BE ANYONE — A dozen characters and skins, from a classic chef to a toaster.
>
> Plays fully offline. No ads. No accounts.

**Keywords (100):** `cooking,restaurant,diner,burger,chef,tycoon,serve,kitchen,food,casual,arcade,time management`

**Support URL / Marketing URL:** required: a simple page (GitHub Pages works).
**Privacy Policy URL:** required for all apps. Text below.

## 4. Privacy

**App Privacy questionnaire:** *Data Not Collected.* The app makes no network
requests, has no analytics, ads, accounts or tracking. Progress is stored only
on the device (WKWebView storage mirrored to UserDefaults).

`ios/App/App/PrivacyInfo.xcprivacy` declares: no tracking, no collected data,
UserDefaults accessed for reason `CA92.1` (app-own data).

**Privacy policy text** (host it at your Privacy Policy URL):
> Burger Bar does not collect, store, or share any personal information. Game
> progress is saved only on your device. The app does not use analytics,
> advertising, or tracking, and makes no network connections.

## 5. Age rating

Answer **None** to every content question → **4+**.

## 6. Export compliance

`ITSAppUsesNonExemptEncryption = NO` is set in Info.plist, so uploads skip the
encryption question.

## 7. Screenshots

`store/screenshots/` holds 6.9" iPhone shots (1320×2868), captured from the
real game by `npm run screenshots`. App Store Connect scales them for smaller
iPhones. Consider adding captions/frames in a design tool. Apple allows
marketing overlays, but the gameplay itself must be real.

Icon: `store/app-icon-1024.png` (opaque RGB, already in the Xcode asset catalog).
Regenerate art with `npm run art`.

## 8. Review notes (paste into "Notes for reviewer")

> Burger Bar is a self-contained offline game. No login is required. Tap PLAY
> DAY to start; drag on the left half of the screen to move and tap the right
> half to act. Settings has volume, accessibility and graphics options.

## Known risks

- **Guideline 4.2 (minimum functionality)** applies to web-wrapped apps. This
  build ships all code and assets in the bundle, works offline, and uses native
  haptics, status-bar and lifecycle integration. That is the usual bar for games,
  but it is a judgement call by the reviewer.
- **Not verified on hardware from this environment:** real-device frame rate,
  haptics feel, audio routing, Xcode archive. Section 2 covers them.
