import { EMPTY_PIXEL, PALETTE_RGB } from '../palette/wplace.ts'
import type { PaintDocument } from './document.ts'

// Paints over `target` without clearing it, so a caller can stack buffers; holes leave whatever
// is underneath untouched.
export function writePixels(pixels: Uint8Array, target: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 1) {
    const value = pixels[i]
    if (value === EMPTY_PIXEL) continue
    const color = (value - 1) * 3
    const offset = i * 4
    target[offset] = PALETTE_RGB[color]
    target[offset + 1] = PALETTE_RGB[color + 1]
    target[offset + 2] = PALETTE_RGB[color + 2]
    target[offset + 3] = 255
  }
}

// Layers are opaque or absent — there is no per-layer alpha, because wplace has nothing to
// export it to.
export function writeRgba(doc: PaintDocument, target: Uint8ClampedArray) {
  target.fill(0)
  for (const layer of doc.layers) {
    if (layer.visible) writePixels(layer.pixels, target)
  }
}

type DecodedImage = { width: number; height: number; rgba: Uint8ClampedArray }

export async function decodeImageFile(file: Blob): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('2D canvas context unavailable')
    context.drawImage(bitmap, 0, 0)
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
    return { width: bitmap.width, height: bitmap.height, rgba: data }
  } finally {
    bitmap.close()
  }
}

export async function exportPng(doc: PaintDocument, fileName: string) {
  const canvas = new OffscreenCanvas(doc.width, doc.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas context unavailable')
  const image = context.createImageData(doc.width, doc.height)
  writeRgba(doc, image.data)
  context.putImageData(image, 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Revoking in the same tick can cancel the download before the browser has read the blob out
  // of it; one turn of the event loop is enough for it to have taken ownership.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
