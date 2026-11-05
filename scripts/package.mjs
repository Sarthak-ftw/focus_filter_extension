/**
 * Focus Filter - Chrome Web Store Packaging Script
 * Run with: node scripts/package.mjs
 *
 * Creates a zip of the dist/ folder ready for Chrome Web Store upload.
 * Automatically names it: focus-filter-v{version}.zip
 */

import fs from 'node:fs';
import path from 'node:path';
import { createWriteStream } from 'node:fs';

const distDir = path.resolve('dist');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const outputName = `focus-filter-v${pkg.version}.zip`;
const outputPath = path.resolve(outputName);

if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ folder not found. Run `npm run build` first.');
  process.exit(1);
}

// Collect all files recursively
function getAllFiles(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = base ? `${base}/${entry.name}` : entry.name;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, relativePath));
    } else {
      files.push({ fullPath, relativePath });
    }
  }

  return files;
}

const files = getAllFiles(distDir);

// Write a simple ZIP using manual ZIP format (no external dependencies)
function uint32LE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

function uint16LE(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (~c) >>> 0;
}

const localHeaders = [];
const centralDirectories = [];
let offset = 0;
const outputChunks = [];

for (const { fullPath, relativePath } of files) {
  const content = fs.readFileSync(fullPath);
  const name = Buffer.from(relativePath.replace(/\\/g, '/'), 'utf8');
  const crc = crc32(content);
  const compressedSize = content.length;
  const uncompressedSize = content.length;

  // Local file header
  const localHeader = Buffer.concat([
    Buffer.from('PK\x03\x04'),       // Local file header signature
    uint16LE(20),                     // Version needed
    uint16LE(0),                      // General purpose bit flag
    uint16LE(0),                      // Compression method: stored (0 = no compression)
    uint16LE(0),                      // Last mod time
    uint16LE(0),                      // Last mod date
    uint32LE(crc),                    // CRC-32
    uint32LE(compressedSize),
    uint32LE(uncompressedSize),
    uint16LE(name.length),            // File name length
    uint16LE(0),                      // Extra field length
    name,
  ]);

  localHeaders.push({ offset, name, crc, compressedSize, uncompressedSize });
  outputChunks.push(localHeader, content);
  offset += localHeader.length + content.length;
}

// Central directory
let centralOffset = offset;
for (const entry of localHeaders) {
  const central = Buffer.concat([
    Buffer.from('PK\x01\x02'),        // Central directory signature
    uint16LE(20),                      // Version made by
    uint16LE(20),                      // Version needed
    uint16LE(0),                       // General purpose bit flag
    uint16LE(0),                       // Compression method: stored
    uint16LE(0),                       // Last mod time
    uint16LE(0),                       // Last mod date
    uint32LE(entry.crc),               // CRC-32
    uint32LE(entry.compressedSize),
    uint32LE(entry.uncompressedSize),
    uint16LE(entry.name.length),
    uint16LE(0),                       // Extra field length
    uint16LE(0),                       // File comment length
    uint16LE(0),                       // Disk number start
    uint16LE(0),                       // Internal file attributes
    uint32LE(0),                       // External file attributes
    uint32LE(entry.offset),            // Relative offset of local header
    entry.name,
  ]);
  outputChunks.push(central);
  offset += central.length;
}

const centralSize = offset - centralOffset;
const fileCount = localHeaders.length;

// End of central directory
const eocd = Buffer.concat([
  Buffer.from('PK\x05\x06'),          // End of central directory signature
  uint16LE(0),                         // Disk number
  uint16LE(0),                         // Disk with central directory
  uint16LE(fileCount),                 // Number of entries this disk
  uint16LE(fileCount),                 // Total entries
  uint32LE(centralSize),               // Size of central directory
  uint32LE(centralOffset),             // Offset of central directory
  uint16LE(0),                         // Comment length
]);

outputChunks.push(eocd);
fs.writeFileSync(outputPath, Buffer.concat(outputChunks));

console.log(`\n✅ Packaged: ${outputName}`);
console.log(`   Files included: ${files.length}`);
console.log(`   Output size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
console.log(`\n📦 Upload this file to: https://chrome.google.com/webstore/devconsole\n`);
