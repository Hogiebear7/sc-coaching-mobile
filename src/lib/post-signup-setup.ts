// Shared between (auth)/signup.tsx (sets the flag) and (tabs)/index.tsx's
// PostSignupSetupModal (reads/clears it) — kept out of both screen files
// since AuthGate swaps the mounted screen the instant signup succeeds, so
// nothing held in local component state on signup.tsx would survive to be
// read on the Home tab.
export const POST_SIGNUP_SETUP_KEY_PREFIX = "post-signup-setup-pending-v1-";

// Set at signup (only in a build that sells the plan) so Home can offer the free trial ONCE right after the account is created. It is a one-shot hand-off, not a
// deadline: clearing it (by showing the offer, finding nothing to offer, or "Not now") never removes the trial from Settings > App Subscription.
export const POST_SIGNUP_TRIAL_OFFER_KEY_PREFIX = "post-signup-trial-offer-pending-v1-";
