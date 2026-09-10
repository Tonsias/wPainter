import { EMPTY_PIXEL } from '../palette/wplace.ts'

export type PixelBuffer = {
  readonly pixels: Uint8Array
  readonly width: number
  readonly height: number
}

// A square nib, offset so odd sizes centre on the cursor and even sizes lean up-left — the
// convention every pixel editor uses, and the only one that keeps size 1 exactly on the cursor.
export function paintDot(target: PixelBuffer, x: number, y: number, size: number, value: number) {
  const start = -Math.floor((size - 1) / 2)
  for (let dy = 0; dy < size; dy += 1) {
    const py = y + start + dy
    if (py < 0 || py >= target.height) continue
    for (let dx = 0; dx < size; dx += 1) {
      const px = x + start + dx
      if (px < 0 || px >= target.width) continue
      target.pixels[py * target.width + px] = value
    }
  }
}

// Bresenham, so a fast drag paints a connected line instead of a dotted trail of pointer events.
export function paintLine(
  target: PixelBuffer,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number,
  value: number,
) {
  let x = fromX
  let y = fromY
  const stepX = fromX < toX ? 1 : -1
  const stepY = fromY < toY ? 1 : -1
  const deltaX = Math.abs(toX - fromX)
  const deltaY = -Math.abs(toY - fromY)
  let error = deltaX + deltaY
  for (;;) {
    paintDot(target, x, y, size, value)
    if (x === toX && y === toY) return
    const doubled = 2 * error
    if (doubled >= deltaY) {
      error += deltaY
      x += stepX
    }
    if (doubled <= deltaX) {
      error += deltaX
      y += stepY
    }
  }
}

// Scanline flood fill: an explicit stack rather than recursion, which blows the call stack on a
// large uniform region.
export function floodFill(target: PixelBuffer, x: number, y: number, value: number) {
  const { pixels, width, height } = target
  const start = pixels[y * width + x]
  if (start === value) return
  const stack = [x, y]
  while (stack.length > 0) {
    const seedY = stack.pop() as number
    let left = stack.pop() as number
    while (left > 0 && pixels[seedY * width + left - 1] === start) left -= 1
    let right = left
    let spanAbove = false
    let spanBelow = false
    while (right < width && pixels[seedY * width + right] === start) {
      pixels[seedY * width + right] = value
      const above = seedY > 0 && pixels[(seedY - 1) * width + right] === start
      if (above && !spanAbove) stack.push(right, seedY - 1)
      spanAbove = above
      const below = seedY < height - 1 && pixels[(seedY + 1) * width + right] === start
      if (below && !spanBelow) stack.push(right, seedY + 1)
      spanBelow = below
      right += 1
    }
  }
}

// Holes in the sprite stay holes in the target: a stamp composites, it does not blit a rectangle.
export function stamp(target: PixelBuffer, source: PixelBuffer, atX: number, atY: number) {
  for (let y = 0; y < source.height; y += 1) {
    const py = atY + y
    if (py < 0 || py >= target.height) continue
    for (let x = 0; x < source.width; x += 1) {
      const px = atX + x
      if (px < 0 || px >= target.width) continue
      const value = source.pixels[y * source.width + x]
      if (value !== EMPTY_PIXEL) target.pixels[py * target.width + px] = value
    }
  }
}

// Top-left of a stamp centred on the cursor.
export function stampOrigin(cursor: number, extent: number): number {
  return cursor - Math.floor(extent / 2)
}
