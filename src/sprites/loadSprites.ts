import { decodeImageFile } from '../document/composite.ts'
import { quantizeRgba } from '../palette/quantize.ts'
import { WPLACE_COLORS } from '../palette/wplace.ts'
import { SPRITE_FILE, splitSpritePath, type Sprite } from './library.ts'

// Every sprite is held as one byte per pixel, so what a library really costs is its pixel count,
// not its file count: 3000 tile sprites are a few megabytes, 300 photographs are hundreds. The
// budget is a guard against picking a photo archive by accident, not a design limit.
const MAX_PIXELS = 96_000_000

// Decoding is asynchronous and mostly waiting, so a folder of thousands of small files is far
// faster in flights than one at a time — but an unbounded Promise.all over all of them opens
// thousands of decodes at once and stalls the tab.
const IN_FLIGHT = 24

type SpriteLoad = { sprites: Sprite[]; skipped: number }

// A file paired with where it sits inside the picked folder: a directory handle's files know
// nothing of their own path, and `webkitRelativePath` is read-only, so the pair is what both
// ways of choosing a folder can produce.
export type SpriteFile = { readonly file: File; readonly path: string }

async function readSprite({ file, path }: SpriteFile): Promise<Sprite | null> {
  try {
    const image = await decodeImageFile(file)
    const { folder, name } = splitSpritePath(path)
    return {
      id: `${path}:${file.size}`,
      name,
      folder,
      width: image.width,
      height: image.height,
      // Always the full palette: a free-colours-only session remaps on the way out instead,
      // which costs one table rather than a re-decode of the whole library.
      pixels: quantizeRgba(image.rgba, WPLACE_COLORS.length),
    }
  } catch {
    return null
  }
}

export async function loadSprites(files: readonly SpriteFile[]): Promise<SpriteLoad> {
  const images = files.filter(({ file }) => SPRITE_FILE.test(file.name))
  const sprites: Sprite[] = []
  let pixels = 0
  for (let start = 0; start < images.length; start += IN_FLIGHT) {
    const batch = await Promise.all(images.slice(start, start + IN_FLIGHT).map(readSprite))
    for (const sprite of batch) {
      if (!sprite) continue
      pixels += sprite.width * sprite.height
      if (pixels > MAX_PIXELS) return { sprites, skipped: files.length - sprites.length }
      sprites.push(sprite)
    }
  }
  return { sprites, skipped: files.length - sprites.length }
}
