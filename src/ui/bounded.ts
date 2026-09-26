// What a typed number commits as: null while the text is not a number yet (an emptied field, a
// lone minus), otherwise rounded to a whole value and pulled inside the range.
export function parseBounded(text: string, min: number, max: number): number | null {
  if (text.trim() === '') return null
  const value = Number(text)
  if (!Number.isFinite(value)) return null
  return Math.min(max, Math.max(min, Math.round(value)))
}
