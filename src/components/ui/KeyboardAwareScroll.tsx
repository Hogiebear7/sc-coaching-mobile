import { forwardRef } from "react";
import type { ScrollViewProps } from "react-native";
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";

// Drop-in replacement for the old `<KeyboardAvoidingView><ScrollView>` pair
// used across most forms in this app. Plain KeyboardAvoidingView only
// resizes/shifts the overall layout when the keyboard opens — it never
// scrolls a specific focused TextInput above the keyboard on its own, which
// is exactly the bug class this fixes: a field near the bottom of a long
// form (e.g. the class editor's End date box) getting hidden behind the
// keyboard the moment it's focused. This component handles both concerns
// itself, so screens using it don't need a separate KeyboardAvoidingView at
// all — requires <KeyboardProvider> mounted once at the app root (see
// src/app/_layout.tsx).
export const KeyboardAwareScroll = forwardRef<KeyboardAwareScrollViewRef, ScrollViewProps>(
  function KeyboardAwareScroll(props, ref) {
    return <KeyboardAwareScrollView ref={ref} bottomOffset={24} keyboardShouldPersistTaps="handled" {...props} />;
  }
);
