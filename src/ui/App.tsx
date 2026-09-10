import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { LayerPanel } from '../document/LayerPanel.tsx'
import { decodeImageFile, exportPng } from '../document/composite.ts'
import {
  MAX_CANVAS_SIDE,
  activeLayer,
  cloneDocument,
  createDocument,
  createLayer,
  resizeDocument,
  type PaintDocument,
} from '../document/document.ts'
import { EMPTY_HISTORY, commit, redo, undo, type History } from '../document/history.ts'
import { floodFill, paintLine, stamp, stampOrigin, type PixelBuffer } from '../document/paint.ts'
import { PalettePanel } from '../palette/PalettePanel.tsx'
import { quantizeRgba, remapPixels, remapTable } from '../palette/quantize.ts'
import { EMPTY_PIXEL, FREE_COLOR_COUNT, WPLACE_COLORS } from '../palette/wplace.ts'
import { SpritePanel } from '../sprites/SpritePanel.tsx'
import { loadSprites } from '../sprites/loadSprites.ts'
import type { Sprite } from '../sprites/library.ts'
import { PaintCanvas, type Point } from './PaintCanvas.tsx'
import { BRUSH_SIZES, TOOLS, TOOL_KEYS, TOOL_LABELS, type BrushSize, type Tool } from './tools.ts'
import { ZOOMS, fitZoom, zoomStep, type Zoom } from './zoom.ts'

const DEFAULT_SIZE = 128

// The frame padding the fit calculation has to leave for, so a freshly imported template is not
// zoomed to exactly the point where the host starts scrolling.
const FRAME_INSET = 40

export function App() {
  const [doc, setDoc] = useState<PaintDocument>(() => createDocument(DEFAULT_SIZE, DEFAULT_SIZE))
  const [history, setHistory] = useState<History>(EMPTY_HISTORY)
  const [tool, setTool] = useState<Tool>('brush')
  const [colorPixel, setColorPixel] = useState(1)
  const [brushSize, setBrushSize] = useState<BrushSize>(1)
  const [freeOnly, setFreeOnly] = useState(false)
  const [zoom, setZoom] = useState<Zoom>(4)
  const [showGrid, setShowGrid] = useState(true)
  const [hover, setHover] = useState<Point | null>(null)
  const [sprites, setSprites] = useState<readonly Sprite[]>([])
  const [spriteId, setSpriteId] = useState<string | null>(null)
  const [spriteLoad, setSpriteLoad] = useState({ loading: false, skipped: 0 })
  const [size, setSize] = useState({ width: DEFAULT_SIZE, height: DEFAULT_SIZE })
  const [error, setError] = useState<string | null>(null)

  const slotRef = useRef<HTMLDivElement>(null)
  // A stroke is one undo step: the snapshot is taken on its first point, not on every move.
  const strokeRef = useRef(false)
  const lastRef = useRef<Point | null>(null)

  const colorCount = freeOnly ? FREE_COLOR_COUNT : WPLACE_COLORS.length
  const remap = useMemo(() => remapTable(colorCount), [colorCount])
  const sprite = sprites.find((item) => item.id === spriteId) ?? null
  const stampBuffer: PixelBuffer | null = useMemo(
    () =>
      sprite && {
        pixels: remapPixels(sprite.pixels, remap),
        width: sprite.width,
        height: sprite.height,
      },
    [sprite, remap],
  )

  // The clone has to happen here and now: a stroke mutates the layer buffer in place, so a clone
  // deferred into the state updater would snapshot the painted result instead of what preceded it.
  const snapshot = () => {
    const before = cloneDocument(doc)
    setHistory((past) => commit(past, before))
  }

  const replaceDocument = (next: PaintDocument) => {
    snapshot()
    setDoc(next)
    setSize({ width: next.width, height: next.height })
  }

  // Every change of canvas size — the first mount, a resize, an import — refits the zoom. Picking
  // a zoom by hand is unaffected, because that leaves the document's dimensions alone.
  useEffect(() => {
    const box = slotRef.current?.getBoundingClientRect()
    if (box) {
      setZoom(fitZoom(doc.width, doc.height, box.width - FRAME_INSET, box.height - FRAME_INSET))
    }
  }, [doc.width, doc.height])

  const paintAt = (point: Point) => {
    const layer = activeLayer(doc)
    if (!layer || !layer.visible) return
    const inside = point.x >= 0 && point.y >= 0 && point.x < doc.width && point.y < doc.height

    if (tool === 'picker') {
      if (!inside) return
      const value = layer.pixels[point.y * doc.width + point.x]
      if (value !== EMPTY_PIXEL) setColorPixel(remap[value])
      return
    }

    const starting = !strokeRef.current
    // Fill and stamp act once per press; only brush and eraser follow the drag.
    if (!starting && (tool === 'fill' || tool === 'stamp')) return
    if (!inside && tool !== 'brush' && tool !== 'eraser') return
    if (starting) {
      snapshot()
      strokeRef.current = true
      lastRef.current = null
    }

    const target: PixelBuffer = { pixels: layer.pixels, width: doc.width, height: doc.height }
    if (tool === 'fill') {
      floodFill(target, point.x, point.y, colorPixel)
    } else if (tool === 'stamp') {
      if (!stampBuffer) return
      stamp(
        target,
        stampBuffer,
        stampOrigin(point.x, stampBuffer.width),
        stampOrigin(point.y, stampBuffer.height),
      )
    } else {
      const from = lastRef.current ?? point
      const value = tool === 'eraser' ? EMPTY_PIXEL : colorPixel
      paintLine(target, from.x, from.y, point.x, point.y, brushSize, value)
    }
    lastRef.current = point
    // The pixel buffer was mutated in place; a fresh document object is what tells React.
    setDoc((current) => ({ ...current }))
  }

  const structural = (next: PaintDocument) => {
    if (next === doc) return
    snapshot()
    setDoc(next)
  }

  const stepHistory = useCallback(
    (direction: 'undo' | 'redo') => {
      const moved = direction === 'undo' ? undo(history, doc) : redo(history, doc)
      if (!moved) return
      setHistory(moved.history)
      setDoc(moved.doc)
    },
    [history, doc],
  )

  const importPng = async (file: File) => {
    try {
      const image = await decodeImageFile(file)
      const layer = createLayer(file.name.replace(/\.png$/i, ''), image.width, image.height)
      layer.pixels.set(quantizeRgba(image.rgba, colorCount))
      replaceDocument({
        width: image.width,
        height: image.height,
        layers: [layer],
        activeLayerId: layer.id,
      })
      setError(null)
    } catch {
      // A file the browser cannot decode is the common case here, and without this the import
      // fails as an unhandled rejection: the app just sits there looking broken.
      setError(`${file.name} could not be read as an image.`)
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      const key = event.key.toLowerCase()
      if (event.ctrlKey || event.metaKey) {
        if (key !== 'z' && key !== 'y') return
        event.preventDefault()
        stepHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo')
        return
      }
      const next = TOOL_KEYS[key]
      if (next) setTool(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stepHistory])

  const clampSide = (value: number) =>
    Math.min(Math.max(Math.round(value) || 1, 1), MAX_CANVAS_SIDE)

  return (
    <div className="app">
      <header className="app__bar">
        <span className="app__mark">wPainter</span>
        <div className="segment">
          {TOOLS.map((option) => (
            <button
              key={option}
              type="button"
              className={`segment__option${option === tool ? ' segment__option--active' : ''}`}
              onClick={() => setTool(option)}
            >
              {TOOL_LABELS[option]}
            </button>
          ))}
        </div>
        <div className="segment">
          {BRUSH_SIZES.map((option) => (
            <button
              key={option}
              type="button"
              title={`Brush ${option} px`}
              className={`segment__option${option === brushSize ? ' segment__option--active' : ''}`}
              onClick={() => setBrushSize(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <span className="app__spacer" />
        <button
          type="button"
          className="btn"
          disabled={history.past.length === 0}
          onClick={() => stepHistory('undo')}
        >
          Undo
        </button>
        <button
          type="button"
          className="btn"
          disabled={history.future.length === 0}
          onClick={() => stepHistory('redo')}
        >
          Redo
        </button>
        <label className="btn app__file">
          Import PNG
          <input
            type="file"
            accept="image/png"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importPng(file)
              event.target.value = ''
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() =>
            void exportPng(doc, 'wplace-template.png').catch(() =>
              setError('The export could not be written.'),
            )
          }
        >
          Export PNG
        </button>
      </header>

      <main className="app__main">
        <section className="app__stage">
          <div className="app__frame-slot" ref={slotRef}>
            <div className="app__frame-box">
              <div
                className="app__canvas-host"
                onWheel={(event) => {
                  // Ctrl+wheel is the browser's own zoom gesture; claiming it here keeps a plain
                  // wheel free to scroll a canvas larger than its host.
                  if (!event.ctrlKey) return
                  event.preventDefault()
                  setZoom((current) => zoomStep(current, -event.deltaY))
                }}
              >
                <PaintCanvas
                  doc={doc}
                  zoom={zoom}
                  showGrid={showGrid}
                  preview={
                    tool === 'stamp' && stampBuffer && hover
                      ? {
                          buffer: stampBuffer,
                          at: {
                            x: stampOrigin(hover.x, stampBuffer.width),
                            y: stampOrigin(hover.y, stampBuffer.height),
                          },
                        }
                      : null
                  }
                  onStroke={paintAt}
                  onStrokeEnd={() => {
                    strokeRef.current = false
                    lastRef.current = null
                  }}
                  onHoverChange={setHover}
                />
              </div>
              <span className="app__resolution">
                {doc.width}×{doc.height}
                {hover ? ` · ${hover.x}, ${hover.y}` : ''}
              </span>
            </div>
          </div>
          <div className="app__stage-bar">
            <div className="segment">
              {ZOOMS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`segment__option${option === zoom ? ' segment__option--active' : ''}`}
                  onClick={() => setZoom(option)}
                >
                  {option}x
                </button>
              ))}
            </div>
            <label className="app__check">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(event) => setShowGrid(event.target.checked)}
              />
              Grid
            </label>
          </div>
        </section>

        <aside className="app__panel">
          <h2 className="app__panel-title">Canvas</h2>
          <div className="app__size">
            <input
              type="number"
              aria-label="Canvas width"
              min={1}
              max={MAX_CANVAS_SIDE}
              value={size.width}
              onChange={(event) =>
                setSize((current) => ({ ...current, width: Number(event.target.value) }))
              }
            />
            <span>×</span>
            <input
              type="number"
              aria-label="Canvas height"
              min={1}
              max={MAX_CANVAS_SIDE}
              value={size.height}
              onChange={(event) =>
                setSize((current) => ({ ...current, height: Number(event.target.value) }))
              }
            />
            <button
              type="button"
              className="btn"
              onClick={() =>
                structural(resizeDocument(doc, clampSide(size.width), clampSide(size.height)))
              }
            >
              Resize
            </button>
          </div>
          {error && <p className="app__error">{error}</p>}
          <label className="app__check">
            <input
              type="checkbox"
              checked={freeOnly}
              onChange={(event) => setFreeOnly(event.target.checked)}
            />
            Free colours only
          </label>

          <h2 className="app__panel-title">Palette</h2>
          <PalettePanel value={colorPixel} colorCount={colorCount} onChange={setColorPixel} />

          <h2 className="app__panel-title">Layers</h2>
          <LayerPanel doc={doc} onChange={structural} />

          <h2 className="app__panel-title">Sprites</h2>
          <SpritePanel
            sprites={sprites}
            activeId={spriteId}
            loading={spriteLoad.loading}
            skipped={spriteLoad.skipped}
            onLoad={(files) => {
              setSpriteLoad({ loading: true, skipped: 0 })
              void loadSprites(files).then((result) => {
                setSprites(result.sprites)
                setSpriteId(result.sprites[0]?.id ?? null)
                setSpriteLoad({ loading: false, skipped: result.skipped })
              })
            }}
            onPick={(picked) => {
              setSpriteId(picked.id)
              setTool('stamp')
            }}
          />
        </aside>
      </main>
    </div>
  )
}
