// The app links the widgets and Live Activities open (sccoachingmobile://<screen>), as an in-app route. Only the screens they actually link to
// are accepted, so a link from anywhere else can't send the app somewhere unexpected.
const LINKED_SCREENS = new Set(["nutrition", "log-food", "schedule", "log-workout", "recovery"]);

export function routeFromAppLink(url: string): string | null {
  const m = /^sccoachingmobile:\/\/\/?([a-z-]+)\/?(?:[?#].*)?$/i.exec(url.trim());
  if (!m || !LINKED_SCREENS.has(m[1].toLowerCase())) return null;
  return `/${m[1].toLowerCase()}`;
}
