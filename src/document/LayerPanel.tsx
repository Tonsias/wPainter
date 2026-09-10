import './LayerPanel.css'
import { createLayer, nextLayerName, type PaintDocument } from './document.ts'

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

function move(doc: PaintDocument, index: number, by: number): PaintDocument {
  const target = index + by
  if (target < 0 || target >= doc.layers.length) return doc
  const layers = [...doc.layers]
  ;[layers[index], layers[target]] = [layers[target], layers[index]]
  return withLayers(doc, layers)
}

export function LayerPanel({ doc, onChange }: Props) {
  const add = () => {
    const layer = createLayer(nextLayerName(doc), doc.width, doc.height)
    onChange({ ...doc, layers: [...doc.layers, layer], activeLayerId: layer.id })
  }

  return (
    <div className="layers">
      {/* Topmost first: the panel reads the way the art stacks, the array composites the other way. */}
      {[...doc.layers].reverse().map((layer) => {
        const index = doc.layers.indexOf(layer)
        return (
          <div
            key={layer.id}
            className={`layers__row${layer.id === doc.activeLayerId ? ' layers__row--active' : ''}`}
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
            <button
              type="button"
              className="layers__name"
              onClick={() => onChange({ ...doc, activeLayerId: layer.id })}
            >
              {layer.name}
            </button>
            <button
              type="button"
              className="layers__step"
              aria-label={`Move ${layer.name} up`}
              disabled={index === doc.layers.length - 1}
              onClick={() => onChange(move(doc, index, 1))}
            >
              ↑
            </button>
            <button
              type="button"
              className="layers__step"
              aria-label={`Move ${layer.name} down`}
              disabled={index === 0}
              onClick={() => onChange(move(doc, index, -1))}
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
