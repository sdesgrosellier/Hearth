// Renders the Round Table mark into every PNG the app needs (icon, splash, Android
// adaptive layers, favicon). Run: node scripts/render-icons.mjs
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "app", "assets");
mkdirSync(OUT, { recursive: true });

const RING = [
  [51.3, -67.7, 17, "#B7A8D4"],
  [-51.3, -67.7, 17, "#4FB0B5"],
  [129.9, -36, 21, "#F0C29B"],
  [-129.9, -36, 21, "#8FB59B"],
  [147.7, 12.5, 27, "#CFE2E8"],
  [-147.7, 12.5, 27, "#E8B3AA"],
  [96.4, 55.2, 36, "#8FB59B"],
  [-96.4, 55.2, 36, "#F0C29B"],
];

function ring(front, { mono = false } = {}) {
  const circles = RING.map(([cx, cy, r, fill], i) => {
    const op = mono ? [0.55, 0.55, 0.65, 0.65, 0.75, 0.75, 0.85, 0.85][i] : 1;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${mono ? "#FFFFFF" : fill}" opacity="${op}"/>`;
  }).join("");
  return `${circles}<circle cx="0" cy="72" r="52" fill="${front}"/>`;
}

// scale: the mark's natural box is ~400x260 (viewBox -200..200, -130..130).
function svg({ size, bg, front, scale, mono = false, dy = 0 }) {
  const rect = bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${rect}<g transform="translate(${size / 2} ${size / 2 + dy}) scale(${scale})">${ring(front, { mono })}</g></svg>`;
}

function render(name, markup, width) {
  const png = new Resvg(markup, { fitTo: { mode: "width", value: width } }).render().asPng();
  writeFileSync(join(OUT, name), png);
  console.log("wrote", name, png.length, "bytes");
}

// App icon: Harbor ground, white front sphere.
render("icon.png", svg({ size: 1024, bg: "#3E7D91", front: "#FFFFFF", scale: 2.3, dy: -30 }), 1024);
// Splash: transparent, mark only (Expo centers it on the splash background color).
render("splash-icon.png", svg({ size: 1024, bg: null, front: "#3E7D91", scale: 2.1, dy: -20 }), 1024);
// Android adaptive icon: foreground must sit inside the central ~66% safe zone.
render("android-icon-foreground.png", svg({ size: 1024, bg: null, front: "#FFFFFF", scale: 1.55, dy: -20 }), 1024);
render("android-icon-background.png", `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#3E7D91"/></svg>`, 1024);
render("android-icon-monochrome.png", svg({ size: 1024, bg: null, front: "#FFFFFF", scale: 1.55, dy: -20, mono: true }), 1024);
// Favicon.
render("favicon.png", svg({ size: 196, bg: "#3E7D91", front: "#FFFFFF", scale: 0.44, dy: -6 }), 196);
