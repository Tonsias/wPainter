import './PalettePanel.css'
import { MAX_MIX_WEIGHT, MAX_OUTLINE_COLORS, type MixColor } from '../document/paint.ts'
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
  mix: readonly MixColor[] | null
  slot: ColorSlot
  colorCount: number
  onSlot: (slot: ColorSlot) => void
  onChange: (pixel: number) => void
  onToggle: (pixel: number) => void
  onWeight: (pixel: number, weight: number) => void
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

const weight = (pixels: readonly number[]): readonly MixColor[] =>
  pixels.map((pixel) => ({ pixel, weight: 1 }))

// Clamped to 0.1–99.9 while other colours share the mix: every one of them still lands somewhere,
// so rounding one to 0% or 100% would misreport it. Near either end a tenth is what shows.
const share = (mix: readonly MixColor[], of: number) => {
  if (mix.length === 1) return '100'
  const percent = (of / mix.reduce((sum, item) => sum + item.weight, 0)) * 100
  const bounded = Math.min(99.9, Math.max(0.1, percent))
  return bounded < 10 || bounded > 90 ? bounded.toFixed(1) : String(Math.round(bounded))
}

// The slider is logarithmic: on a linear 1–999 track everything under 1% would sit in the first
// hundredth of its travel.
const SLIDER_STEPS = 1000
const sliderToWeight = (position: number) =>
  Math.round(MAX_MIX_WEIGHT ** (position / SLIDER_STEPS))
const weightToSlider = (weight: number) =>
  Math.round((Math.log(weight) / Math.log(MAX_MIX_WEIGHT)) * SLIDER_STEPS)

// Hard stops rather than a blend: a gradient that interpolates would show colours the set does
// not contain, and these dots' whole job is to say which ones it does. Each stop is as wide as
// its weight, so the mix dot reads as the ratio the brush draws at.
const stops = (slices: readonly MixColor[]) => {
  const total = slices.reduce((sum, item) => sum + item.weight, 0)
  let filled = 0
  return slices.map((item) => {
    const from = (filled / total) * 100
    filled += item.weight
    return `${WPLACE_COLORS[item.pixel - 1].hex} ${from}% ${(filled / total) * 100}%`
  })
}

const mixGradient = (mix: readonly MixColor[]) =>
  mix.length === 0 ? 'transparent' : `linear-gradient(135deg, ${stops(mix).join(', ')})`

// Concentric, because the rings are: the dot is a miniature of the nib the brush lays down.
const edgeGradient = (main: number, edges: readonly number[]) =>
  `radial-gradient(circle, ${stops(weight([main, ...edges])).join(', ')})`

export function PalettePanel({
  main,
  edges,
  mix,
  slot,
  colorCount,
  onSlot,
  onChange,
  onToggle,
  onWeight,
}: Props) {
  const edged = edges ?? []
  const mixed = mix ?? []
  const edging = slot === 'edge' && edges !== null
  const mixing = slot === 'mix' && mix !== null
  const slots = COLOR_SLOTS.filter((option) =>
    option === 'edge' ? edges !== null : option === 'mix' ? mix !== null : true,
  )
  const selected = edging
    ? (pixel: number) => edged.includes(pixel)
    : mixing
      ? (pixel: number) => mixed.some((item) => item.pixel === pixel)
      : (pixel: number) => pixel === main
  const full = edging && edged.length >= MAX_OUTLINE_COLORS
  const swatches = {
    selected,
    disabled: (pixel: number) => pixel > colorCount || (full && !selected(pixel)),
    onChange: edging || mixing ? onToggle : onChange,
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
      {mixing && mixed.length > 0 && (
        <ul className="palette__mix">
          {mixed.map((item) => (
            <li key={item.pixel} className="palette__ratio">
              <span
                className="palette__dot"
                style={{ background: WPLACE_COLORS[item.pixel - 1].hex }}
              />
              <input
                type="range"
                min={0}
                max={SLIDER_STEPS}
                value={weightToSlider(item.weight)}
                aria-label={`${WPLACE_COLORS[item.pixel - 1].name} share of the mix`}
                onChange={(event) => onWeight(item.pixel, sliderToWeight(Number(event.target.value)))}
              />
              <span className="palette__share">{share(mixed, item.weight)}%</span>
            </li>
          ))}
        </ul>
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
