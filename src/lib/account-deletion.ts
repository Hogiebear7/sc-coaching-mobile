// Member-initiated account deletion (required by Apple App Store guideline 5.1.1(v) and Google Play's account-deletion policy).
// The server (POST /api/account/delete in gym-app) is the authority: it re-checks the password and the confirmation word, refuses while a paid
// subscription is live, and answers with a plain-language reason. This file holds only the client-side readiness rule, kept pure so it can be tested.

export const DELETE_CONFIRM_WORD = "DELETE";

/** The delete button is enabled only with a password entered and the exact confirmation word, and never while a request is running. */
export function canSubmitDeletion(password: string, confirmText: string, busy: boolean): boolean {
  return !busy && password.length > 0 && confirmText === DELETE_CONFIRM_WORD;
}
