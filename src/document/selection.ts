import { EMPTY_PIXEL } from '../palette/wplace.ts'
import type { PixelBuffer } from './paint.ts'

export type Rect = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

// Both corners are inclusive: a drag that starts and ends on the same pixel selects that pixel.
export function rectBetween(fromX: number, fromY: number, toX: number, toY: number): Rect {
  return {
    x: Math.min(fromX, toX),
    y: Math.min(fromY, toY),
    width: Math.abs(toX - fromX) + 1,
    height: Math.abs(toY - fromY) + 1,
  }
}

export function shiftRect(rect: Rect, dx: number, dy: number): Rect {
  return { ...rect, x: rect.x + dx, y: rect.y + dy }
}

// Null once nothing of the rect is left on the canvas — the same thing a move that drags a
// selection clean off the edge does to its pixels.
export function clampRect(rect: Rect, width: number, height: number): Rect | null {
  const x = Math.max(rect.x, 0)
  const y = Math.max(rect.y, 0)
  const right = Math.min(rect.x + rect.width, width)
  const bottom = Math.min(rect.y + rect.height, height)
  if (right <= x || bottom <= y) return null
  return { x, y, width: right - x, height: bottom - y }
}

// `source` is the layer as it was when the drag began, so a wandering drag neither smears the
// content nor eats what it passed over. `region` null moves everything the layer holds.
// Holes stay holes, like a stamp: moved pixels composite over what they land on.
export function movePixels(
  target: PixelBuffer,
  source: PixelBuffer,
  region: Rect | null,
  dx: number,
  dy: number,
) {
  const { width, height } = target
  const area = clampRect(region ?? { x: 0, y: 0, width, height }, width, height)
  target.pixels.set(source.pixels)
  if (!area) return
  for (let y = area.y; y < area.y + area.height; y += 1) {
    target.pixels.fill(EMPTY_PIXEL, y * width + area.x, y * width + area.x + area.width)
  }
  for (let y = area.y; y < area.y + area.height; y += 1) {
    const toY = y + dy
    if (toY < 0 || toY >= height) continue
    for (let x = area.x; x < area.x + area.width; x += 1) {
      const toX = x + dx
      if (toX < 0 || toX >= width) continue
      const value = source.pixels[y * width + x]
      if (value !== EMPTY_PIXEL) target.pixels[toY * width + toX] = value
    }
  }
}
