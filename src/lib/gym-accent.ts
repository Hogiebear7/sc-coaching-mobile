// A gym's own accent colour inside the app. The server only accepts a colour that is readable on the app's DARK background (contrast of at least 4.5:1 on navy), so on
// dark it is used as it is. The light theme has a pale background, where a colour that reads well on navy (a light yellow, say) can all but vanish, so for light it is
// darkened, in small steps, until it reads clearly there too. Pure functions, no React Native, so they can be tested on their own.

const HEX = /^#[0-9a-fA-F]{6}$/;
export const LIGHT_BACKGROUND = "#f3f5f9";
export const MIN_CONTRAST = 4.5;

function channel(hex: string, from: number): number {
  return parseInt(hex.slice(from, from + 2), 16);
}

function luminance(hex: string): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(channel(hex, 1)) + 0.7152 * lin(channel(hex, 3)) + 0.0722 * lin(channel(hex, 5));
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function darken(hex: string, amount: number): string {
  const part = (from: number) =>
    Math.round(channel(hex, from) * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  return `#${part(1)}${part(3)}${part(5)}`;
}

/** The gym's colour as it should be used on this theme. Anything that is not a plain #RRGGBB colour gives null (the caller keeps the S&C gold). */
export function accentForScheme(hex: string | null | undefined, scheme: "dark" | "light"): string | null {
  if (typeof hex !== "string" || !HEX.test(hex)) return null;
  if (scheme === "dark") return hex.toLowerCase();
  let out = hex.toLowerCase();
  for (let i = 0; i < 20 && contrastRatio(out, LIGHT_BACKGROUND) < MIN_CONTRAST; i++) out = darken(out, 0.1);
  return out;
}

const brandCache = new Map<string, unknown>();

/** The legacy palette with its `brand` colour (dots, trophies, badges) swapped for the gym's. Cached so the same inputs give the same object. */
export function withBrand<T extends { brand: string }>(base: T, brand: string | null, cacheKey: string): T {
  if (!brand) return base;
  const key = `${cacheKey}:${brand}`;
  const hit = brandCache.get(key) as T | undefined;
  if (hit) return hit;
  const next = { ...base, brand };
  brandCache.set(key, next);
  return next;
}
