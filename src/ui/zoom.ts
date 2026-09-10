export const ZOOMS = [1, 2, 4, 8, 12, 16, 24, 32] as const
export type Zoom = (typeof ZOOMS)[number]

// The grid only helps once a pixel is big enough to have a visible border; below this it turns
// the canvas into a grey haze.
export const GRID_MIN_ZOOM = 8

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
