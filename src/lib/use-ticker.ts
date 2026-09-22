import { useEffect, useRef, useState } from "react";

// Ticks a value derived from wall-clock time (a countdown remaining, a
// stopwatch elapsed) while `active` is true — recomputing via `compute()`
// roughly every `intervalMs`.
//
// This used to be a "force a re-render, then let the component re-read
// timer.remainingNow() itself" trick (a plain useState counter nothing else
// depended on). React Compiler broke that: it memoizes a component's render
// body keyed on the reactive inputs it can see are used inside — and
// remainingNow() reading Date.now() internally is invisible to that static
// analysis, so the compiler treated it as pure and skipped recomputing it
// on every render our counter forced, reusing stale JSX until something the
// compiler DID recognize (the `timer` object itself) actually changed. The
// fix is to make the ticked value real React state the compiler can see
// changing — computed inside this hook, returned directly — rather than a
// side-channel nudge and a hope the caller re-reads something fresh.
export function useTickingValue<T>(compute: () => T, active: boolean, intervalMs: number): T {
  // Always the latest `compute` without re-running the effect on every
  // render (compute is a fresh closure each time the caller renders).
  const computeRef = useRef(compute);
  computeRef.current = compute;

  const [value, setValue] = useState(() => computeRef.current());

  useEffect(() => {
    // Resync the instant this effect (re)runs — covers "just became active"
    // and "just went idle" (e.g. paused) immediately, not on the next tick.
    setValue(computeRef.current());
    if (!active) return;

    let frameId: number;
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      if (now - last >= intervalMs) {
        last = now;
        setValue(computeRef.current());
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [active, intervalMs]);

  return value;
}
