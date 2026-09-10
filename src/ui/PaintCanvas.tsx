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
import { GRID_MIN_ZOOM, zoomStep, type Zoom } from './zoom.ts'

export type Point = { readonly x: number; readonly y: number }

type StampPreview = { readonly buffer: PixelBuffer; readonly at: Point }

type Pan = {
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
  readonly scrollLeft: number
  readonly scrollTop: number
}

// The document point the wheel gesture pointed at, kept until the new zoom is laid out so the
// scroll can be corrected to leave that point under the cursor.
type ZoomAnchor = Point & { readonly clientX: number; readonly clientY: number }

type Props = {
  doc: PaintDocument
  zoom: Zoom
  showGrid: boolean
  preview: StampPreview | null
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
  const anchorRef = useRef<ZoomAnchor | null>(null)
  const [panning, setPanning] = useState(false)
  const art = useImageData(doc.width, doc.height)
  const ghost = useImageData(doc.width, doc.height)

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

  useEffect(() => {
    const view = viewRef.current
    const paint = paintRef.current
    if (!view || !paint) return
    // Registered by hand: React's onWheel is passive, so preventDefault there cannot stop the
    // page from scrolling or the browser from zooming under the gesture.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const next = zoomStep(zoom, -event.deltaY)
      if (next === zoom) return
      const rect = paint.getBoundingClientRect()
      anchorRef.current = {
        x: (event.clientX - rect.left) / zoom,
        y: (event.clientY - rect.top) / zoom,
        clientX: event.clientX,
        clientY: event.clientY,
      }
      onZoomChange(next)
    }
    view.addEventListener('wheel', onWheel, { passive: false })
    return () => view.removeEventListener('wheel', onWheel)
  }, [zoom, onZoomChange])

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    anchorRef.current = null
    const view = viewRef.current
    const paint = paintRef.current
    if (!anchor || !view || !paint) return
    const rect = view.getBoundingClientRect()
    // offsetLeft/Top carry the centring margin the view gives a canvas smaller than itself, and
    // are scroll-independent — the scroll position being solved for cannot appear on both sides.
    view.scrollLeft = paint.offsetLeft + anchor.x * zoom - (anchor.clientX - rect.left)
    view.scrollTop = paint.offsetTop + anchor.y * zoom - (anchor.clientY - rect.top)
  }, [zoom])

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
        panRef.current = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          scrollLeft: view.scrollLeft,
          scrollTop: view.scrollTop,
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
        event.currentTarget.scrollLeft = pan.scrollLeft - (event.clientX - pan.clientX)
        event.currentTarget.scrollTop = pan.scrollTop - (event.clientY - pan.clientY)
      }}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      // The pan gesture is a right-button drag, so the menu it would otherwise open is in the way.
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className="paint"
        ref={paintRef}
        style={{ width: doc.width * zoom, height: doc.height * zoom }}
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
        {showGrid && zoom >= GRID_MIN_ZOOM && (
          <div className="paint__grid" style={{ backgroundSize: `${zoom}px ${zoom}px` }} />
        )}
      </div>
    </div>
  )
}
