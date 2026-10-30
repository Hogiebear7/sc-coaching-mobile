import { requireOptionalNativeModule } from "expo-modules-core";

// The app's Android Live Update module (android/src/main/java/expo/modules/scliveupdate/ScLiveUpdateModule.kt). Null where it isn't built
// in (iPhone, web, Expo Go), so callers just skip it.
export interface ScLiveUpdateModule {
  show(options: {
    id: number;
    title: string;
    text: string;
    /** The status-bar chip's text (shown whole under 7 characters); empty to let the counting time show instead. */
    chip: string;
    /** Epoch ms the chip's time counts from (up) or to (down); 0 for none. */
    whenMs: number;
    chronometer: boolean;
    countDown: boolean;
    /** 0 to 100, or -1 for no bar. */
    progress: number;
    uri: string;
  }): void;
  dismiss(id: number): void;
}

export const ScLiveUpdate = requireOptionalNativeModule<ScLiveUpdateModule>("ScLiveUpdate");
