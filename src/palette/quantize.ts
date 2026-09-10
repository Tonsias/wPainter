import { EMPTY_PIXEL, PALETTE_RGB } from './wplace.ts'

// Below this the source pixel is treated as a hole rather than as a colour to match, so an
// imported sprite's cut-out background stays a hole instead of becoming near-black.
const ALPHA_THRESHOLD = 128

// Redmean: a weighted RGB distance that tracks perceived difference far better than plain
// Euclidean RGB, at a fraction of the cost of converting every pixel into a Lab space.
export function nearestPaletteIndex(r: number, g: number, b: number, colorCount: number): number {
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let i = 0; i < colorCount; i += 1) {
    const pr = PALETTE_RGB[i * 3]
    const dr = r - pr
    const dg = g - PALETTE_RGB[i * 3 + 1]
    const db = b - PALETTE_RGB[i * 3 + 2]
    const redMean = (r + pr) / 2
    const distance =
      (2 + redMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - redMean) / 256) * db * db
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = i
    }
  }
  return bestIndex + 1
}

export function quantizeRgba(rgba: Uint8ClampedArray, colorCount: number): Uint8Array {
  const pixels = new Uint8Array(rgba.length / 4)
  for (let i = 0; i < pixels.length; i += 1) {
    const offset = i * 4
    pixels[i] =
      rgba[offset + 3] < ALPHA_THRESHOLD
        ? EMPTY_PIXEL
        : nearestPaletteIndex(rgba[offset], rgba[offset + 1], rgba[offset + 2], colorCount)
  }
  return pixels
}

// Sprites are decoded once against the whole palette; a "free colours only" session then walks
// their indices through this table instead of re-decoding every file.
export function remapTable(colorCount: number): Uint8Array {
  const table = new Uint8Array(PALETTE_RGB.length / 3 + 1)
  for (let index = 1; index < table.length; index += 1) {
    const rgb = (index - 1) * 3
    table[index] =
      index <= colorCount
        ? index
        : nearestPaletteIndex(PALETTE_RGB[rgb], PALETTE_RGB[rgb + 1], PALETTE_RGB[rgb + 2], colorCount)
  }
  return table
}

export function remapPixels(pixels: Uint8Array, table: Uint8Array): Uint8Array {
  const out = new Uint8Array(pixels.length)
  for (let i = 0; i < pixels.length; i += 1) out[i] = table[pixels[i]]
  return out
}
