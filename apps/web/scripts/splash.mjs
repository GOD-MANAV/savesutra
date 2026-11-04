// Replaces Capacitor's default splash images with the SaveSutra splash.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const res = new URL('../android/app/src/main/res/', import.meta.url).pathname;
const logo = (s) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${s}" height="${s}">
  <path d="M176 120h160v272l-80-56-80 56z" fill="none" stroke="#fff" stroke-width="32" stroke-linejoin="round"/>
  <path d="M120 224c64-48 208 48 272 0" fill="none" stroke="#E2622F" stroke-width="36" stroke-linecap="round"/></svg>`);
for (const dir of readdirSync(res)) {
  if (!dir.startsWith('drawable')) continue;
  const file = join(res, dir, 'splash.png');
  try { statSync(file); } catch { continue; }
  const { width, height } = await sharp(file).metadata();
  const size = Math.round(Math.min(width, height) * 0.28);
  await sharp({ create: { width, height, channels: 4, background: '#0B1220' } })
    .composite([{ input: await sharp(logo(size)).png().toBuffer(), gravity: 'center' }])
    .png().toFile(file + '.tmp');
  const { renameSync } = await import('node:fs');
  renameSync(file + '.tmp', file);
}
console.log('Splash screens written');
