import { deflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { MON_SPRITES, type Sprite } from '../../src/sprites';
import { decodePng, encodeSpriteFromRgba, spriteToRgba } from '../../tools/gen-sprites';

function writeU32BE(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value >>> 0, 0);
  return buf;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = writeU32BE(data.length);
  // CRC is not validated by our decoder; write zeros for the test PNG.
  const crc = Buffer.alloc(4);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function buildPng(
  width: number,
  height: number,
  colorType: number,
  bitDepth: number,
  rawScanlines: Buffer,
  extraChunks: Buffer[] = [],
): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(bitDepth, 8);
  ihdr.writeUInt8(colorType, 9);
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace
  const idat = deflateSync(rawScanlines);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    ...extraChunks,
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('sprite codegen', () => {
  it('decodes a synthetic RGBA PNG and encodes sprite rows', () => {
    // 2x2 RGBA image:
    //  (0,0)=red     (1,0)=transparent
    //  (0,1)=green   (1,1)=red
    const width = 2;
    const height = 2;
    const bpp = 4;
    const rowStride = width * bpp;

    // Filter type 0 (None) for each row.
    const raw = Buffer.alloc(height * (rowStride + 1));
    // Row 0: filter=0, red, transparent
    raw[0] = 0;
    raw[1] = 255; raw[2] = 0; raw[3] = 0; raw[4] = 255; // red
    raw[5] = 0; raw[6] = 0; raw[7] = 0; raw[8] = 0; // transparent
    // Row 1: filter=0, green, red
    raw[9] = 0;
    raw[10] = 0; raw[11] = 255; raw[12] = 0; raw[13] = 255; // green
    raw[14] = 255; raw[15] = 0; raw[16] = 0; raw[17] = 255; // red

    const png = buildPng(width, height, 6, 8, raw);
    const decoded = decodePng(new Uint8Array(png));
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);

    const sprite = encodeSpriteFromRgba(decoded.width, decoded.height, decoded.rgba);
    expect(sprite.pal).toEqual({ a: '#ff0000', b: '#00ff00' });
    expect(sprite.rows).toEqual(['a.', 'ba']);
  });

  it('decodes a PNG using Sub filter (type 1)', () => {
    // 3x1 RGBA image: red, red, green — encoded with Sub filter.
    const width = 3;
    const height = 1;
    const bpp = 4;
    const rowStride = width * bpp;

    const raw = Buffer.alloc(height * (rowStride + 1));
    raw[0] = 1; // Sub filter
    // First pixel: red (stored as-is with Sub)
    raw[1] = 255; raw[2] = 0; raw[3] = 0; raw[4] = 255;
    // Second pixel: red — Sub stores difference from left (all zeros)
    raw[5] = 0; raw[6] = 0; raw[7] = 0; raw[8] = 0;
    // Third pixel: green — Sub stores difference: (0-255, 255-0, 0-0, 255-255) = (1, 255, 0, 0) mod 256
    raw[9] = 1; raw[10] = 255; raw[11] = 0; raw[12] = 0;

    const png = buildPng(width, height, 6, 8, raw);
    const decoded = decodePng(new Uint8Array(png));
    const sprite = encodeSpriteFromRgba(decoded.width, decoded.height, decoded.rgba);
    expect(sprite.pal).toEqual({ a: '#ff0000', b: '#00ff00' });
    expect(sprite.rows).toEqual(['aab']);
  });

  it('decodes a PNG using Paeth filter (type 4)', () => {
    // 2x2 RGBA, all red. Paeth should reconstruct correctly.
    const width = 2;
    const height = 2;
    const bpp = 4;
    const rowStride = width * bpp;

    const raw = Buffer.alloc(height * (rowStride + 1));
    // Row 0: Paeth filter, all zeros (first row, so predictor = 0 → reconstruct = 0... but we want 255)
    // Actually with Paeth on first row: up=0, upLeft=0, so paeth(0,0,0)=0. To get 255 we store 255.
    raw[0] = 4; // Paeth
    raw[1] = 255; raw[2] = 0; raw[3] = 0; raw[4] = 255; // red
    // Second pixel row 0: left=red, up=0, upLeft=0 → paeth(255,0,0)=255. Store 0 to get 255.
    raw[5] = 0; raw[6] = 0; raw[7] = 0; raw[8] = 0;
    // Row 1: Paeth filter
    raw[9] = 4;
    // First pixel row 1: left=0, up=255, upLeft=0 → paeth(0,255,0)=255. Store 0 to get 255.
    raw[10] = 0; raw[11] = 255; raw[12] = 0; raw[13] = 0; // 0+255=255 for G? No...
    // Actually: val=0, left=0, up=255(red R), upLeft=0 → paeth(0,255,0)=255. recon=(0+255)&0xff=255. But we want R=255.
    // Wait, for R channel: left=0 (first pixel in row), up=255 (R of pixel above), upLeft=0. paeth(0,255,0): p=0+255-0=255, pa=|255-0|=255, pb=|255-255|=0, pc=|255-0|=255. pb<=pa and pb<=pc → return b=255. recon=(0+255)&0xff=255. Good.
    // For G channel: left=0, up=0, upLeft=0. paeth(0,0,0)=0. recon=(0+0)&0xff=0. We want G=0. Store 0. Good.
    // For B: same as G. Store 0.
    // For A: left=0, up=255, upLeft=0. Same as R. recon=(0+255)&0xff=255. Store 0.
    raw[10] = 0; raw[11] = 0; raw[12] = 0; raw[13] = 0;
    // Second pixel row 1: left=red, up=red, upLeft=red → paeth(red,red,red)=red. Store 0.
    raw[14] = 0; raw[15] = 0; raw[16] = 0; raw[17] = 0;

    const png = buildPng(width, height, 6, 8, raw);
    const decoded = decodePng(new Uint8Array(png));
    const sprite = encodeSpriteFromRgba(decoded.width, decoded.height, decoded.rgba);
    expect(sprite.pal).toEqual({ a: '#ff0000' });
    expect(sprite.rows).toEqual(['aa', 'aa']);
  });

  it('decodes an RGB (color type 2) PNG as fully opaque', () => {
    // 1x1 RGB image: blue
    const width = 1;
    const height = 1;
    const bpp = 3;
    const rowStride = width * bpp;
    const raw = Buffer.alloc(height * (rowStride + 1));
    raw[0] = 0; // None filter
    raw[1] = 0; raw[2] = 0; raw[3] = 255; // blue

    const png = buildPng(width, height, 2, 8, raw);
    const decoded = decodePng(new Uint8Array(png));
    expect(decoded.rgba[3]).toBe(255); // alpha should be 255 for RGB
    const sprite = encodeSpriteFromRgba(decoded.width, decoded.height, decoded.rgba);
    expect(sprite.pal).toEqual({ a: '#0000ff' });
    expect(sprite.rows).toEqual(['a']);
  });

  it('rejects unsupported bit depth', () => {
    const raw = Buffer.from([0, 255, 0, 0, 255]);
    const png = buildPng(1, 1, 6, 16, raw); // 16-bit
    expect(() => decodePng(new Uint8Array(png))).toThrow(/bit depth 16/);
  });

  it('rejects non-PNG data', () => {
    expect(() => decodePng(new Uint8Array([0, 1, 2, 3]))).toThrow(/Not a PNG/);
  });

  it('errors when palette exceeds capacity', () => {
    // 3x1 image with 3 distinct colors + transparent, maxPalette=2
    const width = 3;
    const height = 1;
    const bpp = 4;
    const rowStride = width * bpp;
    const raw = Buffer.alloc(height * (rowStride + 1));
    raw[0] = 0;
    raw[1] = 255; raw[2] = 0; raw[3] = 0; raw[4] = 255; // red
    raw[5] = 0; raw[6] = 255; raw[7] = 0; raw[8] = 255; // green
    raw[9] = 0; raw[10] = 0; raw[11] = 255; raw[12] = 255; // blue

    const png = buildPng(width, height, 6, 8, raw);
    const decoded = decodePng(new Uint8Array(png));
    expect(() => encodeSpriteFromRgba(decoded.width, decoded.height, decoded.rgba, 2)).toThrow(/palette exceeds capacity/);
  });

  it('round-trips an existing sprite through RGBA and back', () => {
    const original: Sprite = MON_SPRITES.nibbit;
    const { width, height, rgba } = spriteToRgba(original);
    const reencoded = encodeSpriteFromRgba(width, height, rgba);
    const { rgba: rgba2 } = spriteToRgba(reencoded);
    expect(Array.from(rgba2)).toEqual(Array.from(rgba));
  });

  it('round-trips a multi-color sprite (sproutle) through RGBA and back', () => {
    const original: Sprite = MON_SPRITES.sproutle;
    const { width, height, rgba } = spriteToRgba(original);
    const reencoded = encodeSpriteFromRgba(width, height, rgba);
    const { rgba: rgba2 } = spriteToRgba(reencoded);
    expect(Array.from(rgba2)).toEqual(Array.from(rgba));
  });
});
