import { describe, expect, it } from 'vitest'
import { punchMask } from './mask.ts'

const opaque = (width: number, height: number) =>
  new Uint8ClampedArray(width * height * 4).fill(255)

const mask = (width: number, height: number, alphas: readonly number[]) => ({
  width,
  height,
  rgba: Uint8ClampedArray.from({ length: width * height * 4 }, (_, i) =>
    i % 4 === 3 ? (alphas[(i - 3) / 4] ?? 0) : 255,
  ),
})

const alphaOf = (target: Uint8ClampedArray) =>
  Array.from({ length: target.length / 4 }, (_, i) => target[i * 4 + 3])

describe('punchMask', () => {
  it('clears the pixels the mask covers and keeps the rest', () => {
    const target = opaque(2, 2)
    punchMask(target, 2, 2, mask(2, 2, [255, 0, 0, 255]))
    expect(alphaOf(target)).toEqual([0, 255, 255, 0])
  })

  it('zeroes colour along with alpha, so no cut-out pixel carries a stale colour', () => {
    const target = opaque(1, 1)
    punchMask(target, 1, 1, mask(1, 1, [255]))
    expect(Array.from(target)).toEqual([0, 0, 0, 0])
  })

  it('treats a near-transparent mask pixel as a hole, matching import', () => {
    const target = opaque(2, 1)
    punchMask(target, 2, 1, mask(2, 1, [127, 128]))
    expect(alphaOf(target)).toEqual([255, 0])
  })

  it('anchors a smaller mask top-left instead of stretching it', () => {
    const target = opaque(3, 2)
    punchMask(target, 3, 2, mask(2, 1, [255, 255]))
    expect(alphaOf(target)).toEqual([0, 0, 255, 255, 255, 255])
  })

  it('ignores the part of a larger mask that hangs off the document', () => {
    const target = opaque(2, 1)
    punchMask(target, 2, 1, mask(3, 2, [0, 255, 255, 255, 255, 255]))
    expect(alphaOf(target)).toEqual([255, 0])
  })
})
