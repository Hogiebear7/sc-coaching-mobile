const { withAndroidManifest } = require("@expo/config-plugins");

// The app is locked to portrait, and Google Play reads that as "this app REQUIRES a portrait screen", which hides it from devices without one (some desktops,
// Chromebooks and headsets) and raises a "Required hardware feature declarations" warning. Declaring the feature as not required removes the restriction;
// phones are unaffected and the app still opens in portrait.
function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = (manifest["uses-feature"] = manifest["uses-feature"] ?? []);
    const existing = features.find((f) => f.$?.["android:name"] === "android.hardware.screen.portrait");
    if (existing) existing.$["android:required"] = "false";
    else features.push({ $: { "android:name": "android.hardware.screen.portrait", "android:required": "false" } });
    return cfg;
  });
}

module.exports = withOptionalPortrait;
