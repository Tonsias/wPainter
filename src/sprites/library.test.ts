import { describe, expect, it } from 'vitest'
import { groupByFolder, matchesQuery, splitSpritePath, type Sprite } from './library.ts'

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

describe('groupByFolder', () => {
  it('sorts folders and the sprites inside each of them', () => {
    const grouped = groupByFolder([sprite('b', 'z'), sprite('a', 'y'), sprite('b', 'a')])
    expect(grouped.map((group) => group.folder)).toEqual(['a', 'b'])
    expect(grouped[1].sprites.map((item) => item.name)).toEqual(['a', 'z'])
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
