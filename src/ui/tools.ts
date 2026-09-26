export const TOOLS = [
  'brush',
  'outline',
  'scatter',
  'eraser',
  'fill',
  'picker',
  'stamp',
  'select',
  'move',
] as const
export type Tool = (typeof TOOLS)[number]

export const TOOL_LABELS: Record<Tool, string> = {
  brush: 'Brush',
  outline: 'Outline',
  scatter: 'Scatter',
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
  r: 'scatter',
  e: 'eraser',
  f: 'fill',
  i: 'picker',
  s: 'stamp',
  m: 'select',
  v: 'move',
}

// The same shortcuts read the other way round, for the tooltip that is now a tool button's only
// label: with the text gone from the rail, the key is the one place the binding is still visible.
export const TOOL_KEY = Object.fromEntries(
  Object.entries(TOOL_KEYS).map(([key, tool]) => [tool, key]),
) as Record<Tool, string>

export const MAX_BRUSH_SIZE = 64
