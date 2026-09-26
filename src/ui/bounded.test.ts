import { describe, expect, it } from 'vitest'
import { parseBounded } from './bounded.ts'

describe('parseBounded', () => {
  it('commits nothing until the text is a number', () => {
    expect(parseBounded('', 1, 64)).toBeNull()
    expect(parseBounded('  ', 1, 64)).toBeNull()
    expect(parseBounded('-', 1, 64)).toBeNull()
    expect(parseBounded('abc', 1, 64)).toBeNull()
  })

  it('rounds to a whole value and clamps into the range', () => {
    expect(parseBounded('12', 1, 64)).toBe(12)
    expect(parseBounded('12.6', 1, 64)).toBe(13)
    expect(parseBounded('0', 1, 64)).toBe(1)
    expect(parseBounded('500', 1, 64)).toBe(64)
  })
})
