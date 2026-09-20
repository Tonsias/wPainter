export const DEFAULT_PANEL_WIDTH = 340

// Below this the palette swatches wrap into a column and the canvas size row stops fitting.
const MIN_PANEL_WIDTH = 280

// What the stage keeps whatever the panel is dragged to: enough for the frame and the zoom bar
// under it. Dragging the canvas off the screen entirely is not a state worth being able to reach.
const MIN_STAGE_WIDTH = 360

// One arrow key press, in px — the keyboard equivalent of dragging the separator.
export const PANEL_WIDTH_STEP = 20

// The separator's own grid track. It is set from here onto the shell as a custom property rather
// than written in the stylesheet, so the width the layout uses and the width the clamp subtracts
// cannot drift apart.
export const RESIZER_WIDTH = 14

// `room` is what the stage and the panel actually share — measured, not the window, because the
// tool rail, the grid gaps and the shell's padding are all taken out before either of them sees a
// pixel. Clamping against the window instead left the stage a tenth of the width it was promised.
export function clampPanelWidth(width: number, room: number): number {
  // Too little room for both minimums gives the panel its own rather than the stage its: at that
  // size the layout has already stacked, and the panel is what the user is reaching for. Ordering
  // the clamps this way is what keeps the result from going below MIN_PANEL_WIDTH.
  const widest = Math.max(MIN_PANEL_WIDTH, room - MIN_STAGE_WIDTH)
  return Math.round(Math.min(Math.max(width, MIN_PANEL_WIDTH), widest))
}
