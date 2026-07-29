import { inflateSync } from 'node:zlib';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Sprite } from '../src/sprites';

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const SYMBOLS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

interface DecodedPng {
  width: number;
  height: number;
  rgba: Uint8Array;
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterByte(filterType: number, val: number, left: number, up: number, upLeft: number): number {
  switch (filterType) {
    case 0:
      return val;
    case 1:
      return (val + left) & 0xff;
    case 2:
      return (val + up) & 0xff;
    case 3:
      return (val + Math.floor((left + up) / 2)) & 0xff;
    case 4:
      return (val + paethPredictor(left, up, upLeft)) & 0xff;
    default:
      throw new Error(`Unsupported PNG filter type ${filterType}`);
  }
}

function unfilterScanlines(raw: Uint8Array, width: number, height: number, bpp: number): Uint8Array {
  const rowStride = width * bpp;
  const expected = height * (rowStride + 1);
  if (raw.length !== expected) {
    throw new Error(`PNG decompressed data length mismatch (expected ${expected}, got ${raw.length})`);
  }

  const out = new Uint8Array(width * height * bpp);
  for (let y = 0; y < height; y++) {
    const filterType = raw[y * (rowStride + 1)];
    const src = y * (rowStride + 1) + 1;
    const dst = y * rowStride;
    for (let x = 0; x < rowStride; x++) {
      const left = x >= bpp ? out[dst + x - bpp] : 0;
      const up = y > 0 ? out[dst + x - rowStride] : 0;
      const upLeft = y > 0 && x >= bpp ? out[dst + x - rowStride - bpp] : 0;
      out[dst + x] = unfilterByte(filterType, raw[src + x], left, up, upLeft);
    }
  }
  return out;
}

function toHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function decodePng(pngBytes: Uint8Array): DecodedPng {
  if (pngBytes.length < PNG_SIGNATURE.length) {
    throw new Error('Not a PNG: file too short');
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (pngBytes[i] !== PNG_SIGNATURE[i]) throw new Error('Not a PNG: invalid signature');
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  let palette: Uint8Array | null = null;
  let transparency: Uint8Array | null = null;
  const idatChunks: Uint8Array[] = [];

  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= pngBytes.length) {
    const length = readU32BE(pngBytes, offset);
    const typeOffset = offset + 4;
    const dataOffset = offset + 8;
    const crcOffset = dataOffset + length;
    if (crcOffset + 4 > pngBytes.length) throw new Error('Corrupt PNG chunk length');
    const type = String.fromCharCode(
      pngBytes[typeOffset],
      pngBytes[typeOffset + 1],
      pngBytes[typeOffset + 2],
      pngBytes[typeOffset + 3],
    );
    const data = pngBytes.slice(dataOffset, dataOffset + length);

    if (type === 'IHDR') {
      if (length !== 13) throw new Error('Invalid IHDR length');
      width = readU32BE(data, 0);
      height = readU32BE(data, 4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'tRNS') {
      transparency = data;
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset = crcOffset + 4;
  }

  if (!width || !height) throw new Error('PNG missing IHDR');
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${bitDepth}; only 8-bit PNGs are supported`);
  if (interlace !== 0) throw new Error('Unsupported PNG interlace method; only non-interlaced PNGs are supported');
  if (idatChunks.length === 0) throw new Error('PNG missing IDAT data');

  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 3 ? 1 : 0;
  if (bpp === 0) {
    throw new Error(`Unsupported PNG color type ${colorType}; only RGB(2), RGBA(6), and indexed(3) are supported`);
  }

  const compressed = Buffer.concat(idatChunks.map((chunk) => Buffer.from(chunk)));
  const unfiltered = unfilterScanlines(new Uint8Array(inflateSync(compressed)), width, height, bpp);
  const rgba = new Uint8Array(width * height * 4);

  if (colorType === 6) {
    for (let i = 0; i < width * height; i++) {
      const src = i * 4;
      const dst = i * 4;
      rgba[dst] = unfiltered[src];
      rgba[dst + 1] = unfiltered[src + 1];
      rgba[dst + 2] = unfiltered[src + 2];
      rgba[dst + 3] = unfiltered[src + 3];
    }
  } else if (colorType === 2) {
    for (let i = 0; i < width * height; i++) {
      const src = i * 3;
      const dst = i * 4;
      rgba[dst] = unfiltered[src];
      rgba[dst + 1] = unfiltered[src + 1];
      rgba[dst + 2] = unfiltered[src + 2];
      rgba[dst + 3] = 255;
    }
  } else {
    if (!palette || palette.length % 3 !== 0) {
      throw new Error('Indexed PNG missing valid PLTE chunk');
    }
    for (let i = 0; i < width * height; i++) {
      const index = unfiltered[i];
      const p = index * 3;
      if (p + 2 >= palette.length) throw new Error(`Indexed PNG palette index ${index} out of range`);
      const dst = i * 4;
      rgba[dst] = palette[p];
      rgba[dst + 1] = palette[p + 1];
      rgba[dst + 2] = palette[p + 2];
      rgba[dst + 3] = transparency && index < transparency.length ? transparency[index] : 255;
    }
  }

  return { width, height, rgba };
}

export function encodeSpriteFromRgba(
  width: number,
  height: number,
  rgba: Uint8Array,
  maxPaletteSize = SYMBOLS.length,
): Sprite {
  if (rgba.length !== width * height * 4) {
    throw new Error(`RGBA buffer length mismatch (expected ${width * height * 4}, got ${rgba.length})`);
  }
  const pal: Record<string, string> = {};
  const symbolByColor = new Map<string, string>();
  const rows: string[] = [];
  let nextSymbol = 0;

  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = rgba[i + 3];
      if (a < 128) {
        row += '.';
        continue;
      }
      const color = toHex(rgba[i], rgba[i + 1], rgba[i + 2]);
      let symbol = symbolByColor.get(color);
      if (!symbol) {
        if (nextSymbol >= maxPaletteSize || nextSymbol >= SYMBOLS.length) {
          throw new Error(
            `Sprite palette exceeds capacity (${maxPaletteSize}); encountered '${color}' after ${symbolByColor.size} colors`,
          );
        }
        symbol = SYMBOLS[nextSymbol++];
        symbolByColor.set(color, symbol);
        pal[symbol] = color;
      }
      row += symbol;
    }
    rows.push(row);
  }

  return { pal, rows };
}

export function spriteToRgba(sprite: Sprite): { width: number; height: number; rgba: Uint8Array } {
  const height = sprite.rows.length;
  const width = sprite.rows[0]?.length ?? 0;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = sprite.rows[y];
    if (row.length !== width) throw new Error('Sprite rows are ragged');
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      const i = (y * width + x) * 4;
      if (ch === '.') {
        rgba[i] = 0;
        rgba[i + 1] = 0;
        rgba[i + 2] = 0;
        rgba[i + 3] = 0;
        continue;
      }
      const color = sprite.pal[ch];
      if (!color) throw new Error(`Sprite references missing palette key '${ch}'`);
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error(`Unsupported palette color '${color}'`);
      rgba[i] = parseInt(color.slice(1, 3), 16);
      rgba[i + 1] = parseInt(color.slice(3, 5), 16);
      rgba[i + 2] = parseInt(color.slice(5, 7), 16);
      rgba[i + 3] = 255;
    }
  }
  return { width, height, rgba };
}

function toSpriteObjectBlock(key: string, sprite: Sprite): string {
  const palEntries = Object.entries(sprite.pal)
    .map(([symbol, color]) => `${JSON.stringify(symbol)}: ${JSON.stringify(color)}`)
    .join(', ');
  const rows = sprite.rows.map((row) => `      ${JSON.stringify(row)},`).join('\n');
  return [
    `  ${JSON.stringify(key)}: {`,
    `    pal: { ${palEntries} },`,
    '    rows: [',
    rows,
    '    ],',
    '  },',
  ].join('\n');
}

function buildModuleSource(monSprites: Record<string, Sprite>, peopleSprites: Record<string, Sprite>): string {
  const monBlocks = Object.entries(monSprites)
    .map(([key, sprite]) => toSpriteObjectBlock(key, sprite))
    .join('\n');
  const peopleBlocks = Object.entries(peopleSprites)
    .map(([key, sprite]) => toSpriteObjectBlock(key, sprite))
    .join('\n');

  return `/* eslint-disable */
// AUTO-GENERATED by tools/gen-sprites.ts. Do not edit by hand.
import type { Sprite } from '../sprites';

export const MON_SPRITES_GEN: Record<string, Sprite> = {
${monBlocks}
};

export const PEOPLE_SPRITES_GEN: Record<string, Sprite> = {
${peopleBlocks}
};
`;
}

async function loadSpriteDirectory(dir: string): Promise<Record<string, Sprite>> {
  const out: Record<string, Sprite> = {};
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  for (const fileName of files) {
    const key = fileName.slice(0, -4);
    const fullPath = path.join(dir, fileName);
    const bytes = new Uint8Array(await fs.readFile(fullPath));
    const decoded = decodePng(bytes);
    if (decoded.width !== 16 || decoded.height !== 16) {
      throw new Error(`Expected 16x16 PNG at '${fullPath}', got ${decoded.width}x${decoded.height}`);
    }
    out[key] = encodeSpriteFromRgba(decoded.width, decoded.height, decoded.rgba);
  }

  return out;
}

export async function runGenSprites(
  cwd = process.cwd(),
  outFile = path.join('src', 'data', 'sprites.gen.ts'),
): Promise<{ generated: boolean; monCount: number; peopleCount: number; outputPath: string }> {
  const artDir = path.join(cwd, 'art');
  const monDir = path.join(artDir, 'mon');
  const peopleDir = path.join(artDir, 'people');
  try {
    const stat = await fs.stat(artDir);
    if (!stat.isDirectory()) {
      console.log(`Skipping sprite generation: '${artDir}' is not a directory.`);
      return { generated: false, monCount: 0, peopleCount: 0, outputPath: path.join(cwd, outFile) };
    }
  } catch {
    console.log(`Skipping sprite generation: no art directory at '${artDir}'.`);
    return { generated: false, monCount: 0, peopleCount: 0, outputPath: path.join(cwd, outFile) };
  }

  const [monSprites, peopleSprites] = await Promise.all([
    loadSpriteDirectory(monDir).catch((err: unknown) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw err;
    }),
    loadSpriteDirectory(peopleDir).catch((err: unknown) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw err;
    }),
  ]);

  const source = buildModuleSource(monSprites, peopleSprites);
  const outputPath = path.join(cwd, outFile);
  await fs.writeFile(outputPath, source, 'utf8');
  console.log(`Generated ${outputPath} (${Object.keys(monSprites).length} mon, ${Object.keys(peopleSprites).length} people).`);
  return {
    generated: true,
    monCount: Object.keys(monSprites).length,
    peopleCount: Object.keys(peopleSprites).length,
    outputPath,
  };
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  runGenSprites().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
