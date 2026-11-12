// A tiny relay for "the member touched the screen". The screen's root view reports every touch; a control that wants to know about touches
// outside itself (the water bottle, which saves when you tap anywhere else) listens while it is switched on.

type Listener = (pageX: number, pageY: number) => void;

const listeners = new Set<Listener>();

export function reportTouch(pageX: number, pageY: number): void {
  for (const fn of [...listeners]) fn(pageX, pageY);
}

export function onTouch(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** True when the point is inside the rectangle, with a little slack so a touch on the edge does not count as outside. */
export function insideRect(pageX: number, pageY: number, rect: Rect, slack = 8): boolean {
  return pageX >= rect.x - slack && pageX <= rect.x + rect.width + slack && pageY >= rect.y - slack && pageY <= rect.y + rect.height + slack;
}
