import type { PaintDocument } from './document.ts'

export type History = {
  readonly past: readonly PaintDocument[]
  readonly future: readonly PaintDocument[]
}

export const EMPTY_HISTORY: History = { past: [], future: [] }

// A full-document snapshot per step. At the canvas sizes wplace templates use this is a few
// hundred KB per step, and the cap is what keeps a long session from growing without bound.
const MAX_STEPS = 40

export function commit(history: History, before: PaintDocument): History {
  return { past: [...history.past, before].slice(-MAX_STEPS), future: [] }
}

export function undo(
  history: History,
  present: PaintDocument,
): { history: History; doc: PaintDocument } | null {
  const previous = history.past.at(-1)
  if (!previous) return null
  return {
    history: { past: history.past.slice(0, -1), future: [present, ...history.future] },
    doc: previous,
  }
}

export function redo(
  history: History,
  present: PaintDocument,
): { history: History; doc: PaintDocument } | null {
  const [next, ...rest] = history.future
  if (!next) return null
  return { history: { past: [...history.past, present], future: rest }, doc: next }
}
