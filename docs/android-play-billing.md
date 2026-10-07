# Android Google Play Billing: App Subscription purchase flow

**Status:** implemented and tested with fakes. **Not run on a device. Not run against Google Play. The native billing
library is not installed**, so this build changes nothing a member can see. Read "What is and is not done" first.

Server contract this consumes: `docs/google-play-server-contract-2026-10.md` in the gym-app repository (PR
`Hogiebear7/sccoaching#63`). Plan and owner defaults: `docs/iap-multitenant-implementation-plan-2026-10.md` there.

## What is sold here

Only the digital **App Subscription**, on Android. The gym **Membership** is still bought on the web, exactly as before,
and the Membership screen still says so. iOS is a separate future provider and is not implemented.

## Flow

1. The app asks the server for the account binding (`GET /api/mobile/billing/google-play/purchase-context`). The server
   returns a one-way identifier derived from the signed-in account. **If the server will not give one, no purchase is
   started.** The server refuses it while the member has an active gym Membership or a live Play subscription, and while
   its kill switch is off.
2. The app passes that value to Google Play **unchanged**, before the purchase starts (`obfuscatedAccountId`).
3. When Google reports a purchase, the app saves the token (Keystore-backed `SecureStore`, keyed by account) and sends
   **only the purchase token** to `POST /api/mobile/billing/google-play/verify`. It never sends a user id, a gym id or a
   binding, and it never grants itself anything. The server verifies with Google, binds the token to the account,
   grants the entitlement, and acknowledges.
4. Only after the server confirms does the app tell the store the purchase is finished, then refresh every query that
   depends on the member's tier.

## Outcomes and what the member sees

| Outcome | Cause | Behaviour |
|---|---|---|
| `verified` | server confirmed | success message; tier-dependent screens refresh |
| `cancelled` | member backed out | nothing shown, nothing sent |
| `pending` (store) | slow payment method | "Payment pending"; no entitlement; arrives by server notification |
| `pending` (server) | `purchase_pending` | token kept; "Still confirming. You don't need to buy again" |
| `needs_retry` | server unreachable, or purchases switched off after payment | **token kept**; retried on app start and on return to foreground |
| `blocked` | `membership_active`, `play_billing_active` | no purchase started; or, if already paid, the member is told Google will refund |
| `rejected` | `owned_by_other`, `binding_required`, `product_unknown`, `provider_rejected`, ... | token cleared, not retried |
| already owned | store says the account owns it | restore through the server |
| restore | "Restore purchase" | lists this Google account's purchases for the product, the server verifies each |

The app branches on the server's stable `code`, never its message. `ApiError` now carries an optional `code` for this.

## Tests

`npx vitest run` (85 tests): the purchase flow over fake dependencies (binding fetched first and passed unchanged,
success, pending, cancelled, already owned, backend rejection of every code, server delay and retry, restore, no
purchase without a binding, no token for another product), the store adapter against a fake native module, and the user
wording. `tsc --noEmit`, ESLint on the changed files, and a full Android Metro bundle (`expo export --platform android`)
all pass.

## What is and is not done

| Item | Status |
|---|---|
| Flow logic, API calls, token persistence, UI card, wording | **Implemented, tested with fakes** |
| `expo-iap` (or any billing library) | **Not installed.** `src/lib/billing/index.ts` loads it with an optional `require`, so without it `isAvailable()` is false and `AppSubscriptionCard` renders nothing. A normal build behaves exactly as before |
| The adapter's use of the library's API | Written from the library's published type definitions. **Requires a device and the Play internal test track** |
| Config plugin, `app.json` changes, native prebuild, a new development build | **Not done.** Adding a native module changes the Android build, which cannot be verified here |
| Product id | Read from `EXPO_PUBLIC_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_ID` (public, not secret). Unset means unavailable |
| Server side | Kill switch off by default. Nothing is enabled |

### Library choice (to confirm before installing)

`expo-iap` 5.8.2 (peer `expo`, `react`, `react-native`; Amazon packages are optional peers) is the closer fit for an
Expo app than `react-native-iap` 16.7.2, which additionally needs `react-native-nitro-modules`. Both are native modules,
both need a new development build, and neither has been built against Expo 57 / React Native 0.86 here. **Decision 11 in
the readiness document stays open.**

### Steps to finish (not performed)

1. Confirm the library, add it, and add its config plugin to the Expo config. Check `npx expo prebuild` output.
2. Build a development client. Install it on a device signed in as a Play licence tester.
3. On the Play internal test track, against a **staging** server with the kill switch on: buy, cancel, restore, buy with
   an active Membership (must be refused before any charge), buy on a second account with the same Google account
   (`owned_by_other`), and lose connectivity mid-verify (the token must survive a restart).
4. Compare the library's real events and error codes with `google-play-client.ts` and fix any difference.
5. Only then ask the owner about production.

Do not touch `eas.json` for this work. This branch does not include the repository's pre-existing uncommitted
`eas.json` change.
