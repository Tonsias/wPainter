import { describe, expect, it } from 'vitest'
import { ZOOMS, zoomStep } from './zoom.ts'

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
