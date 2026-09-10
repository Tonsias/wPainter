export const TOOLS = ['brush', 'eraser', 'fill', 'picker', 'stamp'] as const
export type Tool = (typeof TOOLS)[number]

export const TOOL_LABELS: Record<Tool, string> = {
  brush: 'Brush',
  eraser: 'Eraser',
  fill: 'Fill',
  picker: 'Pick',
  stamp: 'Stamp',
}

// Single-key shortcuts, matched against `event.key` lowercased.
export const TOOL_KEYS: Record<string, Tool> = {
  b: 'brush',
  e: 'eraser',
  f: 'fill',
  i: 'picker',
  s: 'stamp',
}

export const BRUSH_SIZES = [1, 2, 3, 4, 8] as const
export type BrushSize = (typeof BRUSH_SIZES)[number]
