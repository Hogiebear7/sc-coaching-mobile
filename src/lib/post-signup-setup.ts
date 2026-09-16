// Shared between (auth)/signup.tsx (sets the flag) and (tabs)/index.tsx's
// PostSignupSetupModal (reads/clears it) — kept out of both screen files
// since AuthGate swaps the mounted screen the instant signup succeeds, so
// nothing held in local component state on signup.tsx would survive to be
// read on the Home tab.
export const POST_SIGNUP_SETUP_KEY_PREFIX = "post-signup-setup-pending-v1-";
