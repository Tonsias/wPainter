import './Toolbar.css'
import { BRUSH_SIZES, TOOLS, TOOL_LABELS, type BrushSize, type Tool } from './tools.ts'

type Props = {
  tool: Tool
  brushSize: BrushSize
  canUndo: boolean
  canRedo: boolean
  onTool: (tool: Tool) => void
  onBrushSize: (size: BrushSize) => void
  onHistory: (direction: 'undo' | 'redo') => void
  onImport: (file: File) => void
  onExport: () => void
}

export function Toolbar({
  tool,
  brushSize,
  canUndo,
  canRedo,
  onTool,
  onBrushSize,
  onHistory,
  onImport,
  onExport,
}: Props) {
  return (
    <div className="toolbar">
      <span className="app__mark">wPainter</span>

      <div className="segment segment--stack">
        {TOOLS.map((option) => (
          <button
            key={option}
            type="button"
            className={`segment__option${option === tool ? ' segment__option--active' : ''}`}
            onClick={() => onTool(option)}
          >
            {TOOL_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="segment">
        {BRUSH_SIZES.map((option) => (
          <button
            key={option}
            type="button"
            title={`Brush ${option} px`}
            className={`segment__option${option === brushSize ? ' segment__option--active' : ''}`}
            onClick={() => onBrushSize(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <span className="toolbar__spacer" />

      <div className="toolbar__pair">
        <button type="button" className="btn" disabled={!canUndo} onClick={() => onHistory('undo')}>
          Undo
        </button>
        <button type="button" className="btn" disabled={!canRedo} onClick={() => onHistory('redo')}>
          Redo
        </button>
      </div>
      <label className="btn toolbar__file">
        Import PNG
        <input
          type="file"
          accept="image/png"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onImport(file)
            event.target.value = ''
          }}
        />
      </label>
      <button type="button" className="btn btn--primary" onClick={onExport}>
        Export PNG
      </button>
    </div>
  )
}
