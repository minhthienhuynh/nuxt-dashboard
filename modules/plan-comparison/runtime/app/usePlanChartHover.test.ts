import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { usePlanChartHover } from './usePlanChartHover'
import type { EnrichedModelRow } from './composables/usePlanComparisonDatabase'

// Row resolution goes through the d3 `__data__` walk on a real chart; here the
// target simply carries the row it would resolve to.
vi.mock('./model-info', () => ({
  rowFromEventTarget: (...args: unknown[]) => {
    const target = args[3] as { __row?: EnrichedModelRow } | null | undefined
    return target?.__row ?? null
  }
}))

const rowA = { model: { id: 'model-a' } } as unknown as EnrichedModelRow
const rowB = { model: { id: 'model-b' } } as unknown as EnrichedModelRow
const el = {} as HTMLElement

function setup() {
  return usePlanChartHover(() => [rowA, rowB], () => [], () => el)
}

function event(pointerType: 'mouse' | 'touch', row: EnrichedModelRow | null, x = 10, y = 20): PointerEvent {
  return {
    pointerType,
    clientX: x,
    clientY: y,
    target: row ? { __row: row } : {}
  } as unknown as PointerEvent
}

describe('usePlanChartHover', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens after the open delay once the pointer rests on a row', () => {
    const { hovered, onPointerMove } = setup()
    onPointerMove(event('mouse', rowA, 5, 6))
    expect(hovered.value).toBeNull()
    vi.advanceTimersByTime(149)
    expect(hovered.value).toBeNull()
    vi.advanceTimersByTime(1)
    expect(hovered.value?.row.model.id).toBe('model-a')
    expect(hovered.value?.x).toBe(5)
    expect(hovered.value?.y).toBe(6)
  })

  it('closes after the leave delay', () => {
    const { hovered, onPointerMove, onPointerLeave } = setup()
    onPointerMove(event('mouse', rowA))
    vi.advanceTimersByTime(150)
    expect(hovered.value?.row.model.id).toBe('model-a')
    onPointerLeave(event('mouse', null))
    vi.advanceTimersByTime(149)
    expect(hovered.value?.row.model.id).toBe('model-a')
    vi.advanceTimersByTime(1)
    expect(hovered.value).toBeNull()
  })

  it('re-entering the same row cancels the pending close', () => {
    const { hovered, onPointerMove, onPointerLeave } = setup()
    onPointerMove(event('mouse', rowA))
    vi.advanceTimersByTime(150)
    onPointerLeave(event('mouse', null))
    vi.advanceTimersByTime(100)
    onPointerMove(event('mouse', rowA))
    vi.advanceTimersByTime(200)
    expect(hovered.value?.row.model.id).toBe('model-a')
  })

  it('follows the pointer anchor within the open row', () => {
    const { hovered, onPointerMove } = setup()
    onPointerMove(event('mouse', rowA, 5, 6))
    vi.advanceTimersByTime(150)
    expect(hovered.value?.x).toBe(5)
    onPointerMove(event('mouse', rowA, 50, 60))
    expect(hovered.value?.row.model.id).toBe('model-a')
    expect(hovered.value?.x).toBe(50)
    expect(hovered.value?.y).toBe(60)
  })

  it('replaces the open row with another after the delay', () => {
    const { hovered, onPointerMove } = setup()
    onPointerMove(event('mouse', rowA))
    vi.advanceTimersByTime(150)
    expect(hovered.value?.row.model.id).toBe('model-a')
    onPointerMove(event('mouse', rowB, 30, 40))
    vi.advanceTimersByTime(150)
    expect(hovered.value?.row.model.id).toBe('model-b')
    expect(hovered.value?.x).toBe(30)
  })

  it('a pointer resting on no row schedules the close', () => {
    const { hovered, onPointerMove } = setup()
    onPointerMove(event('mouse', rowA))
    vi.advanceTimersByTime(150)
    onPointerMove(event('mouse', null))
    vi.advanceTimersByTime(150)
    expect(hovered.value).toBeNull()
  })

  it('ignores mouse and pen pointerup', () => {
    const { hovered, onPointerUp } = setup()
    onPointerUp(event('mouse', rowA))
    expect(hovered.value).toBeNull()
  })

  it('touch pointerup toggles the tooltip open and closed', () => {
    const { hovered, onPointerUp } = setup()
    onPointerUp(event('touch', rowA, 7, 8))
    expect(hovered.value?.row.model.id).toBe('model-a')
    expect(hovered.value?.x).toBe(7)
    onPointerUp(event('touch', rowA))
    expect(hovered.value).toBeNull()
  })

  it('touch pointerup outside any row closes the open tooltip', () => {
    const { hovered, onPointerUp } = setup()
    onPointerUp(event('touch', rowA))
    onPointerUp(event('touch', null))
    expect(hovered.value).toBeNull()
  })

  it('ignores touch pointermove and pointerleave', () => {
    const { hovered, onPointerUp, onPointerMove, onPointerLeave } = setup()
    onPointerUp(event('touch', rowA))
    onPointerMove(event('touch', rowB, 50, 60))
    vi.advanceTimersByTime(300)
    expect(hovered.value?.row.model.id).toBe('model-a')
    onPointerLeave(event('touch', null))
    vi.advanceTimersByTime(300)
    expect(hovered.value?.row.model.id).toBe('model-a')
  })

  it('close() clears a pending open immediately', () => {
    const { hovered, onPointerMove, close } = setup()
    onPointerMove(event('mouse', rowA))
    close()
    vi.advanceTimersByTime(300)
    expect(hovered.value).toBeNull()
  })

  it('stays open while the pointer rests on the tooltip content', () => {
    const { hovered, onPointerMove, onPointerLeave, onTooltipPointerEnter, onTooltipPointerLeave } = setup()
    onPointerMove(event('mouse', rowA))
    vi.advanceTimersByTime(150)
    // Moving from the chart to the content fires container leave first.
    onTooltipPointerEnter()
    onPointerLeave(event('mouse', null))
    vi.advanceTimersByTime(300)
    expect(hovered.value?.row.model.id).toBe('model-a')
    onTooltipPointerLeave()
    vi.advanceTimersByTime(149)
    expect(hovered.value?.row.model.id).toBe('model-a')
    vi.advanceTimersByTime(1)
    expect(hovered.value).toBeNull()
  })

  it('drops a pending open when the scope is disposed', () => {
    const scope = effectScope()
    const { hovered, onPointerMove } = scope.run(() => setup())!
    onPointerMove(event('mouse', rowA))
    scope.stop()
    vi.advanceTimersByTime(300)
    expect(hovered.value).toBeNull()
  })

  it('drops a pending close when the scope is disposed', () => {
    const scope = effectScope()
    const { hovered, onPointerMove, onPointerLeave } = scope.run(() => setup())!
    onPointerMove(event('mouse', rowA))
    vi.advanceTimersByTime(150)
    onPointerLeave(event('mouse', null))
    scope.stop()
    vi.advanceTimersByTime(300)
    expect(hovered.value?.row.model.id).toBe('model-a')
  })
})
