// A row in the tree, not an image: the file is held unread, and its pixels only exist once
// something asks `loadSpriteImage` for them. That is what lets a folder of thousands open at once.
export type Sprite = {
  readonly id: string
  readonly name: string
  readonly folder: string
  readonly file: File
}

// Nearest-neighbour factors, so an up-scale stays on whole source pixels; the ones below 1 are
// there for a sprite that arrives larger than the template it has to fit into. A third is spelled
// out rather than written `1 / 3`, because `as const` keeps a literal literal but not an expression.
export const SPRITE_SCALES = [0.25, 0.3333333333333333, 0.5, 1, 2, 3, 4, 6, 8] as const
export type SpriteScale = (typeof SPRITE_SCALES)[number]

export const spriteScaleLabel = (scale: SpriteScale): string =>
  scale < 1 ? `1/${Math.round(1 / scale)}` : `${scale}×`

// The picked directory itself is the root: its `path` and `name` are empty, and only its
// children carry a folder name.
export type SpriteNode = {
  readonly path: string
  readonly name: string
  readonly folders: readonly SpriteNode[]
  readonly sprites: readonly Sprite[]
}

type Draft = {
  path: string
  name: string
  folders: Map<string, Draft>
  sprites: Sprite[]
}

// Everything `createImageBitmap` decodes, which is what the sprite loader runs every file
// through; an animated GIF contributes its first frame.
export const SPRITE_FILE = /\.(png|gif|webp|bmp|jpe?g)$/i

// `webkitRelativePath` always starts with the picked directory itself; dropping that segment
// keeps the labels about the structure inside the folder rather than where it happened to live.
export function splitSpritePath(relativePath: string): { folder: string; name: string } {
  const segments = relativePath.split('/').filter(Boolean)
  const file = segments.pop() ?? relativePath
  return { folder: segments.slice(1).join('/'), name: file.replace(SPRITE_FILE, '') }
}

function descend(parent: Draft, name: string): Draft {
  const existing = parent.folders.get(name)
  if (existing) return existing
  const made: Draft = {
    path: parent.path ? `${parent.path}/${name}` : name,
    name,
    folders: new Map(),
    sprites: [],
  }
  parent.folders.set(name, made)
  return made
}

function settle(draft: Draft): SpriteNode {
  return {
    path: draft.path,
    name: draft.name,
    folders: [...draft.folders.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(settle),
    sprites: [...draft.sprites].sort((a, b) => a.name.localeCompare(b.name)),
  }
}

export function buildSpriteTree(sprites: readonly Sprite[]): SpriteNode {
  const root: Draft = { path: '', name: '', folders: new Map(), sprites: [] }
  for (const sprite of sprites) {
    let node = root
    for (const segment of sprite.folder.split('/').filter(Boolean)) node = descend(node, segment)
    node.sprites.push(sprite)
  }
  return settle(root)
}

export function countSprites(node: SpriteNode): number {
  return node.folders.reduce((sum, child) => sum + countSprites(child), node.sprites.length)
}

export function matchesQuery(sprite: Sprite, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return `${sprite.folder}/${sprite.name}`.toLowerCase().includes(needle)
}
