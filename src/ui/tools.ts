export const TOOLS = ['brush', 'outline', 'eraser', 'fill', 'picker', 'stamp', 'select', 'move'] as const
export type Tool = (typeof TOOLS)[number]

export const TOOL_LABELS: Record<Tool, string> = {
  brush: 'Brush',
  outline: 'Outline',
  eraser: 'Eraser',
  fill: 'Fill',
  picker: 'Pick',
  stamp: 'Stamp',
  select: 'Select',
  move: 'Move',
}

// Single-key shortcuts, matched against `event.key` lowercased.
export const TOOL_KEYS: Record<string, Tool> = {
  b: 'brush',
  o: 'outline',
  e: 'eraser',
  f: 'fill',
  i: 'picker',
  s: 'stamp',
  m: 'select',
  v: 'move',
}

export const BRUSH_SIZES = [1, 2, 3, 4, 8] as const
export type BrushSize = (typeof BRUSH_SIZES)[number]
