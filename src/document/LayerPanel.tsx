import { useState } from 'react'
import './LayerPanel.css'
import {
  createLayer,
  moveLayer,
  nextLayerName,
  renameLayer,
  type PaintDocument,
} from './document.ts'

type Props = {
  doc: PaintDocument
  onChange: (doc: PaintDocument) => void
}

function withLayers(doc: PaintDocument, layers: PaintDocument['layers']): PaintDocument {
  const activeLayerId = layers.some((layer) => layer.id === doc.activeLayerId)
    ? doc.activeLayerId
    : (layers.at(-1)?.id ?? doc.activeLayerId)
  return { ...doc, layers, activeLayerId }
}

export function LayerPanel({ doc, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  // Which row the pointer is currently over during a drag — the drop target, not the dragged row.
  const [overId, setOverId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  const add = () => {
    const layer = createLayer(nextLayerName(doc), doc.width, doc.height)
    onChange({ ...doc, layers: [...doc.layers, layer], activeLayerId: layer.id })
  }

  const commitName = (id: string) => {
    setEditingId(null)
    onChange(renameLayer(doc, id, draft))
  }

  const drop = (targetId: string) => {
    const from = doc.layers.findIndex((layer) => layer.id === dragId)
    const to = doc.layers.findIndex((layer) => layer.id === targetId)
    setDragId(null)
    setOverId(null)
    if (from >= 0 && to >= 0) onChange(moveLayer(doc, from, to))
  }

  return (
    <div className="layers">
      {/* Topmost first: the panel reads the way the art stacks, the array composites the other way. */}
      {[...doc.layers].reverse().map((layer) => {
        const index = doc.layers.indexOf(layer)
        const editing = editingId === layer.id
        return (
          <div
            key={layer.id}
            className={`layers__row${layer.id === doc.activeLayerId ? ' layers__row--active' : ''}${
              layer.id === overId && layer.id !== dragId ? ' layers__row--drop' : ''
            }`}
            // A draggable ancestor swallows the caret and the text selection inside an input, so
            // the row stops being draggable for as long as it is being renamed.
            draggable={!editing}
            onDragStart={() => setDragId(layer.id)}
            onDragEnd={() => {
              setDragId(null)
              setOverId(null)
            }}
            onDragOver={(event) => {
              if (!dragId) return
              // Without this the browser refuses the drop and runs no `onDrop` at all.
              event.preventDefault()
              setOverId(layer.id)
            }}
            onDrop={(event) => {
              event.preventDefault()
              drop(layer.id)
            }}
          >
            <button
              type="button"
              className="layers__toggle"
              aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
              aria-pressed={layer.visible}
              onClick={() =>
                onChange(
                  withLayers(
                    doc,
                    doc.layers.map((item) =>
                      item.id === layer.id ? { ...item, visible: !item.visible } : item,
                    ),
                  ),
                )
              }
            >
              {layer.visible ? '◉' : '○'}
            </button>
            {editing ? (
              <input
                className="layers__rename"
                aria-label={`Rename ${layer.name}`}
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => commitName(layer.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitName(layer.id)
                  else if (event.key === 'Escape') setEditingId(null)
                }}
              />
            ) : (
              <button
                type="button"
                className="layers__name"
                title="Drag to reorder, double-click to rename"
                onClick={() => onChange({ ...doc, activeLayerId: layer.id })}
                onDoubleClick={() => {
                  setDraft(layer.name)
                  setEditingId(layer.id)
                }}
              >
                {layer.name}
              </button>
            )}
            <button
              type="button"
              className="layers__step"
              aria-label={`Move ${layer.name} up`}
              disabled={index === doc.layers.length - 1}
              onClick={() => onChange(moveLayer(doc, index, index + 1))}
            >
              ↑
            </button>
            <button
              type="button"
              className="layers__step"
              aria-label={`Move ${layer.name} down`}
              disabled={index === 0}
              onClick={() => onChange(moveLayer(doc, index, index - 1))}
            >
              ↓
            </button>
            <button
              type="button"
              className="layers__step"
              aria-label={`Delete ${layer.name}`}
              disabled={doc.layers.length === 1}
              onClick={() =>
                onChange(withLayers(doc, doc.layers.filter((item) => item.id !== layer.id)))
              }
            >
              ✕
            </button>
          </div>
        )
      })}
      <button type="button" className="btn layers__add" onClick={add}>
        Add layer
      </button>
    </div>
  )
}
