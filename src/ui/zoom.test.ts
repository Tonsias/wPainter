import { describe, expect, it } from 'vitest'
import { ZOOMS, fitZoom, zoomStep } from './zoom.ts'

describe('zoomStep', () => {
  it('moves one step per call in the direction of delta', () => {
    expect(zoomStep(1, 1)).toBe(2)
    expect(zoomStep(4, -1)).toBe(2)
  })

  it('saturates at both ends instead of wrapping', () => {
    expect(zoomStep(ZOOMS[0], -1)).toBe(ZOOMS[0])
    expect(zoomStep(ZOOMS[ZOOMS.length - 1], 1)).toBe(ZOOMS[ZOOMS.length - 1])
  })

  it('ignores the magnitude of delta', () => {
    expect(zoomStep(1, 999)).toBe(2)
    expect(zoomStep(2, 0)).toBe(2)
  })
})

describe('fitZoom', () => {
  it('picks the largest zoom that still fits both axes', () => {
    expect(fitZoom(100, 100, 800, 800)).toBe(8)
    expect(fitZoom(100, 400, 800, 800)).toBe(2)
  })

  it('falls back to the smallest zoom when nothing fits', () => {
    expect(fitZoom(4000, 4000, 100, 100)).toBe(ZOOMS[0])
  })
})
