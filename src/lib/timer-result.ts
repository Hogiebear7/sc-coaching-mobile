// Passing a finished timer back to the set it was started from. The log screen notes which set it opened the timer for; when the timer is
// done the timer screen offers "Add 1:30 to this set", which leaves the time here for the log screen to pick up when it comes back into view.

type Target = { rowKey: string; setKey: string };
type Result = Target & { secs: number };

let target: Target | null = null;
let result: Result | null = null;

export function setTimerTarget(next: Target | null) {
  target = next;
  result = null;
}

export function getTimerTarget(): Target | null {
  return target;
}

export function offerTimerResult(secs: number) {
  if (target && secs > 0) result = { ...target, secs: Math.round(secs) };
}

/** Takes the pending result (once) and clears the target. */
export function takeTimerResult(): Result | null {
  const r = result;
  result = null;
  if (r) target = null;
  return r;
}
