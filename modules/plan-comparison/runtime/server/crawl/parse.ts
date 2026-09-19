export const UNDEFINED_SENTINEL = '$undefined'

const NULL_TOKENS = new Set(['', '-', '—', UNDEFINED_SENTINEL])

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[$,\s]/g, '')
  if (NULL_TOKENS.has(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
