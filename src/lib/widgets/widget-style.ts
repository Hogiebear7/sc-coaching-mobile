import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

// The home-screen widgets' look (owner request 2026-10-30): "navy", the brand's solid navy and gold, or "glass", a see-through frosted panel
// that lets the wallpaper show through. Chosen on the Widgets screen, kept on the device, and passed to the widgets with their data.
//
// What "glass" can be on each phone: an iPhone widget can have a translucent, blurred background (and on iOS 26, with the Home Screen set to
// Clear, the system turns every widget into Liquid Glass anyway). An Android launcher gives widgets no access to blur the wallpaper, so there
// "glass" is a see-through frosted tint without the blur.

export type WidgetStyle = "navy" | "glass";
export const DEFAULT_WIDGET_STYLE: WidgetStyle = "navy";
const STORAGE_KEY = "sc.widgetStyle";

let current: WidgetStyle = DEFAULT_WIDGET_STYLE;
const listeners = new Set<() => void>();

const isStyle = (v: unknown): v is WidgetStyle => v === "navy" || v === "glass";

AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (isStyle(raw) && raw !== current) {
      current = raw;
      listeners.forEach((l) => l());
    }
  })
  .catch(() => {});

export function setWidgetStyle(style: WidgetStyle) {
  if (!isStyle(style)) return;
  current = style;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, style).catch(() => {});
}

export function useWidgetStyle(): WidgetStyle {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current
  );
}
