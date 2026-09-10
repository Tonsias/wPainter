export const ZOOMS = [1, 2, 4, 8, 12, 16, 24, 32] as const
export type Zoom = (typeof ZOOMS)[number]

// A canvas position inside the viewport: the distance from the viewport's top-left corner to the
// artwork's, in CSS pixels.
export type Offset = { readonly x: number; readonly y: number }

type Extent = { readonly width: number; readonly height: number }

// The grid only helps once a pixel is big enough to have a visible border; below this it turns
// the canvas into a grey haze.
export const GRID_MIN_ZOOM = 8

// However far the canvas is dragged or zoomed, this much of it stays inside the viewport on each
// axis — enough to still be grabbed and dragged back.
const KEEP_VISIBLE = 48

// Steps along ZOOMS and saturates at both ends rather than wrapping: a wheel held down at the
// limit must stay there, not jump back to the opposite end of the scale.
export function zoomStep(current: Zoom, delta: number): Zoom {
  const index = ZOOMS.indexOf(current)
  const next = index + Math.sign(delta)
  return ZOOMS[Math.min(Math.max(next, 0), ZOOMS.length - 1)]
}

// Largest zoom that still fits the whole document in the available box, so opening a 500px-wide
// template does not start scrolled into one corner.
export function fitZoom(width: number, height: number, boxWidth: number, boxHeight: number): Zoom {
  const fits = ZOOMS.filter(
    (zoom) => width * zoom <= boxWidth && height * zoom <= boxHeight,
  )
  return fits.at(-1) ?? ZOOMS[0]
}

// Zooming leaves the document point under `local` — the cursor, or the viewport's centre — where
// it is; that point does not move, so the offset around it is what has to.
export function anchoredOffset(offset: Offset, local: Offset, from: Zoom, to: Zoom): Offset {
  return {
    x: local.x - ((local.x - offset.x) / from) * to,
    y: local.y - ((local.y - offset.y) / from) * to,
  }
}

export function clampOffset(offset: Offset, content: Extent, view: Extent): Offset {
  const axis = (value: number, size: number, viewSize: number) => {
    const keep = Math.min(KEEP_VISIBLE, size)
    return Math.min(Math.max(value, keep - size), viewSize - keep)
  }
  return {
    x: axis(offset.x, content.width, view.width),
    y: axis(offset.y, content.height, view.height),
  }
}

export function centeredOffset(content: Extent, view: Extent): Offset {
  return { x: (view.width - content.width) / 2, y: (view.height - content.height) / 2 }
}
