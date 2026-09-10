import { describe, expect, it } from 'vitest'
import type { PixelBuffer } from './paint.ts'
import { clampRect, movePixels, rectBetween, shiftRect } from './selection.ts'

const buffer = (width: number, height: number, values: readonly number[] = []): PixelBuffer => ({
  width,
  height,
  pixels: Uint8Array.from({ length: width * height }, (_, i) => values[i] ?? 0),
})

describe('rectBetween', () => {
  it('includes both corners whichever way the drag ran', () => {
    expect(rectBetween(4, 5, 2, 1)).toEqual({
      x: 2,
      y: 1,
      width: 3,
      height: 5,
    })
  })

  it('selects a single pixel when the drag never left it', () => {
    expect(rectBetween(3, 3, 3, 3)).toEqual({
      x: 3,
      y: 3,
      width: 1,
      height: 1,
    })
  })
})

describe('clampRect', () => {
  it('trims the part that hangs off the canvas', () => {
    expect(clampRect({ x: -2, y: 1, width: 5, height: 9 }, 4, 4)).toEqual({
      x: 0,
      y: 1,
      width: 3,
      height: 3,
    })
  })

  it('is null once nothing is left on the canvas', () => {
    expect(clampRect(shiftRect({ x: 0, y: 0, width: 2, height: 2 }, 8, 0), 4, 4)).toBeNull()
  })
})

describe('movePixels', () => {
  it('moves a region and leaves a hole behind it', () => {
    const source = buffer(3, 3, [1, 2, 0, 0, 0, 0, 0, 0, 0])
    const target = buffer(3, 3)
    movePixels(target, source, { x: 0, y: 0, width: 2, height: 1 }, 1, 1)
    expect([...target.pixels]).toEqual([0, 0, 0, 0, 1, 2, 0, 0, 0])
  })

  it('composites over the landing pixels instead of blanking them', () => {
    const source = buffer(2, 2, [5, 0, 7, 7])
    const target = buffer(2, 2)
    movePixels(target, source, { x: 0, y: 0, width: 2, height: 1 }, 0, 1)
    expect([...target.pixels]).toEqual([0, 0, 5, 7])
  })

  it('moves the whole layer when there is no region, dropping what leaves the canvas', () => {
    const source = buffer(3, 1, [1, 2, 3])
    const target = buffer(3, 1)
    movePixels(target, source, null, 1, 0)
    expect([...target.pixels]).toEqual([0, 1, 2])
  })

  it('starts from the source every time, so a drag back to zero restores it', () => {
    const source = buffer(3, 1, [1, 2, 3])
    const target = buffer(3, 1)
    movePixels(target, source, null, 2, 0)
    movePixels(target, source, null, 0, 0)
    expect([...target.pixels]).toEqual([1, 2, 3])
  })
})
