/* Generates all Android + web icon assets from the source artwork. */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SRC = "C:/Users/shirk/Desktop/Casino Photo/icon/98da7447-98c0-41ab-8ede-78d225966098.png";
const ROOT = path.resolve(__dirname, "..");
const RES = path.join(ROOT, "android/app/src/main/res");
const ASSETS = path.join(ROOT, "assets");

// Legacy launcher icon sizes (square, full bleed) per density bucket.
const LEGACY_SIZES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

// Adaptive icon foreground canvas sizes — foreground layer must be
// larger than the final icon because Android crops ~33% as a safe zone.
const ADAPTIVE_SIZES = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

// Cuts the near-black backdrop from the source art so only the gilded
// pharaoh/wings survive with a transparent background — lets the icon
// sit on Android's own background color instead of showing a visible
// black square inside the mask.
async function cutoutArt() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const threshold = 26;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r <= threshold && g <= threshold && b <= threshold) {
      data[i + 3] = 0;
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

async function buildLegacyIcons(cutout) {
  for (const [bucket, size] of Object.entries(LEGACY_SIZES)) {
    const dir = path.join(RES, `mipmap-${bucket}`);
    await ensureDir(dir);

    // Square icon: the source art already fills its rounded-square frame,
    // so a plain resize keeps the design crisp at every density.
    await sharp(SRC)
      .resize(size, size, { fit: "cover" })
      .png()
      .toFile(path.join(dir, "ic_launcher.png"));

    // Round icon: use the transparent cutout on the game's ink background
    // and fit the whole design (not cropped) so the crown/wings never
    // clip at the edges the way a plain circular crop of the square art would.
    const art = await sharp(cutout)
      .resize(Math.round(size * 0.94), Math.round(size * 0.94), {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();
    const offset = Math.round(size * 0.03);
    const circleMask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
    );
    const squared = await sharp({
      create: { width: size, height: size, channels: 4, background: "#0b0603" },
    })
      .composite([{ input: art, left: offset, top: offset }])
      .png()
      .toBuffer();
    await sharp(squared)
      .composite([{ input: circleMask, blend: "dest-in" }])
      .png()
      .toFile(path.join(dir, "ic_launcher_round.png"));

    console.log(`legacy ${bucket} (${size}px) done`);
  }
}

async function buildAdaptiveForeground(cutout) {
  for (const [bucket, canvasSize] of Object.entries(ADAPTIVE_SIZES)) {
    const dir = path.join(RES, `mipmap-${bucket}`);
    await ensureDir(dir);

    // Art occupies most of the 66% safe zone Android guarantees visible
    // across all mask shapes (circle, squircle, rounded square, ...),
    // leaving a small margin so the face/wings are never clipped.
    const artSize = Math.round(canvasSize * 0.98);
    const offset = Math.round((canvasSize - artSize) / 2);

    const art = await sharp(cutout).resize(artSize, artSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

    await sharp({
      create: {
        width: canvasSize,
        height: canvasSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: art, left: offset, top: offset }])
      .png()
      .toFile(path.join(dir, "ic_launcher_foreground.png"));

    console.log(`adaptive foreground ${bucket} (${canvasSize}px, art ${artSize}px) done`);
  }
}

async function buildAdaptiveBackground() {
  // Solid deep-ink background matching the game's palette, sampled
  // from the icon's own dark backdrop so foreground and background feel unified.
  const dir = path.join(RES, "drawable-v24");
  await ensureDir(dir);
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#0b0603" android:pathData="M0,0h108v108h-108z"/>
</vector>
`;
  await fs.promises.writeFile(path.join(dir, "ic_launcher_background.xml"), xml, "utf8");
  console.log("adaptive background xml done");
}

async function buildAdaptiveXml() {
  const dir = path.join(RES, "mipmap-anydpi-v26");
  await ensureDir(dir);
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
  await fs.promises.writeFile(path.join(dir, "ic_launcher.xml"), xml, "utf8");
  await fs.promises.writeFile(path.join(dir, "ic_launcher_round.xml"), xml, "utf8");
  console.log("adaptive icon xml done");
}

async function buildWebFavicons() {
  await ensureDir(ASSETS);
  await sharp(SRC).resize(512, 512, { fit: "cover" }).png().toFile(path.join(ASSETS, "icon-512.png"));
  await sharp(SRC).resize(192, 192, { fit: "cover" }).png().toFile(path.join(ASSETS, "icon-192.png"));
  await sharp(SRC).resize(180, 180, { fit: "cover" }).png().toFile(path.join(ROOT, "apple-touch-icon.png"));
  await sharp(SRC).resize(32, 32, { fit: "cover" }).png().toFile(path.join(ROOT, "favicon-32.png"));
  console.log("web favicons done");
}

async function main() {
  const cutout = await cutoutArt();
  await buildLegacyIcons(cutout);
  await buildAdaptiveForeground(cutout);
  await buildAdaptiveBackground();
  await buildAdaptiveXml();
  await buildWebFavicons();
  console.log("\nAll icon assets generated successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
