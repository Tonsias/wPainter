import './PalettePanel.css'
import { MAX_OUTLINE_COLORS } from '../document/paint.ts'
import { FREE_COLOR_COUNT, WPLACE_COLORS, type PaletteColor } from './wplace.ts'

const COLOR_SLOTS = ['main', 'edge', 'mix'] as const
export type ColorSlot = (typeof COLOR_SLOTS)[number]

const SLOT_LABELS: Record<ColorSlot, string> = { main: 'Main', edge: 'Edge', mix: 'Mix' }

type Props = {
  main: number
  // Null where the tool in hand has no such slot, which is also what keeps the palette from
  // writing into a slot the user cannot see. Both are sets, and the edge's order is its ring
  // order: first picked is the ring against the fill.
  edges: readonly number[] | null
  mix: readonly number[] | null
  slot: ColorSlot
  colorCount: number
  onSlot: (slot: ColorSlot) => void
  onChange: (pixel: number) => void
  onToggle: (pixel: number) => void
}

type SwatchProps = {
  colors: readonly PaletteColor[]
  firstPixel: number
  selected: (pixel: number) => boolean
  disabled: (pixel: number) => boolean
  onChange: (pixel: number) => void
}

function Swatches({ colors, firstPixel, selected, disabled, onChange }: SwatchProps) {
  return (
    <div className="palette__grid">
      {colors.map((color, offset) => {
        const pixel = firstPixel + offset
        return (
          <button
            key={color.hex}
            type="button"
            title={`${color.name} · ${color.hex}`}
            aria-label={color.name}
            aria-pressed={selected(pixel)}
            disabled={disabled(pixel)}
            className={`palette__swatch${selected(pixel) ? ' palette__swatch--active' : ''}`}
            style={{ background: color.hex }}
            onClick={() => onChange(pixel)}
          />
        )
      })}
    </div>
  )
}

// Hard stops rather than a blend: a gradient that interpolates would show colours the set does
// not contain, and these dots' whole job is to say which ones it does.
const stops = (pixels: readonly number[]) =>
  pixels.map(
    (pixel, index) =>
      `${WPLACE_COLORS[pixel - 1].hex} ${(index / pixels.length) * 100}% ${
        ((index + 1) / pixels.length) * 100
      }%`,
  )

const mixGradient = (mix: readonly number[]) =>
  mix.length === 0 ? 'transparent' : `linear-gradient(135deg, ${stops(mix).join(', ')})`

// Concentric, because the rings are: the dot is a miniature of the nib the brush lays down.
const edgeGradient = (main: number, edges: readonly number[]) =>
  `radial-gradient(circle, ${stops([main, ...edges]).join(', ')})`

export function PalettePanel({
  main,
  edges,
  mix,
  slot,
  colorCount,
  onSlot,
  onChange,
  onToggle,
}: Props) {
  const edged = edges ?? []
  const mixed = mix ?? []
  const edging = slot === 'edge' && edges !== null
  const mixing = slot === 'mix' && mix !== null
  const set = edging ? edged : mixing ? mixed : null
  const slots = COLOR_SLOTS.filter((option) =>
    option === 'edge' ? edges !== null : option === 'mix' ? mix !== null : true,
  )
  const selected = set
    ? (pixel: number) => set.includes(pixel)
    : (pixel: number) => pixel === main
  const full = edging && edged.length >= MAX_OUTLINE_COLORS
  const swatches = {
    selected,
    disabled: (pixel: number) => pixel > colorCount || (full && !selected(pixel)),
    onChange: set ? onToggle : onChange,
  }
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
                      : option === 'edge'
                        ? edgeGradient(main, edged)
                        : WPLACE_COLORS[main - 1].hex,
                }}
              />
              {SLOT_LABELS[option]}
            </button>
          ))}
        </div>
      )}
      {edging && (
        <p className="palette__hint">
          {edged.length === 0
            ? `Pick up to ${MAX_OUTLINE_COLORS} outline colours — the first is the ring against the fill.`
            : `${edged.length} of ${MAX_OUTLINE_COLORS} rings, innermost first · click to remove`}
        </p>
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
