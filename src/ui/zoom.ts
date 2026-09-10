export const ZOOMS = [1, 2, 4, 8] as const
export type Zoom = (typeof ZOOMS)[number]

// Steps along ZOOMS and saturates at both ends rather than wrapping: a wheel held down at the
// limit must stay there, not jump back to the opposite end of the scale.
export function zoomStep(current: Zoom, delta: number): Zoom {
  const index = ZOOMS.indexOf(current)
  const next = index + Math.sign(delta)
  return ZOOMS[Math.min(Math.max(next, 0), ZOOMS.length - 1)]
}
