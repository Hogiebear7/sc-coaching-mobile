// In-memory only (not AsyncStorage) — "skippable, re-prompts next session"
// means next time the app process starts, not next time this screen is
// visited, so a plain module-level flag that resets on cold start is
// exactly right; persisting it would make "Remind me later" stick forever
// within one install. Shared between _layout.tsx's gate and
// complete-membership.tsx's skip button.
let dismissedThisSession = false;

export function isEmergencyContactReminderDismissed(): boolean {
  return dismissedThisSession;
}

export function dismissEmergencyContactReminder(): void {
  dismissedThisSession = true;
}
