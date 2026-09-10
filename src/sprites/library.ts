export type Sprite = {
  readonly id: string
  readonly name: string
  readonly folder: string
  readonly width: number
  readonly height: number
  // Palette index + 1, exactly like a layer's buffer, so stamping is a plain copy.
  readonly pixels: Uint8Array
}

type SpriteFolder = {
  readonly folder: string
  readonly sprites: readonly Sprite[]
}

// `webkitRelativePath` always starts with the picked directory itself; dropping that segment
// keeps the labels about the structure inside the folder rather than where it happened to live.
export function splitSpritePath(relativePath: string): { folder: string; name: string } {
  const segments = relativePath.split('/').filter(Boolean)
  const file = segments.pop() ?? relativePath
  return { folder: segments.slice(1).join('/'), name: file.replace(/\.png$/i, '') }
}

export function groupByFolder(sprites: readonly Sprite[]): SpriteFolder[] {
  const byFolder = new Map<string, Sprite[]>()
  for (const sprite of sprites) {
    const bucket = byFolder.get(sprite.folder)
    if (bucket) bucket.push(sprite)
    else byFolder.set(sprite.folder, [sprite])
  }
  return [...byFolder.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, group]) => ({
      folder,
      sprites: [...group].sort((a, b) => a.name.localeCompare(b.name)),
    }))
}

export function matchesQuery(sprite: Sprite, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return `${sprite.folder}/${sprite.name}`.toLowerCase().includes(needle)
}
