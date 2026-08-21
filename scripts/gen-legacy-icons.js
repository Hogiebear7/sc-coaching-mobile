// Expo's Android prebuild auto-generates the LEGACY (pre-Android-8) launcher
// icons (mipmap-*/ic_launcher.webp, ic_launcher_round.webp) by flattening
// our adaptive foreground+background layers, but it does this by trimming
// the foreground down to its opaque content bounding box and re-scaling
// that trimmed box to nearly fill the icon square (~95% width observed) —
// completely discarding the safe-zone padding in the source asset. Devices/
// launchers that resolve to these legacy rasters instead of the true
// mipmap-anydpi-v26 adaptive XML (common on some OEM skins even on modern
// Android) then get a badly-clipped icon no amount of source padding fixes,
// because the generator re-derives its own crop every time regardless.
//
// This generates safely-padded legacy icons ourselves, at every required
// density, so a companion Expo config plugin (withFixedLauncherIcons.js)
// can drop them in place of the auto-generated ones after prebuild.
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const SRC_DIR = path.join(__dirname, "..", "assets", "images");
const OUT_DIR = path.join(__dirname, "..", "assets", "images", "android-legacy-icons");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BG_COLOR = { r: 10, g: 21, b: 38 }; // #0a1526, matches adaptiveIcon.backgroundColor
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

const foreground = PNG.sync.read(fs.readFileSync(path.join(SRC_DIR, "android-icon-foreground.png")));

function bilinearSample(png, px, py) {
  const { width, height, data } = png;
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(px)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(py)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = px - x0;
  const fy = py - y0;
  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const get = (xx, yy) => data[(width * yy + xx) * 4 + c];
    const top = get(x0, y0) * (1 - fx) + get(x1, y0) * fx;
    const bot = get(x0, y1) * (1 - fx) + get(x1, y1) * fx;
    out[c] = top * (1 - fy) + bot * fy;
  }
  return out;
}

function renderFlattened(size, { round }) {
  const out = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) * 4;
      const insideCircle = !round || (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
      if (!insideCircle) {
        out.data[idx] = 0;
        out.data[idx + 1] = 0;
        out.data[idx + 2] = 0;
        out.data[idx + 3] = 0;
        continue;
      }
      // Sample the foreground source (already safely padded, ~40% width)
      // at the corresponding position, alpha-composited over the solid
      // background color — same visual result as the true adaptive-icon
      // renderer, just baked into a flat raster ourselves.
      const srcX = (x / size) * foreground.width;
      const srcY = (y / size) * foreground.height;
      const [fr, fg, fb, fa] = bilinearSample(foreground, srcX, srcY);
      const a = fa / 255;
      out.data[idx] = Math.round(fr * a + BG_COLOR.r * (1 - a));
      out.data[idx + 1] = Math.round(fg * a + BG_COLOR.g * (1 - a));
      out.data[idx + 2] = Math.round(fb * a + BG_COLOR.b * (1 - a));
      out.data[idx + 3] = 255;
    }
  }
  return out;
}

for (const [density, size] of Object.entries(DENSITIES)) {
  const square = renderFlattened(size, { round: false });
  const round = renderFlattened(size, { round: true });
  fs.writeFileSync(path.join(OUT_DIR, `ic_launcher-${density}.png`), PNG.sync.write(square));
  fs.writeFileSync(path.join(OUT_DIR, `ic_launcher_round-${density}.png`), PNG.sync.write(round));
  console.log(`generated ${density} (${size}x${size})`);
}
