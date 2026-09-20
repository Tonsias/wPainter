import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { ReactNode } from 'react'
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
import {
  UNTURNED,
  floodFill,
  orientPixelBuffer,
  paintLine,
  paintOutlineLine,
  scalePixelBuffer,
  stamp,
  stampOrigin,
  type Orientation,
  type PixelBuffer,
} from '../document/paint.ts'
import { clampRect, movePixels, rectBetween, shiftRect, type Rect } from '../document/selection.ts'
import { PalettePanel, type ColorSlot } from '../palette/PalettePanel.tsx'
import { quantizeRgba, remapPixels, remapTable } from '../palette/quantize.ts'
import { EMPTY_PIXEL, FREE_COLOR_COUNT, WPLACE_COLORS } from '../palette/wplace.ts'
import { SpritePanel } from '../sprites/SpritePanel.tsx'
import { indexSprites, loadSpriteImage } from '../sprites/loadSprites.ts'
import type { Sprite, SpriteScale } from '../sprites/library.ts'
import { PaintCanvas, type Point } from './PaintCanvas.tsx'
import {
  DEFAULT_PANEL_WIDTH,
  PANEL_WIDTH_STEP,
  RESIZER_WIDTH,
  clampPanelWidth,
} from './panel.ts'
import { Toolbar } from './Toolbar.tsx'
import { TOOL_KEYS, type BrushSize, type Tool } from './tools.ts'
import { ZOOMS, fitZoom, type Zoom } from './zoom.ts'

const DEFAULT_SIZE = 128

// What the stage and the panel have to share: the grid's own content box less the separator and
// the gaps on both sides of it. Measured from the container and not from the two columns, because
// a panel already too wide has squeezed the stage to nothing and would read as room it never had.
function panelRoom(main: HTMLElement): number {
  const style = getComputedStyle(main)
  const inner = main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  return inner - RESIZER_WIDTH - 2 * parseFloat(style.columnGap)
}

// The frame padding the fit calculation has to leave for, so a freshly imported template is not
// zoomed to exactly the point where the host starts scrolling.
const FRAME_INSET = 40

// The three settings sections fold away so the sprite tree — the one part that scrolls — can
// have the panel's height. `details` keeps the open state, the caret and the keyboard for free.
function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="app__section" open>
      <summary className="app__panel-title">
        <span className="app__caret" aria-hidden="true">&#9656;</span>
        {title}
      </summary>
      <div className="app__section-body">{children}</div>
    </details>
  )
}

export function App() {
  const [doc, setDoc] = useState<PaintDocument>(() => createDocument(DEFAULT_SIZE, DEFAULT_SIZE))
  const [history, setHistory] = useState<History>(EMPTY_HISTORY)
  const [tool, setTool] = useState<Tool>('brush')
  const [colorPixel, setColorPixel] = useState(1)
  // White by default: an outline in the same colour as its fill would not be an outline.
  const [edgePixel, setEdgePixel] = useState(5)
  const [slot, setSlot] = useState<ColorSlot>('main')
  const [brushSize, setBrushSize] = useState<BrushSize>(1)
  const [freeOnly, setFreeOnly] = useState(false)
  const [zoom, setZoom] = useState<Zoom>(4)
  const [showGrid, setShowGrid] = useState(true)
  const [hover, setHover] = useState<Point | null>(null)
  const [selection, setSelection] = useState<Rect | null>(null)
  const [sprites, setSprites] = useState<readonly Sprite[]>([])
  const [spriteId, setSpriteId] = useState<string | null>(null)
  const [spriteImage, setSpriteImage] = useState<PixelBuffer | null>(null)
  const [spriteScale, setSpriteScale] = useState<SpriteScale>(1)
  const [spriteOrientation, setSpriteOrientation] = useState<Orientation>(UNTURNED)
  const [spritesSkipped, setSpritesSkipped] = useState(0)
  const [size, setSize] = useState({ width: DEFAULT_SIZE, height: DEFAULT_SIZE })
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [error, setError] = useState<string | null>(null)

  const slotRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  // Where the pointer would have to be for the panel to be zero wide, fixed when the drag starts:
  // it takes the grab offset inside the separator out of the arithmetic, so the handle tracks the
  // cursor exactly instead of jumping by half its own width on the first move.
  const panelDragRef = useRef(0)
  // A stroke is one undo step: the snapshot is taken on its first point, not on every move.
  const strokeRef = useRef(false)
  const lastRef = useRef<Point | null>(null)
  const startRef = useRef<Point | null>(null)
  // A move reads from the layer as it stood when the drag began; `delta` survives the drag so
  // the marquee can follow the pixels once the pointer is released.
  const moveRef = useRef<{ source: Uint8Array; region: Rect | null; delta: Point } | null>(null)

  const pickTool = useCallback((next: Tool) => {
    setTool(next)
    // The edge slot exists only while the outline brush is in hand; leaving it selected would
    // point the palette at a colour the panel no longer shows.
    if (next !== 'outline') setSlot('main')
  }, [])

  const setSlotColor = (pixel: number) =>
    slot === 'edge' ? setEdgePixel(pixel) : setColorPixel(pixel)

  const colorCount = freeOnly ? FREE_COLOR_COUNT : WPLACE_COLORS.length
  const remap = useMemo(() => remapTable(colorCount), [colorCount])
  const sprite = sprites.find((item) => item.id === spriteId) ?? null

  // The picked sprite is the one file the library decodes on demand rather than on view; until it
  // comes back there is simply no stamp, which is also what an undecodable file leaves behind.
  useEffect(() => {
    if (!sprite) {
      setSpriteImage(null)
      return
    }
    let cancelled = false
    void loadSpriteImage(sprite).then((image) => {
      if (!cancelled) setSpriteImage(image)
    })
    return () => {
      cancelled = true
    }
  }, [sprite])

  // Scaling here and not inside `stamp` is what keeps the ghost under the cursor honest: the
  // preview, the origin it is centred on and the pixels laid down all read the same buffer.
  const stampBuffer: PixelBuffer | null = useMemo(
    () =>
      spriteImage &&
      scalePixelBuffer(
        orientPixelBuffer(
          { ...spriteImage, pixels: remapPixels(spriteImage.pixels, remap) },
          spriteOrientation,
        ),
        spriteScale,
      ),
    [spriteImage, remap, spriteOrientation, spriteScale],
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
    setSelection(null)
    const box = slotRef.current?.getBoundingClientRect()
    if (box) {
      setZoom(fitZoom(doc.width, doc.height, box.width - FRAME_INSET, box.height - FRAME_INSET))
    }
  }, [doc.width, doc.height])

  const paintAt = (point: Point) => {
    // A selection is view state, not document state: it neither snapshots nor redraws a layer,
    // and it is drawn on a canvas whose active layer may well be hidden.
    if (tool === 'select') {
      const starting = !strokeRef.current
      strokeRef.current = true
      if (starting) startRef.current = point
      const from = startRef.current ?? point
      const dragged = from.x !== point.x || from.y !== point.y
      setSelection(
        dragged ? clampRect(rectBetween(from.x, from.y, point.x, point.y), doc.width, doc.height) : null,
      )
      return
    }

    const layer = activeLayer(doc)
    if (!layer || !layer.visible) return
    const inside = point.x >= 0 && point.y >= 0 && point.x < doc.width && point.y < doc.height

    if (tool === 'picker') {
      if (!inside) return
      const value = layer.pixels[point.y * doc.width + point.x]
      if (value !== EMPTY_PIXEL) setSlotColor(remap[value])
      return
    }

    const starting = !strokeRef.current
    // Fill and stamp act once per press; the others follow the drag, off the canvas included.
    if (!starting && (tool === 'fill' || tool === 'stamp')) return
    if (!inside && (tool === 'fill' || tool === 'stamp')) return

    if (starting) {
      snapshot()
      strokeRef.current = true
      lastRef.current = null
      startRef.current = point
      if (tool === 'move') {
        moveRef.current = {
          source: Uint8Array.from(layer.pixels),
          region: selection,
          delta: { x: 0, y: 0 },
        }
      }
    }

    const target: PixelBuffer = { pixels: layer.pixels, width: doc.width, height: doc.height }
    if (tool === 'move') {
      const drag = moveRef.current
      const start = startRef.current
      if (!drag || !start) return
      drag.delta = { x: point.x - start.x, y: point.y - start.y }
      movePixels(
        target,
        { pixels: drag.source, width: doc.width, height: doc.height },
        drag.region,
        drag.delta.x,
        drag.delta.y,
      )
    } else if (tool === 'fill') {
      floodFill(target, point.x, point.y, colorPixel)
    } else if (tool === 'stamp') {
      if (!stampBuffer) return
      stamp(
        target,
        stampBuffer,
        stampOrigin(point.x, stampBuffer.width),
        stampOrigin(point.y, stampBuffer.height),
      )
    } else if (tool === 'outline') {
      const from = lastRef.current ?? point
      paintOutlineLine(target, from.x, from.y, point.x, point.y, brushSize, colorPixel, edgePixel)
    } else {
      const from = lastRef.current ?? point
      const value = tool === 'eraser' ? EMPTY_PIXEL : colorPixel
      paintLine(target, from.x, from.y, point.x, point.y, brushSize, value)
    }
    lastRef.current = point
    // The pixel buffer was mutated in place; a fresh document object is what tells React.
    setDoc((current) => ({ ...current }))
  }

  const endStroke = () => {
    const drag = moveRef.current
    if (drag?.region) {
      setSelection(clampRect(shiftRect(drag.region, drag.delta.x, drag.delta.y), doc.width, doc.height))
    }
    moveRef.current = null
    strokeRef.current = false
    lastRef.current = null
    startRef.current = null
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

  const expertExportPng = async (maskFile: File) => {
    try {
      const mask = await decodeImageFile(maskFile)
      await exportPng(doc, 'wplace-template-cutout.png', mask)
      setError(null)
    } catch {
      setError(`${maskFile.name} could not be read as an image.`)
    }
  }

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
      if (next) pickTool(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stepHistory, pickTool])

  // The one way the panel is ever resized, whether by drag, by arrow key or by the window changing
  // under it: the room the two columns share is measured rather than assumed, because only the
  // layout knows what the tool rail, the gaps and the shell's padding have already taken.
  const resizePanel = useCallback((next: (current: number) => number) => {
    const main = mainRef.current
    if (!main) return
    setPanelWidth((current) => clampPanelWidth(next(current), panelRoom(main)))
  }, [])

  useEffect(() => {
    const onResize = () => resizePanel((current) => current)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [resizePanel])

  const clampSide = (value: number) =>
    Math.min(Math.max(Math.round(value) || 1, 1), MAX_CANVAS_SIDE)

  return (
    <div className="app">
      <Toolbar
        tool={tool}
        brushSize={brushSize}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onTool={pickTool}
        onBrushSize={setBrushSize}
        onHistory={stepHistory}
        onImport={(file) => void importPng(file)}
        onExport={() =>
          void exportPng(doc, 'wplace-template.png').catch(() =>
            setError('The export could not be written.'),
          )
        }
        onExpertExport={(mask) => void expertExportPng(mask)}
      />

      <main
        className="app__main"
        ref={mainRef}
        style={
          {
            '--app-panel-width': `${panelWidth}px`,
            '--app-resizer-width': `${RESIZER_WIDTH}px`,
          } as CSSProperties
        }
      >
        <section className="app__stage">
          <div className="app__frame-slot" ref={slotRef}>
            <div className="app__frame-box">
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
                selection={selection}
                onZoomChange={setZoom}
                onStroke={paintAt}
                onStrokeEnd={endStroke}
                onHoverChange={setHover}
              />
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

        <div
          className="app__resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Panel width"
          aria-valuenow={panelWidth}
          tabIndex={0}
          onPointerDown={(event) => {
            // Pointer capture routes the moves here, but it does not stop the press from starting
            // a text selection that then drags across the panel.
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            panelDragRef.current = event.clientX + panelWidth
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
            const { clientX } = event
            resizePanel(() => panelDragRef.current - clientX)
          }}
          onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
          onKeyDown={(event) => {
            const step = { ArrowLeft: PANEL_WIDTH_STEP, ArrowRight: -PANEL_WIDTH_STEP }[event.key]
            if (step === undefined) return
            event.preventDefault()
            resizePanel((current) => current + step)
          }}
        />

        <aside className="app__panel">
          <PanelSection title="Canvas">
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
          </PanelSection>

          <PanelSection title="Palette">
            <PalettePanel
              main={colorPixel}
              edge={tool === 'outline' ? edgePixel : null}
              slot={slot}
              colorCount={colorCount}
              onSlot={setSlot}
              onChange={setSlotColor}
            />
          </PanelSection>

          <PanelSection title="Layers">
            <LayerPanel doc={doc} onChange={structural} />
          </PanelSection>

          <section className="app__section app__section--sprites">
            <h2 className="app__panel-title">Sprites</h2>
            <SpritePanel
              sprites={sprites}
              activeId={spriteId}
              skipped={spritesSkipped}
              scale={spriteScale}
              orientation={spriteOrientation}
              onLoad={(files) => {
                const indexed = indexSprites(files)
                setSprites(indexed)
                setSpriteId(indexed[0]?.id ?? null)
                setSpritesSkipped(files.length - indexed.length)
              }}
              onPick={(picked) => {
                setSpriteId(picked.id)
                pickTool('stamp')
              }}
              onScale={setSpriteScale}
              onOrient={setSpriteOrientation}
            />
          </section>
        </aside>
      </main>
    </div>
  )
}
