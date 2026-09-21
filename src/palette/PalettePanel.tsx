import './PalettePanel.css'
import { FREE_COLOR_COUNT, WPLACE_COLORS, type PaletteColor } from './wplace.ts'

const COLOR_SLOTS = ['main', 'edge', 'mix'] as const
export type ColorSlot = (typeof COLOR_SLOTS)[number]

const SLOT_LABELS: Record<ColorSlot, string> = { main: 'Main', edge: 'Edge', mix: 'Mix' }

type Props = {
  main: number
  // Null where the tool in hand has no second colour, which is also what keeps the palette from
  // writing into a slot the user cannot see. The mix is the same promise for a whole set.
  edge: number | null
  mix: readonly number[] | null
  slot: ColorSlot
  colorCount: number
  onSlot: (slot: ColorSlot) => void
  onChange: (pixel: number) => void
  onToggleMix: (pixel: number) => void
}

type SwatchProps = {
  colors: readonly PaletteColor[]
  firstPixel: number
  selected: (pixel: number) => boolean
  colorCount: number
  onChange: (pixel: number) => void
}

function Swatches({ colors, firstPixel, selected, colorCount, onChange }: SwatchProps) {
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
            aria-pressed={selected(pixel)}
            disabled={locked}
            className={`palette__swatch${selected(pixel) ? ' palette__swatch--active' : ''}`}
            style={{ background: color.hex }}
            onClick={() => onChange(pixel)}
          />
        )
      })}
    </div>
  )
}

// Hard stops rather than a blend: a gradient that interpolates would show colours the mix does
// not contain, and this dot's whole job is to say which ones it does.
const mixGradient = (mix: readonly number[]) =>
  mix.length === 0
    ? 'transparent'
    : `linear-gradient(135deg, ${mix
        .map(
          (pixel, index) =>
            `${WPLACE_COLORS[pixel - 1].hex} ${(index / mix.length) * 100}% ${
              ((index + 1) / mix.length) * 100
            }%`,
        )
        .join(', ')})`

export function PalettePanel({
  main,
  edge,
  mix,
  slot,
  colorCount,
  onSlot,
  onChange,
  onToggleMix,
}: Props) {
  const mixed = mix ?? []
  const mixing = slot === 'mix' && mix !== null
  const value = slot === 'edge' && edge !== null ? edge : main
  const slots = COLOR_SLOTS.filter((option) =>
    option === 'edge' ? edge !== null : option === 'mix' ? mix !== null : true,
  )
  const selected = mixing
    ? (pixel: number) => mixed.includes(pixel)
    : (pixel: number) => pixel === value
  const swatches = { selected, colorCount, onChange: mixing ? onToggleMix : onChange }
  return (
    <div className="palette">
      {slots.length > 1 && (
        <div className="segment palette__slots">
          {slots.map((option) => (
            <button
              key={option}
              type="button"
              className={`segment__option${option === slot ? ' segment__option--active' : ''}`}
              onClick={() => onSlot(option)}
            >
              <span
                className="palette__dot"
                style={{
                  background:
                    option === 'mix'
                      ? mixGradient(mixed)
                      : WPLACE_COLORS[(option === 'edge' && edge !== null ? edge : main) - 1].hex,
                }}
              />
              {SLOT_LABELS[option]}
            </button>
          ))}
        </div>
      )}
      {mixing && (
        <p className="palette__hint">
          {mixed.length === 0
            ? 'Pick the colours the scatter brush draws from.'
            : `${mixed.length} colour${mixed.length === 1 ? '' : 's'} in the mix · click to remove`}
        </p>
      )}
      <p className="palette__group">Free · {FREE_COLOR_COUNT}</p>
      <Swatches colors={WPLACE_COLORS.slice(0, FREE_COLOR_COUNT)} firstPixel={1} {...swatches} />
      <p className="palette__group">
        Premium · {WPLACE_COLORS.length - FREE_COLOR_COUNT}
        {colorCount <= FREE_COLOR_COUNT && <span className="palette__note">locked</span>}
      </p>
      <Swatches
        colors={WPLACE_COLORS.slice(FREE_COLOR_COUNT)}
        firstPixel={FREE_COLOR_COUNT + 1}
        {...swatches}
      />
    </div>
  )
}
