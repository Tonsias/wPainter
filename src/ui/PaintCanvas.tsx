import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import './PaintCanvas.css'
import { writePixels, writeRgba } from '../document/composite.ts'
import type { PaintDocument } from '../document/document.ts'
import { stamp, type PixelBuffer } from '../document/paint.ts'
import type { Rect } from '../document/selection.ts'
import {
  GRID_MIN_ZOOM,
  anchoredOffset,
  centeredOffset,
  clampOffset,
  zoomStep,
  type Offset,
  type Zoom,
} from './zoom.ts'

export type Point = { readonly x: number; readonly y: number }

type StampPreview = { readonly buffer: PixelBuffer; readonly at: Point }

type Extent = { readonly width: number; readonly height: number }

type Pan = {
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
  readonly offset: Offset
  readonly view: Extent
}

type Props = {
  doc: PaintDocument
  zoom: Zoom
  showGrid: boolean
  preview: StampPreview | null
  selection: Rect | null
  onZoomChange: (zoom: Zoom) => void
  onStroke: (point: Point) => void
  onStrokeEnd: () => void
  onHoverChange: (point: Point | null) => void
}

function useImageData(width: number, height: number) {
  const ref = useRef<ImageData | null>(null)
  if (!ref.current || ref.current.width !== width || ref.current.height !== height) {
    ref.current = new ImageData(width, height)
  }
  return ref.current
}

export function PaintCanvas({
  doc,
  zoom,
  showGrid,
  preview,
  selection,
  onZoomChange,
  onStroke,
  onStrokeEnd,
  onHoverChange,
}: Props) {
  const viewRef = useRef<HTMLDivElement>(null)
  const paintRef = useRef<HTMLDivElement>(null)
  const artRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const panRef = useRef<Pan | null>(null)
  // Where in the viewport the wheel pointed, kept until the new zoom is laid out and the offset
  // around that point can be corrected.
  const anchorRef = useRef<Offset | null>(null)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const offsetRef = useRef<Offset>(offset)
  const zoomRef = useRef<Zoom>(zoom)
  const [panning, setPanning] = useState(false)
  const art = useImageData(doc.width, doc.height)
  const ghost = useImageData(doc.width, doc.height)

  const place = (next: Offset) => {
    offsetRef.current = next
    setOffset(next)
  }

  useEffect(() => {
    const context = artRef.current?.getContext('2d')
    if (!context) return
    writeRgba(doc, art.data)
    context.putImageData(art, 0, 0)
  }, [doc, art])

  useEffect(() => {
    const context = previewRef.current?.getContext('2d')
    if (!context) return
    ghost.data.fill(0)
    if (preview) {
      const target: PixelBuffer = {
        pixels: new Uint8Array(doc.width * doc.height),
        width: doc.width,
        height: doc.height,
      }
      stamp(target, preview.buffer, preview.at.x, preview.at.y)
      writePixels(target.pixels, ghost.data)
    }
    context.putImageData(ghost, 0, 0)
  }, [preview, ghost, doc.width, doc.height])

  useLayoutEffect(() => {
    const view = viewRef.current?.getBoundingClientRect()
    if (!view) return
    const scale = zoomRef.current
    const next = centeredOffset({ width: doc.width * scale, height: doc.height * scale }, view)
    offsetRef.current = next
    setOffset(next)
  }, [doc.width, doc.height])

  useLayoutEffect(() => {
    const from = zoomRef.current
    zoomRef.current = zoom
    const anchor = anchorRef.current
    anchorRef.current = null
    const view = viewRef.current?.getBoundingClientRect()
    if (!view || from === zoom) return
    // No anchor means the zoom came from a button rather than the wheel, and the viewport centre
    // is then the point the user was looking at.
    const local = anchor ?? { x: view.width / 2, y: view.height / 2 }
    const content = { width: doc.width * zoom, height: doc.height * zoom }
    const next = clampOffset(anchoredOffset(offsetRef.current, local, from, zoom), content, view)
    offsetRef.current = next
    setOffset(next)
  }, [zoom, doc.width, doc.height])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    // Registered by hand: React's onWheel is passive, so preventDefault there cannot stop the
    // page from scrolling or the browser from zooming under the gesture.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const next = zoomStep(zoomRef.current, -event.deltaY)
      if (next === zoomRef.current) return
      const rect = view.getBoundingClientRect()
      anchorRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      onZoomChange(next)
    }
    view.addEventListener('wheel', onWheel, { passive: false })
    return () => view.removeEventListener('wheel', onWheel)
  }, [onZoomChange])

  const pointFrom = (event: ReactPointerEvent<HTMLDivElement>): Point => {
    const rect = paintRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: Math.floor((event.clientX - rect.left) / zoom),
      y: Math.floor((event.clientY - rect.top) / zoom),
    }
  }

  const inside = (point: Point) =>
    point.x >= 0 && point.y >= 0 && point.x < doc.width && point.y < doc.height

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return
    panRef.current = null
    setPanning(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      className={`paint-view${panning ? ' paint-view--panning' : ''}`}
      ref={viewRef}
      onPointerDown={(event) => {
        if (event.button !== 2) return
        const view = event.currentTarget
        const rect = view.getBoundingClientRect()
        panRef.current = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          offset: offsetRef.current,
          view: { width: rect.width, height: rect.height },
        }
        setPanning(true)
        onHoverChange(null)
        // Capture last: a browser that refuses it still leaves a working pan, it just ends at the
        // edge of the viewport instead of following the pointer past it.
        view.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const pan = panRef.current
        if (!pan) return
        place(
          clampOffset(
            {
              x: pan.offset.x + (event.clientX - pan.clientX),
              y: pan.offset.y + (event.clientY - pan.clientY),
            },
            { width: doc.width * zoom, height: doc.height * zoom },
            pan.view,
          ),
        )
      }}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      // The pan gesture is a right-button drag, so the menu it would otherwise open is in the way.
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className="paint"
        ref={paintRef}
        style={{
          width: doc.width * zoom,
          height: doc.height * zoom,
          // Rounded so the artwork lands on whole pixels: a fractional offset softens exactly the
          // edges `image-rendering: pixelated` is here to keep hard.
          transform: `translate(${Math.round(offset.x)}px, ${Math.round(offset.y)}px)`,
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          // Capture keeps a drag that wanders off the canvas connected to this element, so the
          // stroke ends where the pointer is released rather than wherever it left the box.
          event.currentTarget.setPointerCapture(event.pointerId)
          onStroke(pointFrom(event))
        }}
        onPointerMove={(event) => {
          if (panRef.current) return
          const point = pointFrom(event)
          onHoverChange(inside(point) ? point : null)
          if (event.buttons & 1) onStroke(point)
        }}
        onPointerUp={(event) => {
          if (event.button !== 0) return
          event.currentTarget.releasePointerCapture(event.pointerId)
          onStrokeEnd()
        }}
        onPointerLeave={() => onHoverChange(null)}
      >
        <canvas className="paint__layer" ref={artRef} width={doc.width} height={doc.height} />
        <canvas
          className="paint__layer paint__layer--ghost"
          ref={previewRef}
          width={doc.width}
          height={doc.height}
        />
        {selection && (
          <div
            className="paint__marquee"
            style={{
              left: selection.x * zoom,
              top: selection.y * zoom,
              width: selection.width * zoom,
              height: selection.height * zoom,
            }}
          />
        )}
        {showGrid && zoom >= GRID_MIN_ZOOM && (
          <div className="paint__grid" style={{ backgroundSize: `${zoom}px ${zoom}px` }} />
        )}
      </div>
    </div>
  )
}
