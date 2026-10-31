import { routeFromAppLink } from "@/lib/widgets/app-links";

// Links from the widgets and Live Activities (sccoachingmobile://log-food …) are opened by the root layout, not here: they're member screens,
// so a staff account viewing as coach is switched to the member view first, and the screen is opened on top of Home so Back returns there
// rather than out of the app. Opening the app cold, the router starts on Home; with the app already open, it stays where it is until the
// layout opens the link. Any other link is left as it came.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  if (!routeFromAppLink(path)) return path;
  return initial ? "/" : null;
}
