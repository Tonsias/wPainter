import { useState } from 'react'
import { parseBounded } from './bounded.ts'

type Props = {
  label: string
  unit: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

// The text is held apart from the value while it is being typed: clamping every keystroke would
// turn an emptied field into `min` and make "15" unreachable by clearing and typing it. Blur shows
// the committed value again.
export function NumberField({ label, unit, value, min, max, onChange }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <label className="number-field" title={`${label} (${min}–${max})`}>
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={1}
        value={draft ?? value}
        onChange={(event) => {
          setDraft(event.target.value)
          const parsed = parseBounded(event.target.value, min, max)
          if (parsed !== null) onChange(parsed)
        }}
        onBlur={() => setDraft(null)}
      />
      <span className="number-field__unit">{unit}</span>
    </label>
  )
}
