const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

// Expo's Android prebuild auto-generates mipmap-*/ic_launcher.webp and
// ic_launcher_round.webp by flattening android-icon-foreground/background —
// but it trims the foreground to its opaque content box and rescales that
// to nearly fill the icon square (~95% width), discarding whatever
// safe-zone padding the source foreground has. Devices/launchers that
// resolve to these legacy rasters instead of the true mipmap-anydpi-v26
// adaptive XML (some OEM skins do, even on modern Android) get a badly
// clipped icon no matter how much the foreground source is padded, because
// the generator re-derives its own crop every prebuild. See
// scripts/gen-legacy-icons.js for the pre-rendered, correctly-padded
// replacements this installs.
const DENSITIES = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"];

function withFixedLauncherIcons(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const srcDir = path.join(projectRoot, "assets", "images", "android-legacy-icons");
      const resDir = path.join(config.modRequest.platformProjectRoot, "app", "src", "main", "res");

      for (const density of DENSITIES) {
        const mipmapDir = path.join(resDir, `mipmap-${density}`);
        if (!fs.existsSync(mipmapDir)) continue;

        for (const base of ["ic_launcher", "ic_launcher_round"]) {
          const src = path.join(srcDir, `${base}-${density}.png`);
          if (!fs.existsSync(src)) continue;

          // Remove the auto-generated .webp so there's no duplicate
          // resource with the same name (aapt errors on that).
          const oldWebp = path.join(mipmapDir, `${base}.webp`);
          if (fs.existsSync(oldWebp)) fs.rmSync(oldWebp);

          fs.copyFileSync(src, path.join(mipmapDir, `${base}.png`));
        }
      }

      return config;
    },
  ]);
}

module.exports = withFixedLauncherIcons;
