import './PalettePanel.css'
import { FREE_COLOR_COUNT, WPLACE_COLORS, type PaletteColor } from './wplace.ts'

type Props = {
  value: number
  colorCount: number
  onChange: (value: number) => void
}

function Swatches({
  colors,
  firstPixel,
  value,
  colorCount,
  onChange,
}: Props & { colors: readonly PaletteColor[]; firstPixel: number }) {
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

export function PalettePanel(props: Props) {
  return (
    <div className="palette">
      <p className="palette__group">Free · {FREE_COLOR_COUNT}</p>
      <Swatches {...props} colors={WPLACE_COLORS.slice(0, FREE_COLOR_COUNT)} firstPixel={1} />
      <p className="palette__group">
        Premium · {WPLACE_COLORS.length - FREE_COLOR_COUNT}
        {props.colorCount <= FREE_COLOR_COUNT && <span className="palette__note">locked</span>}
      </p>
      <Swatches
        {...props}
        colors={WPLACE_COLORS.slice(FREE_COLOR_COUNT)}
        firstPixel={FREE_COLOR_COUNT + 1}
      />
    </div>
  )
}
