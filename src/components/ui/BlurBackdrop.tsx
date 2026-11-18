import { BlurView } from "expo-blur";
import { StyleSheet } from "react-native";

// A frosted-glass blur of whatever is behind a sheet or pop-up. Put it as the first child of a sheet's dim backdrop: it fills the backdrop and takes no touches,
// so the backdrop's own colour still dims the screen and its tap-to-close still works. Where a phone can't blur, the dim backdrop alone shows (as before).
export function BlurBackdrop({ intensity = 28 }: { intensity?: number }) {
  return <BlurView pointerEvents="none" intensity={intensity} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />;
}
