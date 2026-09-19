export type SortKey = 'release' | 'name' | 'context' | 'intelligence' | 'speed' | 'inputPrice'
export type SortDirection = 'asc' | 'desc'

export type SortOptionId
  = | 'newest'
    | 'oldest'
    | 'name-asc'
    | 'name-desc'
    | 'context-desc'
    | 'intelligence-desc'
    | 'speed-desc'
    | 'cheapest'
    | 'priciest'

export interface SortOption {
  key: SortKey
  dir: SortDirection
}

export const SORT_OPTIONS: Record<SortOptionId, SortOption> = {
  'newest': { key: 'release', dir: 'desc' },
  'oldest': { key: 'release', dir: 'asc' },
  'name-asc': { key: 'name', dir: 'asc' },
  'name-desc': { key: 'name', dir: 'desc' },
  'context-desc': { key: 'context', dir: 'desc' },
  'intelligence-desc': { key: 'intelligence', dir: 'desc' },
  'speed-desc': { key: 'speed', dir: 'desc' },
  'cheapest': { key: 'inputPrice', dir: 'asc' },
  'priciest': { key: 'inputPrice', dir: 'desc' }
}

// Numeric-aware collator so "GLM-5.2" sorts before "GLM-5.10" instead of alphabetically.
const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' })

export function compareKey(a: string | number, b: string | number): number {
  return typeof a === 'string' ? collator.compare(a, b as string) : (a as number) - (b as number)
}

export interface SortableModelRow {
  release: number | null
  name: string
  context: number | null
  intelligence: number | null
  speed: number | null
  inputPrice: number | null
}

function accessorFor<T extends SortableModelRow>(key: SortKey) {
  return (row: T): string | number | null | undefined => row[key]
}

/**
 * Sorts row indices by `keyOf`. Rows whose key is null/undefined always sort last,
 * regardless of `dir`. On a tie, falls back to the model name (upstream semantics).
 */
export function sortIndices<T>(
  rows: T[],
  keyOf: ((row: T) => string | number | null | undefined) | null,
  dir: SortDirection,
  tieKeyOf?: ((row: T) => string | number | null | undefined) | null
): number[] {
  const indices = rows.map((_, i) => i)
  if (!keyOf) return indices

  return indices.sort((a, b) => {
    const ka = keyOf(rows[a]!)
    const kb = keyOf(rows[b]!)
    if (ka == null && kb == null) return a - b
    if (ka == null) return 1
    if (kb == null) return -1

    const d = compareKey(ka, kb)
    if (d !== 0) return dir === 'asc' ? d : -d

    if (tieKeyOf) {
      const ta = tieKeyOf(rows[a]!)
      const tb = tieKeyOf(rows[b]!)
      if (ta == null && tb == null) return a - b
      if (ta == null) return 1
      if (tb == null) return -1
      return compareKey(ta, tb)
    }

    return a - b
  })
}

export function sortRows<T extends SortableModelRow>(rows: T[], optionId: SortOptionId): T[] {
  const { key, dir } = SORT_OPTIONS[optionId]
  const primary = accessorFor<T>(key)
  const tie = key === 'name' ? null : accessorFor<T>('name')
  const indices = sortIndices(rows, primary, dir, tie)
  return indices.map(i => rows[i]!)
}
