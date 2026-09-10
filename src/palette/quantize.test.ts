import { describe, expect, it } from 'vitest'
import { nearestPaletteIndex, quantizeRgba } from './quantize.ts'
import { EMPTY_PIXEL, FREE_COLOR_COUNT, WPLACE_COLORS } from './wplace.ts'

const indexOfName = (name: string) =>
  WPLACE_COLORS.findIndex((color) => color.name === name) + 1

describe('nearestPaletteIndex', () => {
  it('maps an exact palette colour onto itself', () => {
    expect(nearestPaletteIndex(0, 0, 0, WPLACE_COLORS.length)).toBe(indexOfName('Black'))
    expect(nearestPaletteIndex(0xed, 0x1c, 0x24, WPLACE_COLORS.length)).toBe(indexOfName('Red'))
  })

  it('never returns EMPTY_PIXEL, so an opaque source pixel always gets a colour', () => {
    expect(nearestPaletteIndex(1, 2, 3, WPLACE_COLORS.length)).not.toBe(EMPTY_PIXEL)
  })

  it('stays inside the free colours when the count is limited to them', () => {
    // #aaaaaa is Medium Gray, a premium colour, and the nearest match with the full palette.
    expect(nearestPaletteIndex(0xaa, 0xaa, 0xaa, WPLACE_COLORS.length)).toBe(
      indexOfName('Medium Gray'),
    )
    expect(nearestPaletteIndex(0xaa, 0xaa, 0xaa, FREE_COLOR_COUNT)).toBeLessThanOrEqual(
      FREE_COLOR_COUNT,
    )
  })
})

describe('quantizeRgba', () => {
  it('turns transparent-enough pixels into holes and keeps opaque ones', () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 0, 255, 255, 255, 255])
    expect([...quantizeRgba(rgba, WPLACE_COLORS.length)]).toEqual([
      EMPTY_PIXEL,
      indexOfName('White'),
    ])
  })
})
