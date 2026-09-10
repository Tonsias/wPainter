import { describe, expect, it } from 'vitest'
import { buildSpriteTree, countSprites, matchesQuery, splitSpritePath, type Sprite } from './library.ts'

const sprite = (folder: string, name: string): Sprite => ({
  id: `${folder}/${name}`,
  name,
  folder,
  width: 1,
  height: 1,
  pixels: new Uint8Array(1),
})

describe('splitSpritePath', () => {
  it('drops the picked directory and the .png suffix', () => {
    expect(splitSpritePath('assets/trees/oak.png')).toEqual({ folder: 'trees', name: 'oak' })
  })

  it('reports a file sitting directly in the picked directory as folderless', () => {
    expect(splitSpritePath('assets/oak.PNG')).toEqual({ folder: '', name: 'oak' })
  })

  it('keeps nested folders as one readable path', () => {
    expect(splitSpritePath('assets/a/b/c.png').folder).toBe('a/b')
  })
})

describe('buildSpriteTree', () => {
  it('sorts folders and the sprites inside each of them', () => {
    const root = buildSpriteTree([sprite('b', 'z'), sprite('a', 'y'), sprite('b', 'a')])
    expect(root.folders.map((node) => node.name)).toEqual(['a', 'b'])
    expect(root.folders[1].sprites.map((item) => item.name)).toEqual(['a', 'z'])
  })

  it('nests a path into one node per segment and keeps the full path on each', () => {
    const root = buildSpriteTree([sprite('a/b', 'deep'), sprite('a', 'shallow')])
    const [a] = root.folders
    expect(a.path).toBe('a')
    expect(a.sprites.map((item) => item.name)).toEqual(['shallow'])
    expect(a.folders.map((node) => node.path)).toEqual(['a/b'])
    expect(a.folders[0].sprites.map((item) => item.name)).toEqual(['deep'])
  })

  it('keeps a folderless sprite on the root node', () => {
    expect(buildSpriteTree([sprite('', 'loose')]).sprites).toHaveLength(1)
  })
})

describe('countSprites', () => {
  it('counts the whole subtree, not just the node itself', () => {
    const root = buildSpriteTree([sprite('a/b', 'one'), sprite('a', 'two'), sprite('', 'three')])
    expect(countSprites(root)).toBe(3)
    expect(countSprites(root.folders[0])).toBe(2)
  })
})

describe('matchesQuery', () => {
  it('matches on folder and name, case-insensitively, and passes everything on empty', () => {
    expect(matchesQuery(sprite('Trees', 'Oak'), 'tree')).toBe(true)
    expect(matchesQuery(sprite('Trees', 'Oak'), 'OAK')).toBe(true)
    expect(matchesQuery(sprite('Trees', 'Oak'), 'rock')).toBe(false)
    expect(matchesQuery(sprite('Trees', 'Oak'), '  ')).toBe(true)
  })
})
