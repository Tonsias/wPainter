import './PalettePanel.css'
import { FREE_COLOR_COUNT, WPLACE_COLORS, type PaletteColor } from './wplace.ts'

const COLOR_SLOTS = ['main', 'edge'] as const
export type ColorSlot = (typeof COLOR_SLOTS)[number]

const SLOT_LABELS: Record<ColorSlot, string> = { main: 'Main', edge: 'Edge' }

type Props = {
  main: number
  // Null where the tool in hand has no second colour, which is also what keeps the palette from
  // writing into a slot the user cannot see.
  edge: number | null
  slot: ColorSlot
  colorCount: number
  onSlot: (slot: ColorSlot) => void
  onChange: (pixel: number) => void
}

type SwatchProps = {
  colors: readonly PaletteColor[]
  firstPixel: number
  value: number
  colorCount: number
  onChange: (pixel: number) => void
}

function Swatches({ colors, firstPixel, value, colorCount, onChange }: SwatchProps) {
  return (
    <div className="palette__grid">
      {colors.map((color, offset) => {
        const pixel = firstPixel + offset
        const locked = pixel > colorCount
        return (
          <button
            key={color.hex}
            type="button"
            title={`${color.name} · ${color.hex}`}
            aria-label={color.name}
            aria-pressed={pixel === value}
            disabled={locked}
            className={`palette__swatch${pixel === value ? ' palette__swatch--active' : ''}`}
            style={{ background: color.hex }}
            onClick={() => onChange(pixel)}
          />
        )
      })}
    </div>
  )
}

export function PalettePanel({ main, edge, slot, colorCount, onSlot, onChange }: Props) {
  const value = slot === 'edge' && edge !== null ? edge : main
  return (
    <div className="palette">
      {edge !== null && (
        <div className="segment palette__slots">
          {COLOR_SLOTS.map((option) => (
            <button
              key={option}
              type="button"
              className={`segment__option${option === slot ? ' segment__option--active' : ''}`}
              onClick={() => onSlot(option)}
            >
              <span
                className="palette__dot"
                style={{ background: WPLACE_COLORS[(option === 'edge' ? edge : main) - 1].hex }}
              />
              {SLOT_LABELS[option]}
            </button>
          ))}
        </div>
      )}
      <p className="palette__group">Free · {FREE_COLOR_COUNT}</p>
      <Swatches
        colors={WPLACE_COLORS.slice(0, FREE_COLOR_COUNT)}
        firstPixel={1}
        value={value}
        colorCount={colorCount}
        onChange={onChange}
      />
      <p className="palette__group">
        Premium · {WPLACE_COLORS.length - FREE_COLOR_COUNT}
        {colorCount <= FREE_COLOR_COUNT && <span className="palette__note">locked</span>}
      </p>
      <Swatches
        colors={WPLACE_COLORS.slice(FREE_COLOR_COUNT)}
        firstPixel={FREE_COLOR_COUNT + 1}
        value={value}
        colorCount={colorCount}
        onChange={onChange}
      />
    </div>
  )
}
