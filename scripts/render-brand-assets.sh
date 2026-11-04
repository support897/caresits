#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_DIR="$ROOT/scripts"
cd "$SCRIPT_DIR"

node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("..");
const brand = path.join(root, "brand");
const read = (name) => fs.readFile(path.join(brand, name), "utf8");
const render = async (source, output, size) => sharp(Buffer.from(source)).resize(size, size, { fit: "contain" }).png().toFile(output);
const iconSvg = {
  optionA: await read("caresitters-option-a.svg"),
  optionB: await read("caresitters-option-b.svg"),
  careSpace: await read("carespace.svg"),
  current: await read("current-icon.svg"),
};
const names = [
  ["optionA", "caresitters-option-a"],
  ["optionB", "caresitters-option-b"],
  ["careSpace", "carespace"],
  ["current", "current-icon"],
];
for (const [key, name] of names) {
  const svg = iconSvg[key];
  await render(svg, path.join(brand, `${name}-1024.png`), 1024);
  await render(svg, path.join(brand, `${name}-favicon.png`), 128);
  const foreground = svg.replace(/<rect\b[^>]*\/>/, "");
  await render(foreground, path.join(brand, `${name}-adaptive-foreground.png`), 432);
}

const csSitters = path.join(root, "apps/caresitters");
const careSpace = path.join(root, "apps/carespace");
for (const [app, key, assetName] of [[csSitters, "current", "current-icon"], [careSpace, "careSpace", "carespace"]]) {
  const svgName = key === "current" ? "current-icon.svg" : "carespace.svg";
  const foregroundName = `${assetName}-adaptive-foreground.png`;
  await fs.copyFile(path.join(brand, svgName), path.join(app, "public/favicon.svg"));
  await fs.copyFile(path.join(brand, `${assetName}-favicon.png`), path.join(app, "public/favicon.png"));
  await fs.copyFile(path.join(brand, `${assetName}-1024.png`), path.join(app, "resources/icon.png"));
  for (const size of [192, 512, 1024]) {
    await render(iconSvg[key], path.join(app, `public/app-icon-${size}.png`), size);
  }
  await fs.copyFile(path.join(brand, foregroundName), path.join(app, "resources/android/foreground.png"));
  await fs.writeFile(path.join(app, "resources/android/background-color.txt"), "#F6CBD3\n");
}

const proofRows = [
  ["Caresitters option A", "optionA"],
  ["Caresitters option B", "optionB"],
  ["Care diary icon", "careSpace"],
];
const width = 880;
const height = 360;
const labels = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#FDF8F0"/><text x="44" y="36" fill="#1E4D44" font-family="Arial,sans-serif" font-size="20" font-weight="700">29px and 58px legibility check</text>${proofRows.map(([label], index) => `<text x="44" y="${94 + index * 102}" fill="#1E4D44" font-family="Arial,sans-serif" font-size="17">${label}</text><text x="565" y="${126 + index * 102}" fill="#1E4D44" font-family="Arial,sans-serif" font-size="13">29px</text><text x="690" y="${126 + index * 102}" fill="#1E4D44" font-family="Arial,sans-serif" font-size="13">58px</text>`).join("")}</svg>`);
const composites = [{ input: labels, left: 0, top: 0 }];
for (let index = 0; index < proofRows.length; index += 1) {
  const [, key] = proofRows[index];
  const rowTop = 58 + index * 102;
  const file = path.join(brand, `${key === "optionA" ? "caresitters-option-a" : key === "optionB" ? "caresitters-option-b" : "carespace"}-1024.png`);
  composites.push({ input: await sharp(file).resize(29, 29).png().toBuffer(), left: 565, top: rowTop });
  composites.push({ input: await sharp(file).resize(58, 58).png().toBuffer(), left: 690, top: rowTop - 12 });
}
await sharp({ create: { width, height, channels: 4, background: "#FDF8F0" } }).composite(composites).png().toFile(path.join(brand, "legibility.png"));

const optionSize = 420;
const optionWidth = 1040;
const optionHeight = 540;
const optionLabels = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${optionWidth}" height="${optionHeight}"><rect width="100%" height="100%" fill="#FDF8F0"/><text x="310" y="48" fill="#1E4D44" font-family="Arial,sans-serif" font-size="22" font-weight="700">Option A · holding heart</text><text x="695" y="48" fill="#1E4D44" font-family="Arial,sans-serif" font-size="22" font-weight="700">Option B · hug + bunny ears</text></svg>`);
await sharp({ create: { width: optionWidth, height: optionHeight, channels: 4, background: "#FDF8F0" } })
  .composite([
    { input: optionLabels, left: 0, top: 0 },
    { input: await sharp(path.join(brand, "caresitters-option-a-1024.png")).resize(optionSize, optionSize).png().toBuffer(), left: 70, top: 70 },
    { input: await sharp(path.join(brand, "caresitters-option-b-1024.png")).resize(optionSize, optionSize).png().toBuffer(), left: 550, top: 70 },
  ])
  .png()
  .toFile(path.join(brand, "logo-options.png"));

await fs.writeFile(path.join(brand, "adaptive-background-color.txt"), "#F6CBD3\n");
console.log("Rendered 1024px icons, 432px adaptive foregrounds, favicons, and legibility proof.");
NODE
