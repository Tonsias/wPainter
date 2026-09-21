import { describe, expect, it } from 'vitest'
import {
  UNTURNED,
  flipOrientation,
  floodFill,
  paintDot,
  paintLine,
  paintOutlineLine,
  paintScatterLine,
  orientPixelBuffer,
  scatterPixel,
  rotateOrientation,
  scalePixelBuffer,
  stamp,
  stampOrigin,
  type PixelBuffer,
} from './paint.ts'

const buffer = (width: number, height: number, fill = 0): PixelBuffer => ({
  width,
  height,
  pixels: new Uint8Array(width * height).fill(fill),
})

describe('paintDot', () => {
  it('puts a size-1 nib exactly on the cursor', () => {
    const target = buffer(3, 3)
    paintDot(target, 1, 1, 1, 7)
    expect([...target.pixels]).toEqual([0, 0, 0, 0, 7, 0, 0, 0, 0])
  })

  it('centres an odd nib and clips it at the edges', () => {
    const target = buffer(3, 3)
    paintDot(target, 0, 0, 3, 7)
    expect([...target.pixels]).toEqual([7, 7, 0, 7, 7, 0, 0, 0, 0])
  })
})

describe('paintLine', () => {
  it('paints a connected run between two distant points', () => {
    const target = buffer(5, 5)
    paintLine(target, 0, 0, 4, 4, 1, 3)
    expect([...target.pixels].filter((value) => value === 3)).toHaveLength(5)
    expect(target.pixels[0]).toBe(3)
    expect(target.pixels[24]).toBe(3)
  })

  it('paints a single dot when both ends coincide', () => {
    const target = buffer(3, 3)
    paintLine(target, 1, 1, 1, 1, 1, 3)
    expect([...target.pixels].filter(Boolean)).toHaveLength(1)
  })
})

describe('scatter', () => {
  const mix = [2, 4, 6]

  it('draws only colours the mix contains', () => {
    const target = buffer(8, 8)
    paintScatterLine(target, 0, 0, 7, 7, 4, mix, 12345)
    const painted = [...target.pixels].filter((value) => value !== 0)
    expect(painted.length).toBeGreaterThan(0)
    expect(painted.every((value) => mix.includes(value))).toBe(true)
  })

  it('gives a pixel the same colour however often a stroke covers it', () => {
    const once = buffer(6, 6)
    paintScatterLine(once, 3, 3, 3, 3, 3, mix, 99)
    const twice = buffer(6, 6)
    paintScatterLine(twice, 0, 3, 5, 3, 3, mix, 99)
    expect(twice.pixels[3 * 6 + 3]).toBe(once.pixels[3 * 6 + 3])
  })

  it('lands differently for a different seed', () => {
    const a = buffer(16, 16)
    const b = buffer(16, 16)
    paintScatterLine(a, 0, 0, 15, 15, 8, mix, 1)
    paintScatterLine(b, 0, 0, 15, 15, 8, mix, 2)
    expect([...a.pixels]).not.toEqual([...b.pixels])
  })

  it('reaches every colour of the mix over enough pixels', () => {
    const drawn = new Set<number>()
    for (let x = 0; x < 200; x += 1) drawn.add(scatterPixel(7, x, 0, mix))
    expect([...drawn].sort()).toEqual(mix)
  })

  it('leaves the layer alone when the mix is empty', () => {
    const target = buffer(4, 4)
    paintScatterLine(target, 0, 0, 3, 3, 2, [], 5)
    expect([...target.pixels].every((value) => value === 0)).toBe(true)
  })
})

describe('floodFill', () => {
  it('fills only the connected region of the seed colour', () => {
    const target = buffer(3, 3)
    // A vertical wall down the middle column keeps the two sides apart.
    target.pixels[1] = 9
    target.pixels[4] = 9
    target.pixels[7] = 9
    floodFill(target, 0, 0, 5)
    expect([...target.pixels]).toEqual([5, 9, 0, 5, 9, 0, 5, 9, 0])
  })

  it('is a no-op when the seed already holds the target colour', () => {
    const target = buffer(2, 2, 4)
    floodFill(target, 0, 0, 4)
    expect([...target.pixels]).toEqual([4, 4, 4, 4])
  })
})

describe('stamp', () => {
  it('lets holes in the source keep the target underneath', () => {
    const target = buffer(2, 2, 1)
    const source: PixelBuffer = { width: 2, height: 2, pixels: Uint8Array.from([0, 2, 2, 0]) }
    stamp(target, source, 0, 0)
    expect([...target.pixels]).toEqual([1, 2, 2, 1])
  })

  it('clips a stamp that hangs off the edge', () => {
    const target = buffer(2, 2)
    const source: PixelBuffer = { width: 2, height: 2, pixels: Uint8Array.from([2, 2, 2, 2]) }
    stamp(target, source, 1, 1)
    expect([...target.pixels]).toEqual([0, 0, 0, 2])
  })
})

describe('stampOrigin', () => {
  it('centres the sprite on the cursor', () => {
    expect(stampOrigin(10, 4)).toBe(8)
    expect(stampOrigin(10, 1)).toBe(10)
  })
})

describe('paintOutlineLine', () => {
  it('rings a single dot with the edge colour', () => {
    const target = buffer(3, 3)
    paintOutlineLine(target, 1, 1, 1, 1, 1, 7, [4])
    expect([...target.pixels]).toEqual([4, 4, 4, 4, 7, 4, 4, 4, 4])
  })

  it('keeps the fill unbroken along a dragged stroke', () => {
    const target = buffer(5, 3)
    paintOutlineLine(target, 1, 1, 3, 1, 1, 7, [4])
    expect([...target.pixels]).toEqual([4, 4, 4, 4, 4, 4, 7, 7, 7, 4, 4, 4, 4, 4, 4])
  })

  it('never lets the edge overwrite fill that is already down', () => {
    const target = buffer(3, 3, 7)
    paintOutlineLine(target, 1, 1, 1, 1, 1, 7, [4])
    expect([...target.pixels]).toEqual([7, 7, 7, 7, 7, 7, 7, 7, 7])
  })

  it('lets the fill overwrite anything, edge colour included', () => {
    const target = buffer(3, 3, 4)
    paintOutlineLine(target, 1, 1, 1, 1, 1, 7, [4])
    expect(target.pixels[4]).toBe(7)
  })

  it('paints one ring per colour, outwards from the fill', () => {
    const target = buffer(7, 7)
    paintOutlineLine(target, 3, 3, 3, 3, 1, 7, [4, 5, 6])
    expect([...target.pixels.slice(21, 28)]).toEqual([6, 5, 4, 7, 4, 5, 6])
    expect([...target.pixels.slice(0, 7)]).toEqual([6, 6, 6, 6, 6, 6, 6])
  })

  it('drops the colours past the fourth', () => {
    const target = buffer(13, 13)
    paintOutlineLine(target, 6, 6, 6, 6, 1, 7, [1, 2, 3, 4, 5])
    expect([...target.pixels.slice(78, 91)]).toEqual([0, 0, 4, 3, 2, 1, 7, 1, 2, 3, 4, 0, 0])
  })

  it('keeps an outer ring off the inner rings the stroke already laid down', () => {
    const target = buffer(9, 5)
    paintOutlineLine(target, 2, 2, 6, 2, 1, 7, [4, 5])
    expect([...target.pixels.slice(18, 27)]).toEqual([5, 4, 7, 7, 7, 7, 7, 4, 5])
  })

  it('paints a plain line when no edge colour is picked', () => {
    const target = buffer(3, 3)
    paintOutlineLine(target, 1, 1, 1, 1, 1, 7, [])
    expect([...target.pixels]).toEqual([0, 0, 0, 0, 7, 0, 0, 0, 0])
  })
})

describe('scalePixelBuffer', () => {
  const source = { pixels: Uint8Array.from([1, 2, 3, 4]), width: 2, height: 2 }

  it('hands back the very same buffer at scale 1', () => {
    expect(scalePixelBuffer(source, 1)).toBe(source)
  })

  it('repeats each source pixel into a square block when scaling up', () => {
    const scaled = scalePixelBuffer(source, 2)
    expect([scaled.width, scaled.height]).toEqual([4, 4])
    expect([...scaled.pixels]).toEqual([1, 1, 2, 2, 1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 4, 4])
  })

  it('samples rather than blends when scaling down, so every value stays a palette index', () => {
    const scaled = scalePixelBuffer(source, 0.5)
    expect([scaled.width, scaled.height]).toEqual([1, 1])
    expect([...scaled.pixels]).toEqual([1])
  })

  it('never scales a buffer away to nothing', () => {
    const scaled = scalePixelBuffer({ pixels: new Uint8Array(1), width: 1, height: 1 }, 0.25)
    expect([scaled.width, scaled.height]).toEqual([1, 1])
  })
})

describe('orientPixelBuffer', () => {
  // Wider than it is tall and asymmetric in both axes, so a turn that went the wrong way or an
  // axis that was mirrored instead of the other one cannot pass.
  const source: PixelBuffer = { pixels: new Uint8Array([1, 2, 3, 4, 5, 6]), width: 3, height: 2 }

  it('hands back the source itself when nothing is turned or mirrored', () => {
    expect(orientPixelBuffer(source, UNTURNED)).toBe(source)
  })

  it('turns a quarter clockwise and swaps the side lengths', () => {
    const turned = orientPixelBuffer(source, { turns: 1, mirrored: false })
    expect([turned.width, turned.height]).toEqual([2, 3])
    expect([...turned.pixels]).toEqual([4, 1, 5, 2, 6, 3])
  })

  it('mirrors horizontally before it turns', () => {
    const flipped = orientPixelBuffer(source, { turns: 0, mirrored: true })
    expect([...flipped.pixels]).toEqual([3, 2, 1, 6, 5, 4])
  })

  it('reaches a vertical flip as the mirror plus a half turn', () => {
    const flipped = orientPixelBuffer(source, flipOrientation(UNTURNED, 'vertical'))
    expect([...flipped.pixels]).toEqual([4, 5, 6, 1, 2, 3])
  })
})

describe('rotateOrientation and flipOrientation', () => {
  it('comes back to where it started after four turns', () => {
    const turns = [1, 2, 3, 4].reduce(rotateOrientation, UNTURNED)
    expect(turns).toEqual(UNTURNED)
  })

  it('undoes a flip with the same flip, whatever the sprite is turned to', () => {
    for (const axis of ['horizontal', 'vertical'] as const) {
      for (const turns of [0, 1, 2, 3] as const) {
        const start = { turns, mirrored: true }
        expect(flipOrientation(flipOrientation(start, axis), axis)).toEqual(start)
      }
    }
  })

  // The only claim the two-field model makes that a reader could break: the buttons are allowed
  // to disagree about the spelling of an orientation, never about the pixels it produces.
  it('flips what is on screen rather than what the source looked like', () => {
    const source: PixelBuffer = { pixels: new Uint8Array([1, 2, 3, 4, 5, 6]), width: 3, height: 2 }
    for (const axis of ['horizontal', 'vertical'] as const) {
      for (const turns of [0, 1, 2, 3] as const) {
        for (const mirrored of [false, true]) {
          const shown = orientPixelBuffer(source, { turns, mirrored })
          const flipped = orientPixelBuffer(source, flipOrientation({ turns, mirrored }, axis))
          const expected = new Uint8Array(shown.pixels.length)
          for (let y = 0; y < shown.height; y += 1) {
            for (let x = 0; x < shown.width; x += 1) {
              const from =
                axis === 'horizontal'
                  ? y * shown.width + (shown.width - 1 - x)
                  : (shown.height - 1 - y) * shown.width + x
              expected[y * shown.width + x] = shown.pixels[from]
            }
          }
          expect([...flipped.pixels]).toEqual([...expected])
        }
      }
    }
  })
})
