import { describe, expect, it } from 'vitest'
import {
  ZOOMS,
  anchoredOffset,
  centeredOffset,
  clampOffset,
  fitZoom,
  zoomStep,
} from './zoom.ts'

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

describe('anchoredOffset', () => {
  it('leaves the document point under the anchor where it is', () => {
    const offset = { x: 40, y: 10 }
    const local = { x: 100, y: 50 }
    const next = anchoredOffset(offset, local, 4, 8)
    expect((local.x - next.x) / 8).toBeCloseTo((local.x - offset.x) / 4)
    expect((local.y - next.y) / 8).toBeCloseTo((local.y - offset.y) / 4)
  })

  it('anchors on the cursor, not the canvas origin', () => {
    expect(anchoredOffset({ x: 0, y: 0 }, { x: 100, y: 0 }, 1, 2)).toEqual({ x: -100, y: 0 })
  })
})

describe('clampOffset', () => {
  it('passes an offset that keeps the canvas in view through untouched', () => {
    const offset = { x: 20, y: 30 }
    expect(clampOffset(offset, { width: 200, height: 200 }, { width: 400, height: 400 })).toEqual(
      offset,
    )
  })

  it('keeps a sliver of the canvas inside the viewport on both edges', () => {
    const content = { width: 200, height: 200 }
    const view = { width: 400, height: 400 }
    expect(clampOffset({ x: -9999, y: 9999 }, content, view)).toEqual({ x: -152, y: 352 })
  })

  it('never asks more of a canvas smaller than the margin than the canvas has', () => {
    const clamped = clampOffset({ x: -9999, y: 0 }, { width: 10, height: 10 }, { width: 400, height: 400 })
    expect(clamped.x).toBe(0)
  })
})

describe('centeredOffset', () => {
  it('splits the leftover room evenly, negative when the canvas is the larger one', () => {
    expect(centeredOffset({ width: 200, height: 100 }, { width: 400, height: 400 })).toEqual({
      x: 100,
      y: 150,
    })
    expect(centeredOffset({ width: 600, height: 600 }, { width: 400, height: 400 })).toEqual({
      x: -100,
      y: -100,
    })
  })
})
