# Mobile build readiness — TestFlight / Play internal testing

Status as of this pass: `npx expo-doctor` reports **20/20 checks passed** —
dependencies and general Expo config are healthy. `eas.json` exists with
`development` / `preview` / `production` profiles. What's still missing is
entirely identity/account setup that only the app owner can decide or
authorize — nothing in this list is a code problem.

## 1. Decisions you need to make before the first store-track build

| # | Decision | Current state | Notes |
|---|---|---|---|
| 1 | **iOS bundle identifier** (e.g. `com.sandccoaching.mobile`) | **Not set.** Deliberately omitted from `app.json` rather than filled with a guessed placeholder — see §2. | Reverse-DNS format, lowercase, no spaces. Cannot be changed once an App Store Connect app record is created under it — if you're unsure, register it once and keep it forever. |
| 2 | **Android package name** (e.g. `com.sandccoaching.mobile`) | **Not set.** Same reasoning as above. | Same format rules; same irreversibility once a Play Console app record exists under it. Doesn't have to match the iOS bundle ID, but matching is the normal convention and simplifies cross-platform tooling. |
| 3 | **App display name** | `"sc-coaching-mobile"` (the raw project slug — shown under the home-screen icon as-is) | Likely want something like `"S&C Coaching"` instead. Change `expo.name` in `app.json`. |
| 4 | **Icons / splash** | ✅ Already real production assets (`assets/images/icon.png`, `splash-icon.png`, Android adaptive-icon layers) — not a blocker. | No action needed unless you want to redesign them. |
| 5 | **Apple Developer account** | Needed for TestFlight. | You need an active Apple Developer Program membership ($99/yr) and its Team ID. `eas build`/`eas submit` will prompt for Apple credentials and can manage signing certificates for you the first time you run them. |
| 6 | **Google Play Console account** | Needed for Play internal testing. | One-time $25 registration fee. `eas submit -p android` needs a service-account JSON key with the right permissions on your Play Console project — created in the Play Console UI. |
| 7 | **Expo/EAS account + project link** | Not yet initialized. | Run `eas login`, then `eas init` from inside `sc-coaching-mobile` — it writes `extra.eas.projectId` into `app.json` automatically. Deliberately not fabricated here for the same "don't guess an identifier" reason as #1/#2. |
| 8 | **Backend URL for device builds** | Already handled correctly for most cases — see `src/constants/config.ts`. `EXPO_PUBLIC_API_BASE_URL` overrides everything; otherwise dev builds default per-platform (`10.0.2.2:3001` Android emulator / `localhost:3001` iOS Simulator) and any **non**-dev bundle — which includes both the `preview` and `production` EAS profiles, not just `production` — defaults to `https://sandccoaching.com`. | The real open question: **is `sandccoaching.com` currently deployed with this branch's nutrition/food-catalog work?** If not yet, either deploy it first, or set `EXPO_PUBLIC_API_BASE_URL` to a reachable staging URL (or your machine's LAN IP, same Wi-Fi, for a same-network device test) before running `eas build`. |
| 9 | **OFF live write** | Stays **disabled** (`OFF_LIVE_WRITE_ENABLED` unset/`false`, no provider configured). | Do not enable for the first internal test build — see `docs/food-catalog.md` in the gym-app repo. |
| 10 | **OCR provider** | Stays **unconfigured** (`lib/ocr-provider.ts`'s `ocrProvider.configured` is hardcoded `false`). | No action needed — this is the correct, honest state for internal testing. Label-scan will always fall back to manual entry, which is expected and already the tested path. |

## 2. Why the identifiers aren't pre-filled

A wrong bundle identifier or package name that accidentally reaches a real
build is hard to undo — once App Store Connect or Play Console has an app
record under an identifier, migrating to a different one means starting
over with reviews, existing installs, and (for Play) is not possible at all
for a published app. A fake-but-valid-looking placeholder (e.g.
`com.example.sccoachingmobile`) could silently slip through into a real
submission if not caught. Omitting the fields entirely means `eas build`
fails immediately with a clear "bundleIdentifier is required" error instead
— a safe failure, not a silent wrong one.

**Once you've decided**, this is exactly what changes in `app.json` — a new
top-level `"ios"` key, and one new line inside the existing `"android"` key
(shown here with the surrounding unchanged content so it's copy-paste-ready,
not illustrative pseudocode):

```json
"ios": {
  "bundleIdentifier": "com.YOUR_CHOICE.sccoachingmobile"
},
"android": {
  "package": "com.YOUR_CHOICE.sccoachingmobile",
  "adaptiveIcon": {
    "backgroundColor": "#0a1526",
    "foregroundImage": "./assets/images/android-icon-foreground.png",
    "backgroundImage": "./assets/images/android-icon-background.png",
    "monochromeImage": "./assets/images/android-icon-monochrome.png"
  },
  "predictiveBackGestureEnabled": false
}
```

Build numbers/version codes don't need manual values — `eas.json`'s
`"appVersionSource": "remote"` means EAS tracks and auto-increments them for
you.

## 3. Camera/media config audit (this pass)

- `expo-camera`'s config plugin now explicitly sets `microphonePermission:
  false` and `recordAudioAndroid: false` — the app only ever calls
  `takePictureAsync` (barcode/label/submission photos), never records audio
  or video, so it shouldn't request `NSMicrophoneUsageDescription` /
  `RECORD_AUDIO` at all. Previously the plugin's default behavior would have
  requested both silently.
- `NSCameraUsageDescription` (iOS) and `android.permission.CAMERA`
  (Android) are still requested, with the existing member-facing copy —
  unchanged, already correct.
- `expo-image-manipulator` needs no plugin entry or permission — it only
  reads/writes its own cache files, never touches the photo library.
- No `ios.infoPlist` photo-library permission is needed for the same
  reason.
- Denied-permission and camera-unavailable fallbacks
  (`src/components/nutrition/CameraPermissionGate.tsx`) are code-complete
  and were reasoned through in the previous pass — they still cannot be
  exercised in the web preview and remain a real-device verification item
  (see the checklist in §5).

## 4. Internal-testing runbook

### One-time setup (do once, in order)

1. `npx eas-cli login` — sign in with (or create) an Expo account.
2. From `sc-coaching-mobile/`: `npx eas-cli init` — links this project to
   your Expo account and writes `extra.eas.projectId` into `app.json`.
3. Fill in `ios.bundleIdentifier` and `android.package` in `app.json` per §2.
4. Point the app's API base URL at a reachable backend (§1 item 8).
5. iOS only: `npx eas-cli device:create` — register the specific iPhones/
   iPads you'll test on (needed for `preview`/`development` ad-hoc installs;
   NOT needed if you go straight to TestFlight builds).

### Build for a first device test (fastest path — no store review)

```bash
npx eas-cli build --profile preview --platform ios
npx eas-cli build --profile preview --platform android
```

This is Expo's own **internal distribution** — not the same thing as
"TestFlight internal testing" or "Play internal testing track" (see the
callout below). It produces a build you install directly on a registered
device via a QR code / link EAS gives you after the build finishes, with no
Apple/Play review wait. Use this for the very first "does it even run on a
real phone" pass.

> **Terminology note:** EAS's `"distribution": "internal"` (used by the
> `preview`/`development` profiles above) means *install directly, skip the
> store entirely* — good for the fastest first test, but each new iOS
> tester's device must be registered first (`eas device:create`). It is a
> different thing from Apple's **TestFlight** or Google Play's **internal
> testing track**, which both require the build to actually go through
> App Store Connect / Play Console (§ below) — more setup, but testers just
> install from TestFlight/Play like a normal app, no device registration.

### Build + submit for TestFlight / Play internal testing track

```bash
npx eas-cli build --profile production --platform ios
npx eas-cli submit -p ios --latest
# → then add the build to an internal testing group in App Store Connect

npx eas-cli build --profile production --platform android
npx eas-cli submit -p android --latest
# → then promote the release to the "Internal testing" track in Play Console
```

### Installing and running on device

- **iOS (ad-hoc/`preview`)**: open the link/QR code EAS prints after the
  build; Settings → General → VPN & Device Management → trust the developer
  profile if prompted.
- **iOS (TestFlight)**: install the TestFlight app, accept the internal
  tester invite, install from there.
- **Android (`preview` APK)**: open the link EAS prints, allow "install
  unknown apps" for the browser/Files app when prompted.
- **Android (Play internal track)**: accept the internal tester invite
  link, install from the Play Store.

### Nutrition flow device test checklist

Run this pass on both a real iPhone and a real Android device — pulled
directly from the checklist already documented in gym-app's
`docs/food-catalog.md` (kept there since it's about app behavior, not build
config; not duplicated here):

- [ ] Barcode scan — success path
- [ ] Barcode scan — miss path (forwards to label-scan)
- [ ] Permission denied — both "can re-prompt" and "permanently denied →
      Open Settings" states, on barcode-scan, label-scan, and submit-food
- [ ] Label-scan capture path (photo compresses, "Photo captured"
      confirmation renders)
- [ ] Submission with photos (front + label capture, both slots fill
      independently)
- [ ] Cancellation / back-out mid-capture on each camera screen

### Recording issues found during device testing

Keep it simple — a running list is enough for a first internal pass:

```
Device: [iPhone 15 / Pixel 8 / etc.]  OS version: [...]  Build profile: [preview/production]
1. [Screen/flow] — [what happened] — [expected instead]
2. ...
```

File anything found as a normal follow-up task once the pass is done —
this doc doesn't need to become that tracker.

## 5. What stays out of scope for the first internal build

- OFF live write: **off**. No env var, no provider — do not turn on for
  internal testing.
- OCR provider: **unconfigured**. Label-scan's manual-entry fallback is the
  expected, tested behavior.
- No unrelated feature work, backend changes, or broad UI changes were made
  in this pass — this is build/config scaffolding only.
