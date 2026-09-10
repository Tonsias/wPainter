import { describe, expect, it } from 'vitest'
import { floodFill, paintDot, paintLine, stamp, stampOrigin, type PixelBuffer } from './paint.ts'

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
