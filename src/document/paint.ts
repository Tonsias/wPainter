import { EMPTY_PIXEL } from '../palette/wplace.ts'

export type PixelBuffer = {
  readonly pixels: Uint8Array
  readonly width: number
  readonly height: number
}

// Nearest neighbour, because the result has to stay inside the palette: any interpolation would
// invent colours wplace cannot place. Scale 1 returns the source untouched, so the stamp preview
// redrawn on every pointer move costs nothing at the default scale.
export function scalePixelBuffer(source: PixelBuffer, scale: number): PixelBuffer {
  if (scale === 1) return source
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))
  const pixels = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor((y / height) * source.height))
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor((x / width) * source.width))
      pixels[y * width + x] = source.pixels[sourceY * source.width + sourceX]
    }
  }
  return { pixels, width, height }
}

// The eight ways a sprite can be laid down, spelled as the two operations that generate them: a
// count of clockwise quarter turns and one horizontal mirror applied before them. A vertical flip
// is that mirror plus a half turn, so a second axis flag would give some orientations two
// spellings and let the buttons disagree about which one they are on.
export type Orientation = {
  readonly turns: 0 | 1 | 2 | 3
  readonly mirrored: boolean
}

export const UNTURNED: Orientation = { turns: 0, mirrored: false }

// Each of these composes a new operation *onto the result the user is looking at*, which is why
// a mirror reverses the turn count: mirroring after a rotation is the same as rotating the other
// way after a mirror, and only the latter is a state this type can hold.
export const rotateOrientation = ({ turns, mirrored }: Orientation): Orientation => ({
  turns: (((turns + 1) % 4) as Orientation['turns']),
  mirrored,
})

export const flipOrientation = (
  { turns, mirrored }: Orientation,
  axis: 'horizontal' | 'vertical',
): Orientation => ({
  turns: (((axis === 'horizontal' ? 4 - turns : 6 - turns) % 4) as Orientation['turns']),
  mirrored: !mirrored,
})

// Forward mapping, source pixel to destination pixel: a quarter turn is exact on a grid, so
// unlike the scale above nothing is sampled and no pixel is lost or repeated.
export function orientPixelBuffer(source: PixelBuffer, orientation: Orientation): PixelBuffer {
  const { turns, mirrored } = orientation
  if (turns === 0 && !mirrored) return source
  const turned = turns % 2 === 1
  const width = turned ? source.height : source.width
  const height = turned ? source.width : source.height
  const pixels = new Uint8Array(width * height)
  for (let sourceY = 0; sourceY < source.height; sourceY += 1) {
    for (let sourceX = 0; sourceX < source.width; sourceX += 1) {
      const x = mirrored ? source.width - 1 - sourceX : sourceX
      const y = sourceY
      const target =
        turns === 0
          ? y * width + x
          : turns === 1
            ? x * width + (source.height - 1 - y)
            : turns === 2
              ? (source.height - 1 - y) * width + (source.width - 1 - x)
              : (source.width - 1 - x) * width + y
      pixels[target] = source.pixels[sourceY * source.width + sourceX]
    }
  }
  return { pixels, width, height }
}

// The clipped span of a nib of `size` centred on (x, y) — the bounds arithmetic every dot shares.
function eachDotPixel(
  target: PixelBuffer,
  x: number,
  y: number,
  size: number,
  visit: (index: number, px: number, py: number) => void,
) {
  const start = -Math.floor((size - 1) / 2)
  for (let dy = 0; dy < size; dy += 1) {
    const py = y + start + dy
    if (py < 0 || py >= target.height) continue
    for (let dx = 0; dx < size; dx += 1) {
      const px = x + start + dx
      if (px < 0 || px >= target.width) continue
      visit(py * target.width + px, px, py)
    }
  }
}

export function paintDot(
  target: PixelBuffer,
  x: number,
  y: number,
  size: number,
  value: number,
  protect?: number,
) {
  eachDotPixel(target, x, y, size, (index) => {
    if (target.pixels[index] === protect) return
    target.pixels[index] = value
  })
}

// Which colour of the mix a pixel gets, as a hash of its own coordinates and the stroke's seed
// rather than a draw from a generator: the nibs walked along a line overlap, and re-rolling a
// pixel every time one covers it makes the stroke boil under the cursor instead of settling.
// The seed is what still makes two strokes over the same pixels differ.
export function scatterPixel(
  seed: number,
  x: number,
  y: number,
  mix: readonly number[],
): number {
  let hash = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)
  hash = Math.imul(hash ^ (hash >>> 15), 0x2545f491)
  hash ^= hash >>> 13
  return mix[(hash >>> 0) % mix.length]
}

export function paintScatterLine(
  target: PixelBuffer,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number,
  mix: readonly number[],
  seed: number,
) {
  if (mix.length === 0) return
  walkLine(fromX, fromY, toX, toY, (x, y) => {
    eachDotPixel(target, x, y, size, (index, px, py) => {
      target.pixels[index] = scatterPixel(seed, px, py, mix)
    })
  })
}

function walkLine(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  visit: (x: number, y: number) => void,
) {
  let x = fromX
  let y = fromY
  const stepX = fromX < toX ? 1 : -1
  const stepY = fromY < toY ? 1 : -1
  const deltaX = Math.abs(toX - fromX)
  const deltaY = -Math.abs(toY - fromY)
  let error = deltaX + deltaY
  for (;;) {
    visit(x, y)
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

export function paintLine(
  target: PixelBuffer,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number,
  value: number,
) {
  walkLine(fromX, fromY, toX, toY, (x, y) => paintDot(target, x, y, size, value))
}

export function paintOutlineLine(
  target: PixelBuffer,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number,
  fill: number,
  edge: number,
) {
  walkLine(fromX, fromY, toX, toY, (x, y) => {
    paintDot(target, x, y, size + 2, edge, fill)
    paintDot(target, x, y, size, fill)
  })
}

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
// The source arrives already scaled, so what is previewed and what is laid down cannot drift.
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
