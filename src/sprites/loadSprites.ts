import { decodeImageFile } from '../document/composite.ts'
import type { PixelBuffer } from '../document/paint.ts'
import { quantizeRgba } from '../palette/quantize.ts'
import { WPLACE_COLORS } from '../palette/wplace.ts'
import { SPRITE_FILE, splitSpritePath, type Sprite } from './library.ts'

// A file paired with where it sits inside the picked folder: a directory handle's files know
// nothing of their own path, and `webkitRelativePath` is read-only, so the pair is what both
// ways of choosing a folder can produce.
export type SpriteFile = { readonly file: File; readonly path: string }

// Decoded sprites are one byte per pixel and they pile up as the panel is scrolled, so the cache
// is bounded by pixels rather than by entries. Insertion order is eviction order; evicting only
// ever costs a re-decode, never a lost edit.
const MAX_CACHED_PIXELS = 64_000_000

// Scrolling fast past a few thousand rows asks for hundreds of decodes at once, and more than a
// handful in flight only makes each of them — including the one the user is waiting on — slower.
const IN_FLIGHT = 8

const cached = new Map<string, PixelBuffer>()
const pending = new Map<string, Promise<PixelBuffer | null>>()
const waiting: (() => void)[] = []
let cachedPixels = 0
let running = 0

// Indexing is path arithmetic and nothing else — no file is opened here, which is the whole
// point: a library of any size is on screen before the first thumbnail has been decoded.
export function indexSprites(files: readonly SpriteFile[]): Sprite[] {
  return files
    .filter(({ file }) => SPRITE_FILE.test(file.name))
    .map(({ file, path }) => {
      const { folder, name } = splitSpritePath(path)
      return { id: `${path}:${file.size}`, name, folder, file }
    })
}

function remember(id: string, image: PixelBuffer) {
  cached.set(id, image)
  cachedPixels += image.pixels.length
  for (const [key, held] of cached) {
    if (cachedPixels <= MAX_CACHED_PIXELS || key === id) break
    cached.delete(key)
    cachedPixels -= held.pixels.length
  }
}

async function decode(sprite: Sprite): Promise<PixelBuffer | null> {
  if (running >= IN_FLIGHT) await new Promise<void>((resolve) => waiting.push(resolve))
  running += 1
  try {
    const image = await decodeImageFile(sprite.file)
    const buffer = {
      // Always the full palette: a free-colours-only session remaps on the way out instead,
      // which costs one table rather than a re-decode of the whole library.
      pixels: quantizeRgba(image.rgba, WPLACE_COLORS.length),
      width: image.width,
      height: image.height,
    }
    remember(sprite.id, buffer)
    return buffer
  } catch {
    // A file the browser cannot decode simply has no image; the row stays in the tree with a
    // blank thumbnail rather than vanishing from a tree the user is scrolling.
    return null
  } finally {
    running -= 1
    waiting.shift()?.()
  }
}

// One decode per sprite however many callers ask: a thumbnail scrolling into view and the stamp
// tool picking the same sprite must not run the file through the palette match twice.
export function loadSpriteImage(sprite: Sprite): Promise<PixelBuffer | null> {
  const held = cached.get(sprite.id)
  if (held) return Promise.resolve(held)
  const already = pending.get(sprite.id)
  if (already) return already
  const run = decode(sprite).finally(() => pending.delete(sprite.id))
  pending.set(sprite.id, run)
  return run
}
