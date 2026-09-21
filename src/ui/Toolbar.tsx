import './Toolbar.css'
import { Icon, BrushDot, type IconName } from './icons.tsx'
import { BRUSH_SIZES, TOOLS, TOOL_KEY, TOOL_LABELS, type BrushSize, type Tool } from './tools.ts'

type Props = {
  tool: Tool
  brushSize: BrushSize
  canUndo: boolean
  canRedo: boolean
  onTool: (tool: Tool) => void
  onBrushSize: (size: BrushSize) => void
  onHistory: (direction: 'undo' | 'redo') => void
  onImport: (file: File) => void
  onImportLayer: (file: File) => void
  onExport: () => void
  onExpertExport: (mask: File) => void
}

type FileButtonProps = { icon: IconName; label: string; onPick: (file: File) => void }

// A label styled as a button, because a file input cannot be triggered from one without a ref.
// The label is the tooltip and the accessible name: nothing in this rail is spelled out on screen.
function FileButton({ icon, label, onPick }: FileButtonProps) {
  return (
    <label className="btn toolbar__file" title={label} aria-label={label}>
      <Icon name={icon} />
      <input
        type="file"
        accept="image/png"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onPick(file)
          event.target.value = ''
        }}
      />
    </label>
  )
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
  onImportLayer,
  onExport,
  onExpertExport,
}: Props) {
  return (
    <div className="toolbar">
      <span className="toolbar__mark" title="wPainter" aria-label="wPainter">
        <Icon name="mark" />
      </span>

      <div className="segment segment--grid">
        {TOOLS.map((option) => {
          const label = `${TOOL_LABELS[option]} (${TOOL_KEY[option].toUpperCase()})`
          return (
            <button
              key={option}
              type="button"
              title={label}
              aria-label={label}
              className={`segment__option${option === tool ? ' segment__option--active' : ''}`}
              onClick={() => onTool(option)}
            >
              <Icon name={option} />
            </button>
          )
        })}
      </div>

      <div className="segment segment--grid">
        {BRUSH_SIZES.map((option) => (
          <button
            key={option}
            type="button"
            title={`Brush ${option} px`}
            aria-label={`Brush ${option} px`}
            className={`segment__option${option === brushSize ? ' segment__option--active' : ''}`}
            onClick={() => onBrushSize(option)}
          >
            <BrushDot size={option} />
          </button>
        ))}
      </div>

      <span className="toolbar__spacer" />

      <div className="toolbar__grid">
        <button
          type="button"
          className="btn"
          title="Undo"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={() => onHistory('undo')}
        >
          <Icon name="undo" />
        </button>
        <button
          type="button"
          className="btn"
          title="Redo"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={() => onHistory('redo')}
        >
          <Icon name="redo" />
        </button>
      </div>

      <div className="toolbar__grid">
        <FileButton icon="import" label="Import PNG — replace the document" onPick={onImport} />
        <FileButton
          icon="importLayer"
          label="Import PNG as a layer, keeping the canvas size"
          onPick={onImportLayer}
        />
        <button
          type="button"
          className="btn btn--primary"
          title="Export PNG"
          aria-label="Export PNG"
          onClick={onExport}
        >
          <Icon name="export" />
        </button>
        <FileButton
          icon="cutout"
          label="Expert export — a second PNG cut out of it"
          onPick={onExpertExport}
        />
      </div>
    </div>
  )
}
