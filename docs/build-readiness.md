# Mobile build readiness — TestFlight / Play internal testing

Status as of this pass: `npx expo-doctor` reports **20/20 checks passed** —
dependencies and general Expo config are healthy. `eas.json` exists with
`development` / `preview` / `production` profiles. App identity is now
wired into `app.json`. What's left is exclusively account-bound setup only
you can do (Expo login, Apple/Google accounts) — nothing left in this list
is a code problem.

## Quick start — exact sequence for the first device build

Run these from `sc-coaching-mobile/`, in order. Full detail on each step is
in §4 below.

```bash
# Confirm/resolve decision #8 first (see table below) — set this if
# sandccoaching.com isn't yet deployed with this branch's nutrition work:
#   EXPO_PUBLIC_API_BASE_URL=https://your-reachable-backend

npx eas-cli login              # 1. your Expo account
npx eas-cli init                # 2. links this project, writes projectId into app.json
npx eas-cli device:create        # 3. iOS only — register your test iPhone/iPad

npx eas-cli build --profile preview --platform ios      # 4a. first iOS build
npx eas-cli build --profile preview --platform android  # 4b. first Android build

# 5. Install: open the link/QR code each build command prints, on the
#    device itself. See "Installing and running on device" in §4.

# 6. Begin the nutrition/camera device test checklist in §4.
```

## 1. Decisions

| # | Decision | Status | Notes |
|---|---|---|---|
| 1 | **iOS bundle identifier** | ✅ Set — `com.sandcperformancecoaching.app` (`app.json` → `expo.ios.bundleIdentifier`) | Reverse-DNS, cannot change once an App Store Connect record exists under it. |
| 2 | **Android package name** | ✅ Set — `com.sandcperformancecoaching.app` (`app.json` → `expo.android.package`) | Matches the iOS identifier by convention. Cannot change once a Play Console record exists under it. |
| 3 | **App display name** | ✅ Set — `expo.name` = `"S&C Performance Coaching"` (full name: App Store/Play listing, Android home-screen label). iOS home-screen label overridden shorter via `expo.ios.infoPlist.CFBundleDisplayName` = `"S&C Performance"` to avoid truncation on the springboard. | Android has no equivalent first-class "short label" field in Expo config — if `"S&C Performance Coaching"` truncates awkwardly on a real Android device during testing, that needs a native resource override (out of scope for this pass; note it if device testing surfaces it). |
| 4 | **Icons / splash** | ✅ Already real production assets — not a blocker. | No action needed. |
| 5 | **Apple Developer account** | ⏳ Your action | Active Apple Developer Program membership ($99/yr) + Team ID. `eas build`/`eas submit` prompt for this and can manage signing certificates for you the first time. |
| 6 | **Google Play Console account** | ⏳ Your action | One-time $25 registration. `eas submit -p android` needs a service-account JSON key from the Play Console UI. |
| 7 | **Expo/EAS account + project link** | ⏳ Your action — **not run in this pass** (no Expo credentials available in this environment; confirmed via `eas whoami` → "Not logged in") | Run `eas login` then `eas init` yourself — see §4. It writes `extra.eas.projectId` into `app.json` automatically; not fabricated here for the same reason the identifiers weren't guessed. |
| 8 | **Backend URL for device builds** | ⚠️ Needs your confirmation | See `src/constants/config.ts`. `EXPO_PUBLIC_API_BASE_URL` overrides everything; otherwise any non-dev bundle (both `preview` and `production` EAS profiles) defaults to `https://sandccoaching.com`. **Open question: is that domain currently deployed with this branch's nutrition/food-catalog work?** If not, either deploy first or set `EXPO_PUBLIC_API_BASE_URL` to a reachable staging URL / your LAN IP before building. |
| 9 | **OFF live write** | ✅ Stays disabled (`OFF_LIVE_WRITE_ENABLED` unset/`false`, no provider configured) | Do not enable for internal testing — see `docs/food-catalog.md` in the gym-app repo. |
| 10 | **OCR provider** | ✅ Stays unconfigured (`ocrProvider.configured` hardcoded `false`) | Label-scan's manual-entry fallback is the expected, already-tested behavior. |

## 2. What changed in `app.json` this pass

```json
"name": "S&C Performance Coaching",
"ios": {
  "bundleIdentifier": "com.sandcperformancecoaching.app",
  "infoPlist": {
    "CFBundleDisplayName": "S&C Performance"
  }
},
"android": {
  "package": "com.sandcperformancecoaching.app",
  "adaptiveIcon": { /* unchanged */ },
  "predictiveBackGestureEnabled": false
}
```

`slug` (`sc-coaching-mobile`) was deliberately left unchanged — it's an
internal/URL identifier (becomes part of the EAS project once `eas init`
runs), not user-facing, and wasn't part of the requested identity values.

Build numbers/version codes still need no manual values — `eas.json`'s
`"appVersionSource": "remote"` means EAS tracks and auto-increments them.

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

### One-time setup (do once, in order — none of this has been run yet)

App identity (bundle ID, package name, display name) is already wired into
`app.json` — nothing further to edit there before running these:

```bash
# 1. From sc-coaching-mobile/ — sign in with (or create) an Expo account.
npx eas-cli login

# 2. Links this project to your Expo account. Auto-writes
#    extra.eas.projectId into app.json — you'll see the diff; commit it.
npx eas-cli init

# 3. iOS only — register the specific iPhones/iPads you'll test on.
#    Needed for the preview/development ad-hoc install path below; NOT
#    needed if you go straight to a TestFlight build instead.
#    Follow the prompts — it opens a registration page for you to load on
#    the device itself, or lets you enter a UDID directly.
npx eas-cli device:create
```

Before the first build, also resolve decision #8 above (confirm or point
`EXPO_PUBLIC_API_BASE_URL` at a backend that actually has this branch's
nutrition work deployed).

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
