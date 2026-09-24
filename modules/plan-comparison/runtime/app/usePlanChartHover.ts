// Hover tracking for the model info tooltip on a plan-comparison charts.
//
// The chart container listens for `pointermove` and resolves the row under the
// pointer through the d3-bound datum walk (rowFromEventTarget). Open/close are
// delayed here (a controlled `:open` bypasses HoverCard's own delays), the
// anchor is the viewport-space pointer position where a row was entered, and
// stays glued to the pointer while it moves within the open row.
//
// Touch is tap-driven instead: a tap never rests the pointer, and touch-drag
// fires `pointermove` gestures that must not pop tooltips — so touch moves are
// ignored and `pointerup` toggles the tooltip for the tapped model. Touch
// `pointerleave` (fires right after every lift) is ignored for the same reason.
import { getCurrentScope, onScopeDispose, ref } from 'vue'
import type { EnrichedModelRow } from './composables/usePlanComparisonDatabase'
import { rowFromEventTarget } from './model-info'

export interface HoveredModel {
  row: EnrichedModelRow
  /** Pointer position on row entry, in viewport coordinates (clientX/Y). */
  x: number
  y: number
}

const OPEN_DELAY_MS = 150
const CLOSE_DELAY_MS = 150

export function usePlanChartHover(
  rows: () => EnrichedModelRow[],
  tickLabels: () => string[],
  container: () => HTMLElement | null
) {
  const hovered = ref<HoveredModel | null>(null)

  let openTimer: ReturnType<typeof setTimeout> | null = null
  let closeTimer: ReturnType<typeof setTimeout> | null = null

  function clearOpenTimer(): void {
    if (openTimer) {
      clearTimeout(openTimer)
      openTimer = null
    }
  }

  function clearCloseTimer(): void {
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
  }

  // A pending open/close must not fire after the chart unmounts. The guard
  // keeps the composable usable outside a setup scope (plain unit tests).
  if (getCurrentScope()) {
    onScopeDispose(() => {
      clearOpenTimer()
      clearCloseTimer()
    })
  }

  function scheduleOpen(row: EnrichedModelRow, x: number, y: number): void {
    clearCloseTimer()
    if (hovered.value?.row.model.id === row.model.id) {
      // Same row: follow the pointer instead of reopening.
      hovered.value = { row: hovered.value.row, x, y }
      return
    }
    clearOpenTimer()
    openTimer = setTimeout(() => {
      openTimer = null
      hovered.value = { row, x, y }
    }, OPEN_DELAY_MS)
  }

  function scheduleClose(): void {
    clearOpenTimer()
    if (!hovered.value || closeTimer) return
    closeTimer = setTimeout(() => {
      closeTimer = null
      if (!contentHovered) hovered.value = null
    }, CLOSE_DELAY_MS)
  }

  // The tooltip content is portaled outside the chart container, so moving the
  // pointer onto it fires container `pointerleave`. Track content hover to
  // keep the tooltip readable (and its text selectable) while the pointer
  // rests on it; leaving the content resumes the close delay.
  let contentHovered = false

  function onTooltipPointerEnter(): void {
    contentHovered = true
    clearCloseTimer()
  }

  function onTooltipPointerLeave(): void {
    contentHovered = false
    scheduleClose()
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'touch') return
    const el = container()
    if (!el) return
    const row = rowFromEventTarget(rows(), tickLabels(), el, event.target)
    if (!row) {
      scheduleClose()
      return
    }
    scheduleOpen(row, event.clientX, event.clientY)
  }

  function onPointerLeave(event: PointerEvent): void {
    // Touch "leave" fires right after every lift and would close what the tap
    // just opened; touch state is governed by taps alone.
    if (event.pointerType === 'touch') return
    scheduleClose()
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.pointerType !== 'touch') return
    const el = container()
    if (!el) return
    const row = rowFromEventTarget(rows(), tickLabels(), el, event.target)
    clearOpenTimer()
    clearCloseTimer()
    contentHovered = false
    if (!row || hovered.value?.row.model.id === row.model.id) {
      hovered.value = null
      return
    }
    hovered.value = { row, x: event.clientX, y: event.clientY }
  }

  /** Outside dismissal / Escape via Reka's dismissible layer. */
  function close(): void {
    clearOpenTimer()
    clearCloseTimer()
    contentHovered = false
    hovered.value = null
  }

  return { hovered, onPointerMove, onPointerLeave, onPointerUp, onTooltipPointerEnter, onTooltipPointerLeave, close }
}
