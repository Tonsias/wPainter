import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import './PaintCanvas.css'
import { writePixels, writeRgba } from '../document/composite.ts'
import type { PaintDocument } from '../document/document.ts'
import { stamp, type PixelBuffer } from '../document/paint.ts'
import { GRID_MIN_ZOOM, type Zoom } from './zoom.ts'

export type Point = { readonly x: number; readonly y: number }

type StampPreview = { readonly buffer: PixelBuffer; readonly at: Point }

type Props = {
  doc: PaintDocument
  zoom: Zoom
  showGrid: boolean
  preview: StampPreview | null
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
  onStroke,
  onStrokeEnd,
  onHoverChange,
}: Props) {
  const artRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
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

  const pointFrom = (event: ReactPointerEvent<HTMLDivElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.floor((event.clientX - rect.left) / zoom),
      y: Math.floor((event.clientY - rect.top) / zoom),
    }
  }

  const inside = (point: Point) =>
    point.x >= 0 && point.y >= 0 && point.x < doc.width && point.y < doc.height

  return (
    <div
      className="paint"
      style={{ width: doc.width * zoom, height: doc.height * zoom }}
      onPointerDown={(event) => {
        // Capture keeps a drag that wanders off the canvas connected to this element, so the
        // stroke ends where the pointer is released rather than wherever it left the box.
        event.currentTarget.setPointerCapture(event.pointerId)
        onStroke(pointFrom(event))
      }}
      onPointerMove={(event) => {
        const point = pointFrom(event)
        onHoverChange(inside(point) ? point : null)
        if (event.buttons & 1) onStroke(point)
      }}
      onPointerUp={(event) => {
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
  )
}
