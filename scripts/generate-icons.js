// Quick script to generate minimal valid PNG files with proper header and color
import fs from 'fs';
import path from 'path';

// Valid 192x192 and 512x512 PNG generator or copy
// We can construct a minimal uncompressed PNG using zlib
import zlib from 'zlib';

function createPng(width, height, r, g, b) {
  // Construct a solid color PNG with an inner icon pattern
  const rowLength = width * 4 + 1; // 1 filter byte per line
  const rawData = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      // create a subtle gradient + rounded border
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isInside = dist < (width / 2) * 0.85;

      if (isInside) {
        rawData[pixelOffset] = r;     // Red
        rawData[pixelOffset + 1] = g; // Green
        rawData[pixelOffset + 2] = b; // Blue
        rawData[pixelOffset + 3] = 255;
      } else {
        rawData[pixelOffset] = 15;
        rawData[pixelOffset + 1] = 23;
        rawData[pixelOffset + 2] = 42;
        rawData[pixelOffset + 3] = 255;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', deflated);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// Standard CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, 99, 102, 241));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, 56, 189, 248));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, 30, 27, 75));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, 244, 63, 94));
console.log('Generated PWA icon PNGs in public/');
