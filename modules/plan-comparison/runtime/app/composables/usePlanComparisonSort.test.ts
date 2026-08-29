import { describe, expect, it } from 'vitest'
import { compareKey, sortIndices, sortRows } from './usePlanComparisonSort'
import type { SortableModelRow } from './usePlanComparisonSort'

describe('compareKey', () => {
  it('compares numbers numerically', () => {
    expect(compareKey(5, 10)).toBeLessThan(0)
  })

  it('compares strings with numeric awareness', () => {
    expect(compareKey('GLM-5.2', 'GLM-5.10')).toBeLessThan(0)
  })
})

describe('sortIndices', () => {
  const rows: SortableModelRow[] = [
    { release: null, name: 'C', context: null, aa: null, tps: null, effective: null },
    { release: 3, name: 'A', context: null, aa: null, tps: null, effective: null },
    { release: 1, name: 'B', context: null, aa: null, tps: null, effective: null }
  ]

  it('places rows missing the sort key last in ascending order', () => {
    const order = sortIndices(rows, row => row.release, 'asc')
    expect(order).toEqual([2, 1, 0])
  })

  it('places rows missing the sort key last in descending order too', () => {
    const order = sortIndices(rows, row => row.release, 'desc')
    expect(order).toEqual([1, 2, 0])
  })

  it('breaks ties using the tie-break accessor', () => {
    const tiedRows: SortableModelRow[] = [
      { release: null, name: 'Zeta', context: 50, aa: null, tps: null, effective: null },
      { release: null, name: 'Alpha', context: 50, aa: null, tps: null, effective: null }
    ]
    const order = sortIndices(tiedRows, row => row.context, 'desc', row => row.name)
    expect(order).toEqual([1, 0])
  })

  it('returns original order when no accessor is given', () => {
    const order = sortIndices(rows, null, 'asc')
    expect(order).toEqual([0, 1, 2])
  })
})

describe('sortRows', () => {
  it('sorts by release date, newest first, missing dates last', () => {
    const rows: SortableModelRow[] = [
      { release: 1, name: 'Old', context: null, aa: null, tps: null, effective: null },
      { release: null, name: 'Unknown', context: null, aa: null, tps: null, effective: null },
      { release: 3, name: 'New', context: null, aa: null, tps: null, effective: null }
    ]
    const sorted = sortRows(rows, 'newest')
    expect(sorted.map(r => r.name)).toEqual(['New', 'Old', 'Unknown'])
  })

  it('sorts by name A-Z with numeric awareness', () => {
    const rows: SortableModelRow[] = [
      { release: null, name: 'GLM-5.10', context: null, aa: null, tps: null, effective: null },
      { release: null, name: 'GLM-5.2', context: null, aa: null, tps: null, effective: null }
    ]
    const sorted = sortRows(rows, 'name-asc')
    expect(sorted.map(r => r.name)).toEqual(['GLM-5.2', 'GLM-5.10'])
  })
})
