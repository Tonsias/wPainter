import { decodeImageFile } from '../document/composite.ts'
import { quantizeRgba } from '../palette/quantize.ts'
import { WPLACE_COLORS } from '../palette/wplace.ts'
import { splitSpritePath, type Sprite } from './library.ts'

// Every file is decoded and held as pixels, so a large library is a real memory cost. The cap
// is a guard against picking a whole photo archive by accident, not a design limit.
const MAX_SPRITES = 400

type SpriteLoad = { sprites: Sprite[]; skipped: number }

export async function loadSprites(files: readonly File[]): Promise<SpriteLoad> {
  const pngs = files.filter((file) => /\.png$/i.test(file.name))
  const accepted = pngs.slice(0, MAX_SPRITES)
  const sprites: Sprite[] = []
  let failed = 0
  for (const file of accepted) {
    try {
      const image = await decodeImageFile(file)
      const { folder, name } = splitSpritePath(file.webkitRelativePath || file.name)
      sprites.push({
        id: `${file.webkitRelativePath || file.name}:${file.size}`,
        name,
        folder,
        width: image.width,
        height: image.height,
        // Always the full palette: a free-colours-only session remaps on the way out instead,
        // which costs one table rather than a re-decode of the whole library.
        pixels: quantizeRgba(image.rgba, WPLACE_COLORS.length),
      })
    } catch {
      failed += 1
    }
  }
  return { sprites, skipped: files.length - accepted.length + failed }
}
