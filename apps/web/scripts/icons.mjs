// Generates PWA icons and Android launcher icons from one SVG source.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mark = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#0B1220"/>
  <g transform="translate(256 256) scale(${pad ? 0.62 : 0.82}) translate(-256 -256)">
    <path d="M176 120h160v272l-80-56-80 56z" fill="none" stroke="#fff" stroke-width="32" stroke-linejoin="round"/>
    <path d="M120 224c64-48 208 48 272 0" fill="none" stroke="#E2622F" stroke-width="36" stroke-linecap="round"/>
  </g></svg>`;
const out = async (svg, size, file) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer());
};
await out(mark(false), 192, join(root, 'public/icons/icon-192.png'));
await out(mark(false), 512, join(root, 'public/icons/icon-512.png'));
await out(mark(true), 512, join(root, 'public/icons/maskable-512.png'));
await out(mark(false), 1024, join(root, 'public/icons/icon-1024.png'));

// Android launcher icons (legacy + round), written only if the android project exists.
const res = join(root, 'android/app/src/main/res');
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
try {
  for (const [d, s] of Object.entries(densities)) {
    await out(mark(false), s, join(res, `mipmap-${d}/ic_launcher.png`));
    await out(mark(false), s, join(res, `mipmap-${d}/ic_launcher_round.png`));
    await out(mark(true), Math.round(s * 2.25), join(res, `mipmap-${d}/ic_launcher_foreground.png`));
  }
  console.log('Android icons written');
} catch (e) {
  console.log('Skipped Android icons:', e.message);
}
console.log('PWA icons written');
