import { decodeImageFile } from '../document/composite.ts'
import { quantizeRgba } from '../palette/quantize.ts'
import { WPLACE_COLORS } from '../palette/wplace.ts'
import { SPRITE_FILE, splitSpritePath, type Sprite } from './library.ts'

// Every sprite is held as one byte per pixel, so what a library really costs is its pixel count,
// not its file count: 3000 tile sprites are a few megabytes, 300 photographs are hundreds. The
// budget is a guard against picking a photo archive by accident, not a design limit.
const MAX_PIXELS = 960_000_000

// Decoding is asynchronous and mostly waiting, so a folder of thousands of small files is far
// faster in flights than one at a time — but an unbounded Promise.all over all of them opens
// thousands of decodes at once and stalls the tab.
const IN_FLIGHT = 24
const MAX_REPORTED_ISSUES = 100

type SpriteLoad = { sprites: Sprite[]; skipped: number; issues: string[] }

// A file paired with where it sits inside the picked folder: a directory handle's files know
// nothing of their own path, and `webkitRelativePath` is read-only, so the pair is what both
// ways of choosing a folder can produce.
export type SpriteFile = { readonly file: File; readonly path: string }

function explainError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'EncodingError' || error.name === 'NotSupportedError') {
      return 'das Bildformat oder die Bilddaten werden vom Browser nicht unterstützt'
    }
    if (error.name === 'InvalidStateError') return 'die Bilddaten sind ungültig oder beschädigt'
    if (error.name === 'SecurityError') return 'der Browser hat den Zugriff auf die Bilddaten verweigert'
    if (error.name === 'QuotaExceededError') return 'der verfügbare Speicher des Browsers reicht nicht aus'
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return 'die Bilddaten konnten nicht dekodiert werden'
}

type SpriteRead = { sprite: Sprite | null; error?: string }

async function readSprite({ file, path }: SpriteFile): Promise<SpriteRead> {
  try {
    const image = await decodeImageFile(file)
    const { folder, name } = splitSpritePath(path)
    return {
      sprite: {
        id: `${path}:${file.size}`,
        name,
        folder,
        width: image.width,
        height: image.height,
        // Always the full palette: a free-colours-only session remaps on the way out instead,
        // which costs one table rather than a re-decode of the whole library.
        pixels: quantizeRgba(image.rgba, WPLACE_COLORS.length),
      },
    }
  } catch (error) {
    return { sprite: null, error: `${path}: ${explainError(error)}` }
  }
}

export async function loadSprites(files: readonly SpriteFile[]): Promise<SpriteLoad> {
  const images = files.filter(({ file }) => SPRITE_FILE.test(file.name))
  const sprites: Sprite[] = []
  const issues: string[] = []
  let pixels = 0
  for (let start = 0; start < images.length; start += IN_FLIGHT) {
    const batch = await Promise.all(images.slice(start, start + IN_FLIGHT).map(readSprite))
    for (const result of batch) {
      if (!result.sprite) {
        if (result.error && issues.length < MAX_REPORTED_ISSUES) issues.push(result.error)
        continue
      }
      pixels += result.sprite.width * result.sprite.height
      if (pixels > MAX_PIXELS) {
        issues.push(
          `Das Pixel-Limit von ${MAX_PIXELS.toLocaleString('de-DE')} Pixeln wurde erreicht; weitere Bilder wurden übersprungen.`,
        )
        return { sprites, skipped: files.length - sprites.length, issues }
      }
      sprites.push(result.sprite)
    }
  }
  const unsupported = files.length - images.length
  if (unsupported > 0) {
    issues.unshift(
      `${unsupported} Datei(en) übersprungen: Nur PNG, GIF, WebP, BMP, JPG und JPEG werden als Sprites geladen.`,
    )
  }
  if (issues.length > MAX_REPORTED_ISSUES) {
    issues.length = MAX_REPORTED_ISSUES
    issues.push('Weitere Fehler werden aus Platzgründen nicht angezeigt.')
  }
  return { sprites, skipped: files.length - sprites.length, issues }
}
