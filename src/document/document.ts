type Layer = {
  readonly id: string
  readonly name: string
  readonly visible: boolean
  // Palette index + 1 per pixel, row-major, width * height long. Mutated in place while a
  // stroke is live; history snapshots copy it.
  readonly pixels: Uint8Array
}

export type PaintDocument = {
  readonly width: number
  readonly height: number
  // Bottom-most layer first — compositing walks the array forward, the layer panel backward.
  readonly layers: readonly Layer[]
  readonly activeLayerId: string
}

export const MAX_CANVAS_SIDE = 1024

export function createLayer(name: string, width: number, height: number): Layer {
  return { id: crypto.randomUUID(), name, visible: true, pixels: new Uint8Array(width * height) }
}

export function createDocument(width: number, height: number): PaintDocument {
  const layer = createLayer('Layer 1', width, height)
  return { width, height, layers: [layer], activeLayerId: layer.id }
}

export function cloneDocument(doc: PaintDocument): PaintDocument {
  return {
    ...doc,
    layers: doc.layers.map((layer) => ({ ...layer, pixels: Uint8Array.from(layer.pixels) })),
  }
}

export function activeLayer(doc: PaintDocument): Layer | undefined {
  return doc.layers.find((layer) => layer.id === doc.activeLayerId)
}

export function nextLayerName(doc: PaintDocument): string {
  return `Layer ${doc.layers.length + 1}`
}

// Keeps the top-left corner anchored, so growing a canvas never silently shifts existing art.
export function resizeDocument(doc: PaintDocument, width: number, height: number): PaintDocument {
  const copyWidth = Math.min(width, doc.width)
  const copyHeight = Math.min(height, doc.height)
  return {
    ...doc,
    width,
    height,
    layers: doc.layers.map((layer) => {
      const pixels = new Uint8Array(width * height)
      for (let y = 0; y < copyHeight; y += 1) {
        pixels.set(layer.pixels.subarray(y * doc.width, y * doc.width + copyWidth), y * width)
      }
      return { ...layer, pixels }
    }),
  }
}

// Move rather than swap: a drop has to land the layer *at* the target's index, which for a
// neighbour is what a swap does anyway and for a distant row is not. Indices are into the array,
// so the panel's reversed order needs no arithmetic — "put A where B is" reads the same either way.
export function moveLayer(doc: PaintDocument, from: number, to: number): PaintDocument {
  if (from === to || to < 0 || to >= doc.layers.length) return doc
  const layers = [...doc.layers]
  const [moved] = layers.splice(from, 1)
  layers.splice(to, 0, moved)
  return { ...doc, layers }
}

export function renameLayer(doc: PaintDocument, id: string, name: string): PaintDocument {
  const trimmed = name.trim()
  if (!trimmed) return doc
  return {
    ...doc,
    layers: doc.layers.map((layer) => (layer.id === id ? { ...layer, name: trimmed } : layer)),
  }
}
