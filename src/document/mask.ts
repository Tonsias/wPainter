import { ALPHA_THRESHOLD } from '../palette/quantize.ts'

export type DecodedImage = { width: number; height: number; rgba: Uint8ClampedArray }

// Clears every pixel the mask covers, so two templates can be painted as non-overlapping
// passes. Anchored top-left like every other size mismatch here: a mask smaller than the
// document leaves the rest of it alone rather than stretching to fit.
export function punchMask(
  target: Uint8ClampedArray,
  width: number,
  height: number,
  mask: DecodedImage,
) {
  const rows = Math.min(height, mask.height)
  const columns = Math.min(width, mask.width)
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      if (mask.rgba[(y * mask.width + x) * 4 + 3] < ALPHA_THRESHOLD) continue
      const offset = (y * width + x) * 4
      target[offset] = 0
      target[offset + 1] = 0
      target[offset + 2] = 0
      target[offset + 3] = 0
    }
  }
}
