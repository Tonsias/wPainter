import './Toolbar.css'
import { Icon, type IconName } from './icons.tsx'
import { NumberField } from './NumberField.tsx'
import { BRUSH_SHAPES, type BrushShape } from '../document/paint.ts'
import {
  ERASER_MODES,
  MAX_BRUSH_SIZE,
  TOOLS,
  TOOL_KEY,
  TOOL_LABELS,
  type EraserMode,
  type Tool,
} from './tools.ts'

type Props = {
  tool: Tool
  brushSize: number
  brushShape: BrushShape
  eraserMode: EraserMode
  canUndo: boolean
  canRedo: boolean
  onTool: (tool: Tool) => void
  onBrushSize: (size: number) => void
  onBrushShape: (shape: BrushShape) => void
  onEraserMode: (mode: EraserMode) => void
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

type PairProps<T extends string> = {
  options: readonly T[]
  value: T
  label: (option: T) => string
  icon: (option: T) => IconName
  onPick: (option: T) => void
}

function Pair<T extends string>({ options, value, label, icon, onPick }: PairProps<T>) {
  return (
    <div className="segment segment--grid segment--pair">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          title={label(option)}
          aria-label={label(option)}
          className={`segment__option${option === value ? ' segment__option--active' : ''}`}
          onClick={() => onPick(option)}
        >
          <Icon name={icon(option)} />
        </button>
      ))}
    </div>
  )
}

export function Toolbar({
  tool,
  brushSize,
  brushShape,
  eraserMode,
  canUndo,
  canRedo,
  onTool,
  onBrushSize,
  onBrushShape,
  onEraserMode,
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

      <NumberField
        label="Brush size"
        unit="px"
        value={brushSize}
        min={1}
        max={MAX_BRUSH_SIZE}
        onChange={onBrushSize}
      />

      <Pair
        options={BRUSH_SHAPES}
        value={brushShape}
        label={(option) => (option === 'square' ? 'Square brush' : 'Round brush')}
        icon={(option) => option}
        onPick={onBrushShape}
      />

      {tool === 'eraser' && (
        <Pair
          options={ERASER_MODES}
          value={eraserMode}
          label={(option) => (option === 'brush' ? 'Erase with the brush' : 'Erase a connected area')}
          icon={(option) => (option === 'brush' ? 'eraser' : 'fill')}
          onPick={onEraserMode}
        />
      )}

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
