import { describe, expect, it } from 'vitest'
import { compareKey, sortIndices, sortRows } from './usePlanComparisonSort'
import type { SortableModelRow } from './usePlanComparisonSort'

function makeRow(name: string, overrides: Partial<SortableModelRow> = {}): SortableModelRow {
  return { release: null, name, context: null, intelligence: null, speed: null, inputPrice: null, ...overrides }
}

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
    makeRow('C'),
    makeRow('A', { release: 3 }),
    makeRow('B', { release: 1 })
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
      makeRow('Zeta', { context: 50 }),
      makeRow('Alpha', { context: 50 })
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
      makeRow('Old', { release: 1 }),
      makeRow('Unknown'),
      makeRow('New', { release: 3 })
    ]
    const sorted = sortRows(rows, 'newest')
    expect(sorted.map(r => r.name)).toEqual(['New', 'Old', 'Unknown'])
  })

  it('sorts by name A-Z with numeric awareness', () => {
    const rows: SortableModelRow[] = [
      makeRow('GLM-5.10'),
      makeRow('GLM-5.2')
    ]
    const sorted = sortRows(rows, 'name-asc')
    expect(sorted.map(r => r.name)).toEqual(['GLM-5.2', 'GLM-5.10'])
  })

  it('sorts by intelligence index, missing scores last with name tie-break', () => {
    const rows: SortableModelRow[] = [
      makeRow('Low', { intelligence: 10 }),
      makeRow('Unknown'),
      makeRow('High', { intelligence: 90 }),
      makeRow('High2', { intelligence: 90 })
    ]
    const sorted = sortRows(rows, 'intelligence-desc')
    expect(sorted.map(r => r.name)).toEqual(['High', 'High2', 'Low', 'Unknown'])
  })

  it('sorts by measured speed, missing values last', () => {
    const rows: SortableModelRow[] = [
      makeRow('Slow', { speed: 50 }),
      makeRow('Fast', { speed: 200 })
    ]
    const sorted = sortRows(rows, 'speed-desc')
    expect(sorted.map(r => r.name)).toEqual(['Fast', 'Slow'])
  })
})
