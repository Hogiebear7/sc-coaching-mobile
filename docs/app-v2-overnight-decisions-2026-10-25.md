# App v2 Phase 2 and beyond: decisions made while you were away

Night of 25 October 2026, branch `redesign/app-dashboard-prototype`. Everything is
committed locally; nothing has been pushed. Each decision below is easy to reverse.

1. **Light mode defaults to dark.** It's switched on, but members keep the dark look
   until they choose Light or System in Settings → Preferences → Appearance. Defaulting
   to System would have flipped everyone whose phone is in light mode without asking.
2. **Gold became monochrome on older screens.** Rather than editing about 440 gold uses
   one by one, the old `gold*` tokens now hold the white/navy primary-ink values, and
   real gold moved to `Color.brand`. This means chips, links and accent icons on every
   older screen are white (dark mode) or navy (light mode).
3. **Personal bests stay gold.** The PB toast and the cycle "ovulatory" phase use the
   brand gold.
4. **Small text was raised automatically** in older screens (9–10pt → 12, 11 → 13,
   12 → 14). Tight chips may wrap differently, so check the logger and food logger on
   the phone.
5. **Corners are softer everywhere**: the shared radius tokens went from 4/8/12 to
   8/12/16. The website keeps its sharp corners.
6. **All-caps section labels are now sentence case** (115 of them, keeping acronyms).
   Teko titles still display in capitals through their own style.
7. **The macro pie chart on Nutrition was replaced** by three macro bars in the macro
   colours (MacroFactor-style, easier to read at a glance). The pie component still
   exists if you want it back.
8. **New chart screens**: Weight trend (raw weigh-ins plus a smoothed trend line) and
   Sleep. The Home Weight tile now opens Weight trend instead of Profile, and the Sleep
   tiles open Sleep.
9. **Schedule's segments were renamed** from "Browse / Calendar / My bookings" to
   "Classes / Calendar / Booked".
10. **On Train, the "Generate" and "Import" tools** for members without access show a
    padlock and lead to Membership, replacing the old dimmed upsell tiles.
11. **The goal timeline's numbers and API calls are unchanged.** Only the layout and copy
    changed: consequence tiles, explained summary cards, and "optimistic estimate" wording.
12. **I didn't restructure the workout logger or the food logger.** They only got the
    global passes, because both have had Android crash fixes and need on-device checks
    before any layout surgery.

## Not verified yet

- None of this has been seen on the phone except Phase 1 (build 72). Build 73 contains
  Phase 2 but not the later global passes; a final build follows.
- Light mode has not been seen on a device at all.
- Lint: no new errors. The 57 existing errors in untouched code remain.
