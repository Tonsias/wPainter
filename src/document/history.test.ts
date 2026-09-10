import { describe, expect, it } from 'vitest'
import { EMPTY_HISTORY, commit, redo, undo } from './history.ts'
import { createDocument, type PaintDocument } from './document.ts'

const docNamed = (name: string): PaintDocument => ({ ...createDocument(1, 1), activeLayerId: name })

describe('history', () => {
  it('walks back and forth over committed states', () => {
    const first = docNamed('a')
    const second = docNamed('b')
    const afterCommit = commit(EMPTY_HISTORY, first)
    const undone = undo(afterCommit, second)
    expect(undone?.doc).toBe(first)
    expect(redo(undone!.history, undone!.doc)?.doc).toBe(second)
  })

  it('returns null at both ends instead of throwing', () => {
    expect(undo(EMPTY_HISTORY, docNamed('a'))).toBeNull()
    expect(redo(EMPTY_HISTORY, docNamed('a'))).toBeNull()
  })

  it('drops the redo branch as soon as a new state is committed', () => {
    const undone = undo(commit(EMPTY_HISTORY, docNamed('a')), docNamed('b'))!
    expect(commit(undone.history, docNamed('c')).future).toHaveLength(0)
  })
})
