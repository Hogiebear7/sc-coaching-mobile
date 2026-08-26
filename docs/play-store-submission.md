# Play Store submission — reference doc

Drafted content for the Play Console listing. Copy/paste the relevant
section into the matching Play Console field. Nothing here can be
submitted directly — Play Console access is account-bound (see
`docs/build-readiness.md` and the main plan for what's still the user's
action).

---

## Store listing

**App name** (already set in `app.json`): S&C Performance Coaching

**Short description** (≤80 characters, shown under the app name in search):

```
Personal coaching, workouts, nutrition, and recovery — all in one app.
```
(72 characters)

**Full description** (shown on the store listing page):

```
S&C Performance Coaching is the member app for S&C Performance Coaching in
Navan, Co. Meath — built around real coaching, not a generic template.

Every member's programme starts with their own goals and baseline, coached
in small groups where every rep gets watched. This app is where that
coaching continues between sessions: log your training, track your
nutrition, monitor your recovery, and stay connected with your coach.

TRAINING
• Follow programmes your coach builds for you, or log sessions freely
• Full set-by-set logging — weight, reps, RIR, supersets, dropsets, and more
• Rest timer and plate calculator built in
• Track progression over time for every exercise, with weekly training
  trend charts
• Personal bests and recent records, tracked automatically

NUTRITION
• Log food by search, barcode scan, or photo
• Daily targets set by your coach, with a clear macro breakdown
• Body-weight check-ins with trend charts
• Sports-performance drink calculator tailored to your sweat rate and
  session length

RECOVERY
• Daily readiness check-ins — sleep, soreness, and fatigue — with a clear
  0–100 score and guidance for how hard to push that day
• Optional, private cycle tracking with gender-based recovery guidance,
  visible only to you unless you choose to share it with your coach
• 7-day training load and 14-day readiness trends

SCHEDULE & COACHING
• Browse and book classes, manage your bookings, and see your attendance
  history
• Message your coach directly — questions, form checks, and check-ins
  without leaving the app
• Manage your membership and see your plan at a glance

Built and coached by a highly qualified coach with 15+ years of hands-on
experience — this app is the training log and coaching connection for
members already training with us, not a generic fitness tracker.
```

**Category**: Health & Fitness

**Tags** (Play allows a small number of relevant tags — pick from):
`fitness`, `workout tracker`, `personal training`, `nutrition tracking`,
`recovery`

**App icon**: exported at the exact required 512×512 PNG —
`sc-coaching-mobile/store-assets/hi-res-icon-512.png` (generated from the
existing production `assets/images/icon.png`).

**Feature graphic**: generated and cropped to the exact required 1024×500 —
`sc-coaching-mobile/store-assets/feature-graphic-1024x500.png` (navy/gold,
on-brand, matches the app's own dual-line trend-chart visual language). The
uncropped 2688×1152 source is kept alongside it
(`feature-graphic-source.png`) in case a different crop or a second variant
is wanted later.

## Screenshots

Confirmed by walking the actual running app (browser preview, mobile
viewport) that these five screens are polished, populated with real
content, and ready to shoot — no placeholder text, no layout breakage:

1. **Home** — readiness score, 7-day load, next session card
2. **Workouts** — this week's stats, recent records, tools row
3. **Nutrition** — macro ring, hydration tracker, today's targets
4. **Recovery** — readiness ring + score explainer, daily check-in form
5. **Schedule** — calendar view with booking

I couldn't export pixel files directly from the browser-preview tool used
to check these (no local file-write path from that tool) — and Play
screenshots should come from a real build anyway, not a web-preview
facsimile. Capture the actual PNGs from a real device or emulator instead:

```bash
# From a connected Android device/emulator with the app installed
# (the existing EAS preview APK works fine for this):
adb exec-out screencap -p > screenshot.png
```

Or use Android Studio's emulator screenshot button, or the phone's own
screenshot function if using the already-installed preview build. Play
requires **2–8 screenshots**, JPEG or 24-bit PNG (no alpha), each dimension
between 320px and 3840px, aspect ratio between 16:9 and 9:16 — a real
device's native resolution satisfies this automatically. Shoot the same
five screens above, in that order, with realistic (not embarrassingly
empty) data logged first.

**Contact details for the listing**:
- Support email: `info@sandccoaching.com` (`gym-app/lib/content.ts`)
- Website: `https://sandccoaching.com`
- Privacy policy URL: `https://sandccoaching.com/privacy` — confirmed live
  and resolving (checked 2026-08-26).

---

## Data Safety form

Grounded in the live privacy policy (`https://sandccoaching.com/privacy`,
confirmed live) and a code audit of what the app actually collects. Answer
Play Console's Data Safety questionnaire with the following — go
category-by-category as Play presents them.

**Does your app collect or share any of the required user data types?**
Yes.

**Is all user data collected by your app encrypted in transit?**
Yes (HTTPS throughout — confirmed serving over `https://sandccoaching.com`).

**Do you provide a way for users to request that their data is deleted?**
Yes — via a support request (email `info@sandccoaching.com`), not a
self-service in-app button. Play's form has a spot to describe this; use
wording like *"Users can request account and data deletion by contacting
support; requests are actioned by our team."*

### Data types collected

| Category | Sub-type | Collected? | Shared with 3rd party? | Purpose | Optional? |
|---|---|---|---|---|---|
| Personal info | Email address | Yes | No | Account functionality | Required (signup) |
| Personal info | Name | Yes | No | Account functionality, personalisation | Required |
| Personal info | Phone number | Yes | No | Account functionality (contact/emergency contact) | Required |
| Personal info | User IDs | Yes | No | Account functionality | Required |
| Personal info | Other info (date of birth, gender) | Yes | No | Personalisation (training/recovery guidance) | Required |
| Health and fitness | Health info (workouts, exercises, recovery, sleep/soreness/fatigue, cycle tracking) | Yes | No | App functionality — this is the core purpose of the app | Some required (workouts/recovery), cycle tracking is opt-in/off by default |
| Health and fitness | Fitness info (training load, personal bests, nutrition/diet logs, body weight) | Yes | No | App functionality | Required for the relevant feature area |
| Financial info | Purchase history | Yes | Yes — **Stripe** (payment processor) | Payment processing | Required to purchase membership/passes |
| Financial info | Payment info | **No** — the app never touches card details directly; Stripe's hosted checkout handles this, card data never reaches app servers | — | — | — |
| Messages | Other in-app messages | Yes (member ↔ coach messaging) | No | App functionality | Optional (a feature, not required to use the app) |
| Photos | Photos | Yes — food/barcode/label photos, optional profile picture | No | App functionality (nutrition logging), personalisation (profile picture) | Optional |
| App activity | App interactions | Yes (general usage of features) | No | App functionality | Required |
| Device or other IDs | Device or other IDs | Yes — push notification token | No | App functionality (class reminders, coach messages) | Optional (notifications can be disabled) |

**Not collected**: Location, Web browsing history, Audio files, Files and
docs, Calendar, Contacts, Analytics/advertising IDs (confirmed — privacy
policy states no analytics or advertising trackers are used).

**Data sharing note for the form**: the only external party any data is
shared with is **Stripe** (payment processing) and **Resend** (transactional
email delivery — booking confirmations, password resets). Both are
processors acting on the app's behalf under contract, not independent data
recipients — Play's form has a distinction for this; select "shared with a
service provider" rather than "shared with a third party for their own
purposes" where that option exists, since neither Stripe nor Resend uses
the data for their own purposes.

## Content Rating questionnaire

Play uses IARC's questionnaire. Recommended answers for this app —
confirm each still matches before submitting, since the questionnaire's
exact wording can shift:

- **Category**: Health & Fitness / Utility (not a game).
- **Violence**: None.
- **Sexual content**: None.
- **Profanity/crude humor**: None.
- **Controlled substances (alcohol/tobacco/drugs)**: Not depicted or
  referenced.
- **Gambling**: None — no simulated or real gambling.
- **User-generated content shared publicly**: No — the only user-generated
  content is private member ↔ coach messaging, not visible to other users
  or posted publicly.
- **Shares user location**: No.
- **Allows users to interact/communicate**: Yes, but limited to a private
  channel with the member's own coach — not open chat with other members
  or strangers, and not moderated public content. Answer this accurately in
  the questionnaire; it typically still results in a low rating (e.g. PEGI
  3 / Everyone) given the closed, 1:1, non-public nature of the messaging.
- **Digital purchases**: Yes — membership and class-pass payments via
  Stripe (real-world service purchase, not in-app virtual goods).

Expected outcome: this should land at the lowest content rating tier
(Everyone / PEGI 3) across all rating systems Play uses — nothing in the
app targets a rating higher than that. Still run the actual questionnaire
in Play Console rather than assuming, since IARC's exact question wording
determines the final rating, not this summary.
