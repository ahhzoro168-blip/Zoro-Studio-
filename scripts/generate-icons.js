import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgBuffer = fs.readFileSync(path.resolve('public/icon.svg'));

async function generate() {
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.resolve('public/pwa-192x192.png'));

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.resolve('public/pwa-512x512.png'));

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.resolve('public/pwa-maskable-512x512.png'));

  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.resolve('public/apple-touch-icon.png'));

  // Also update dist if it exists
  if (fs.existsSync('dist')) {
    fs.copyFileSync('public/pwa-192x192.png', 'dist/pwa-192x192.png');
    fs.copyFileSync('public/pwa-512x512.png', 'dist/pwa-512x512.png');
    fs.copyFileSync('public/apple-touch-icon.png', 'dist/apple-touch-icon.png');
    fs.copyFileSync('public/pwa-maskable-512x512.png', 'dist/pwa-maskable-512x512.png');
  }

  console.log('Successfully generated all app icon PNGs!');
}

generate().catch(console.error);
