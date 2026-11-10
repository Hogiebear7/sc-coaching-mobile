// The maths behind the hydration bottle's liquid, kept free of React so it can
// be unit-tested. Every function is a worklet: the bottle redraws on the UI
// thread every frame, so these run there rather than crossing to JS.
//
// The picture is a 2D slice of a bottle. The liquid has a surface that stays
// level in the real world, so inside a tilted bottle it appears tilted the
// other way; a little wave rides along it. The water volume is conserved as it
// tilts, so a nearly empty bottle never shows a wedge of water in a corner.

/** How many points describe the surface. More is smoother, fewer is cheaper. */
export const LIQUID_POINTS = 20;
/** The share of the bottle left as air, so a "full" bottle still has a surface. */
const HEADROOM_SHARE = 0.06;

/**
 * The accelerometer's reading turned into "which way is down on the screen".
 * Android reports the reaction to gravity (the opposite way round), iOS the
 * pull of gravity itself, so Android's reading is flipped to match.
 */
export function gravityOnScreen(x: number, y: number, platform: string): { gx: number; gy: number } {
  "worklet";
  const sign = platform === "android" ? -1 : 1;
  return { gx: sign * x, gy: sign * y };
}

/**
 * The angle (radians) the surface should lean at: 0 when the phone is upright
 * or lying flat, positive when the right-hand edge is lower. When the phone is
 * flat there is hardly any gravity along the screen, so the liquid levels off.
 */
export function targetTilt(gx: number, gy: number, maxTilt = 1.05): number {
  "worklet";
  if (Math.hypot(gx, gy) < 0.3) return 0;
  const angle = Math.atan2(gx, -gy);
  return Math.max(-maxTilt, Math.min(maxTilt, angle));
}

/**
 * Heights of the liquid surface (px from the top of the bottle) at evenly
 * spaced points across its width. `slope` is the tangent of the tilt (positive:
 * the right-hand side is higher). `amp` and `phase` shape the wave.
 */
export function liquidSurface(args: {
  width: number;
  height: number;
  /** How full the bottle is, 0-100. */
  fillPct: number;
  slope: number;
  amp: number;
  phase: number;
}): number[] {
  "worklet";
  const { width, height, slope, amp, phase } = args;
  const pct = Math.max(0, Math.min(100, args.fillPct));
  const n = LIQUID_POINTS;
  const empty = height + 3;
  const out: number[] = new Array(n);

  if (pct <= 0.4) {
    for (let i = 0; i < n; i++) out[i] = empty;
    return out;
  }

  const xs: number[] = new Array(n);
  for (let i = 0; i < n; i++) xs[i] = (i / (n - 1)) * width;

  // Find the height of the surface at the middle of the bottle that holds the
  // right amount of liquid once the bottle is tilted.
  const wanted = (pct / 100) * width * height * (1 - HEADROOM_SHARE);
  const reach = width * Math.abs(slope) + height * 2;
  let lo = -reach;
  let hi = height + reach;
  for (let step = 0; step < 14; step++) {
    const mid = (lo + hi) / 2;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const y = mid - (xs[i] - width / 2) * slope;
      area += height - Math.max(0, Math.min(height, y));
    }
    area = (area / n) * width;
    if (area > wanted) lo = mid;
    else hi = mid;
  }
  const centre = (lo + hi) / 2;

  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const wave =
      amp * Math.sin((x / 46) * Math.PI * 2 + phase) + amp * 0.45 * Math.sin((x / 25) * Math.PI * 2 - phase * 1.35);
    const y = centre - (x - width / 2) * slope + wave;
    out[i] = Math.max(-2, Math.min(height + 2, y));
  }
  return out;
}

/** An SVG path that fills everything below the surface down to the bottom of the bottle. */
export function surfacePath(width: number, height: number, ys: number[]): string {
  "worklet";
  const n = ys.length;
  let d = "M -2 " + (height + 2).toFixed(1) + " L -2 " + ys[0].toFixed(1);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * width;
    d += " L " + x.toFixed(1) + " " + ys[i].toFixed(1);
  }
  d += " L " + (width + 2).toFixed(1) + " " + ys[n - 1].toFixed(1) + " L " + (width + 2).toFixed(1) + " " + (height + 2).toFixed(1) + " Z";
  return d;
}
