import { describe, expect, it } from 'vitest'
import { createLayer, moveLayer, renameLayer, type PaintDocument } from './document.ts'

const docOf = (...names: readonly string[]): PaintDocument => {
  const layers = names.map((name) => createLayer(name, 1, 1))
  return { width: 1, height: 1, layers, activeLayerId: layers[0].id }
}

const order = (doc: PaintDocument) => doc.layers.map((layer) => layer.name)

describe('moveLayer', () => {
  it('lands the layer at the target index rather than swapping with it', () => {
    expect(order(moveLayer(docOf('a', 'b', 'c', 'd'), 0, 2))).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves a layer back down the stack', () => {
    expect(order(moveLayer(docOf('a', 'b', 'c', 'd'), 3, 1))).toEqual(['a', 'd', 'b', 'c'])
  })

  it('swaps neighbours, which is what the up and down buttons ask for', () => {
    expect(order(moveLayer(docOf('a', 'b', 'c'), 1, 2))).toEqual(['a', 'c', 'b'])
  })

  it('leaves the document alone for a no-op or an index off the ends', () => {
    const doc = docOf('a', 'b')
    expect(moveLayer(doc, 1, 1)).toBe(doc)
    expect(moveLayer(doc, 0, -1)).toBe(doc)
    expect(moveLayer(doc, 0, 2)).toBe(doc)
  })
})

describe('renameLayer', () => {
  it('renames only the named layer, trimmed', () => {
    const doc = docOf('a', 'b')
    expect(order(renameLayer(doc, doc.layers[1].id, '  Sky  '))).toEqual(['a', 'Sky'])
  })

  it('keeps the old name when the draft is blank', () => {
    const doc = docOf('a')
    expect(renameLayer(doc, doc.layers[0].id, '   ')).toBe(doc)
  })
})
