// Model info tooltip for the plan-comparison charts.
//
// Hovering a model (its name on the y axis, a credit bar or a request dot)
// opens a tooltip with the model's spec sheet. Row resolution reads the datum
// Unovis/d3 bind to each SVG element (`__data__`) instead of re-deriving chart
// geometry.

import type { EnrichedModelRow } from './composables/usePlanComparisonDatabase'
import { PLAN_COMPARISON_PLANS, type PlanComparisonPlanMeta } from './plan-colors'
import type { Model, ModelDeal, PricingEntry } from './types'

export interface ModelInfoField {
  label: string
  value: string
}

/** `1000000` → `1M`, `200000` → `200K`, `1048576` → `1.05M` (3 significant digits). */
export function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toPrecision(3))}M`
  if (value >= 1_000) return `${Number((value / 1_000).toPrecision(3))}K`
  return String(value)
}

/**
 * True when a number's shortest repr is IEEE-754 noise, not a published value:
 * doubles carry 15–17 significant digits, so a core digit run past 10 means the
 * number never had a clean decimal form (`3.5999999999999996` from `1.2 × 3`).
 * Precise finite values such as `0.003625` (4 core digits) are real and left
 * alone — they are not artifacts.
 */
function isFloatArtifact(value: number): boolean {
  if (!Number.isFinite(value)) return false
  const s = String(Math.abs(value))
  if (s.includes('e') || s.includes('E')) return false
  const core = s.replace('.', '').replace(/^0+/, '').replace(/0+$/, '')
  return core.length > 10
}

/**
 * Display form for a model number: cleans float artifacts to 2 decimals
 * (`3.5999999999999996` → `3.6`) while preserving precise finite values —
 * rounding `0.003625` to 2dp would zero it and misread as free. Never collapses
 * a non-zero value to `0`.
 */
function displayNumber(value: number): string {
  if (isFloatArtifact(value)) {
    const rounded = Number(value.toFixed(2))
    if (rounded !== 0) return String(rounded)
  }
  return String(value)
}

/** Scores render cleaned of float noise; finite precision is kept: `58.68` → `58.68`. */
export function formatScore(value: number): string {
  return displayNumber(value)
}

// Date-only ISO strings (`2026-08-05`) parse as UTC midnight, so render in UTC
// too: a local timezone west of UTC would otherwise show the previous day.
const tooltipDateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
})

/** `2026-08-05` → `Aug 5, 2026`; unparseable input falls back to the raw string. */
export function formatDate(value: string): string {
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? value : tooltipDateFormat.format(new Date(ms))
}

function capsValue(model: Model): ModelInfoField | null {
  // Only confirmed capabilities: asserting "Text" for metadata-null rows
  // (OpenCode-only models arrive with `caps: {}`) would invent data.
  const labels = [
    model.caps.text ? 'Text' : null,
    model.caps.vision ?? model.vision ? 'Vision' : null,
    model.caps.reasoning ?? model.reasoning ? 'Reasoning' : null
  ].filter((entry): entry is string => entry != null)
  return labels.length ? { label: 'Caps', value: labels.join(', ') } : null
}

function dealField(deal: ModelDeal | null): ModelInfoField | null {
  if (!deal) return null
  if (deal.free) return { label: 'Deal', value: 'Free (for now)' }
  if (!deal.expires) return { label: 'Deal', value: 'On sale' }
  return { label: 'Deal', value: `On sale until ${formatDate(deal.expires)}` }
}

function minPlanField(minPlanName: string | null): ModelInfoField | null {
  if (!minPlanName) return null
  const key = minPlanName.trim().toLowerCase()
  const value = key === 'go' ? 'Cmd Go' : key === 'goat' ? 'Cmd GOAT' : minPlanName
  return { label: 'Min plan', value }
}

/** `$0` rates are indistinguishable from "not published" in the crawl → hide them. */
function priceField(label: string, value: number | null | undefined): ModelInfoField | null {
  if (value == null || value <= 0) return null
  return { label, value: `$${displayNumber(value)}/1M tokens` }
}

/**
 * Tooltip content for one model: label/value rows, in display order. Fields the
 * crawl has no value for are skipped, so OpenCode-only rows (metadata-null)
 * degrade to a short list instead of a wall of "—".
 */
export function modelInfoFields(model: Model, pricing: PricingEntry | null): ModelInfoField[] {
  const candidates: (ModelInfoField | null)[] = [
    model.vendor ? { label: 'Vendor', value: model.vendor } : null,
    model.contextWindow != null ? { label: 'Context', value: `${formatTokenCount(model.contextWindow)} tokens` } : null,
    model.intelligenceIndex != null ? { label: 'Intelligence', value: formatScore(model.intelligenceIndex) } : null,
    model.codingIndex != null ? { label: 'Coding index', value: formatScore(model.codingIndex) } : null,
    model.outputTokensPerSec != null ? { label: 'Output speed', value: `${formatScore(model.outputTokensPerSec)} tok/s` } : null,
    model.category ? { label: 'Category', value: model.category } : null,
    priceField('Input price', pricing?.input),
    priceField('Output price', pricing?.output),
    priceField('Cache read', pricing?.cache_read),
    priceField('Cache write', pricing?.cache_write),
    capsValue(model),
    model.releaseDate ? { label: 'Released', value: formatDate(model.releaseDate) } : null,
    model.launchedAt ? { label: 'On Command Code', value: formatDate(model.launchedAt) } : null,
    minPlanField(model.minPlanName),
    dealField(model.deal)
  ]
  return candidates.filter((field): field is ModelInfoField => field != null)
}

const FUNDING_DASH = '—'

function fundingValue(funding: EnrichedModelRow['cmd']): string {
  if (funding.credit == null) return FUNDING_DASH
  const credit = `$${displayNumber(funding.credit)} credit`
  if (funding.request == null) return `${credit} · ${FUNDING_DASH} req/mo`
  return `${credit} · ${funding.request.toLocaleString('en-US')} req/mo`
}

/**
 * Per-plan funding rows for the tooltip: one entry per plan in registry order,
 * `$X credit · Y req/mo`, with a dash for values the data does not publish.
 */
export function fundingFields(row: EnrichedModelRow): ModelInfoField[] {
  return PLAN_COMPARISON_PLANS.map(plan => ({
    label: plan.label,
    value: fundingValue(row[plan.key])
  }))
}

export interface PlanFundingField extends ModelInfoField {
  plan: PlanComparisonPlanMeta
}

/**
 * Funding rows joined to their plan meta by registry label, so the template
 * tints each plan name without positional coupling to the fields array.
 */
export function fundingWithPlans(row: EnrichedModelRow): PlanFundingField[] {
  const byLabel = new Map(fundingFields(row).map(field => [field.label, field]))
  return PLAN_COMPARISON_PLANS.map(plan => ({
    label: plan.label,
    value: byLabel.get(plan.label)?.value ?? FUNDING_DASH,
    plan
  }))
}

/** Whitespace-insensitive label text: SVG tick text loses the `\n` line breaks. */
export function normalizeLabelText(text: string): string {
  return text.replace(/\s+/g, '')
}

interface DatumElement extends Element {
  __data__?: unknown
}

/** Structural check: the event target is a DOM element inside the chart. */
function isElement(target: EventTarget | null, container: Element | null): target is Element {
  return container != null
    && target != null
    && typeof (target as Element).contains === 'function'
    && typeof (target as Element).closest === 'function'
}

/**
 * Maps a pointer event target inside a chart container to its row.
 *
 * - Walks up from the target to the nearest element with a datum bound by
 *   Unovis/d3 (`__data__`), staying inside `container`.
 * - Tick elements carry the tick value (a row index `number`) — accepted only
 *   when the tick's text matches that row's label, so x-axis ticks reject.
 * - Bar/dot datums resolve through `rowFromClickDatum`'s object handling.
 */
export function rowFromEventTarget(
  rows: EnrichedModelRow[],
  tickLabels: string[],
  container: Element | null,
  target: EventTarget | null
): EnrichedModelRow | null {
  if (container == null || !isElement(target, container)) return null
  // A datum bound outside the chart (another SVG on the page) must not
  // resolve: the walk below would otherwise accept it.
  if (!container.contains(target)) return null
  let el: Element | null = target
  let datum: unknown
  while (el) {
    const bound = (el as DatumElement).__data__
    if (bound !== undefined) {
      datum = bound
      break
    }
    if (el === container) return null
    el = el.parentElement
  }
  const tickText = (el?.closest('text') ?? el?.closest('g.tick'))?.textContent ?? null
  return rowFromClickDatum(rows, tickLabels, datum, tickText)
}

/**
 * Maps a clicked chart element's bound datum to its row.
 *
 * - y-axis ticks carry the tick value (a `number`, `tickValues` = row indices),
 *   which x-axis ticks do too — so a numeric datum is only accepted when the
 *   tick's text matches that row's label.
 * - Request dots are `ScatterPoint<DotPoint>` wrappers with `rowIndex`.
 * - Credit bars are bound straight to the row.
 */
export function rowFromClickDatum(
  rows: EnrichedModelRow[],
  tickLabels: string[],
  datum: unknown,
  tickLabelText: string | null
): EnrichedModelRow | null {
  if (typeof datum === 'number') {
    const index = Math.round(datum)
    const row = rows[index]
    const expected = tickLabels[index]
    if (!row || expected == null || tickLabelText == null) return null
    return normalizeLabelText(tickLabelText) === normalizeLabelText(expected) ? row : null
  }
  if (datum && typeof datum === 'object') {
    const record = datum as Record<string, unknown>
    if (typeof record.rowIndex === 'number') return rows[record.rowIndex] ?? null
    if ('model' in record && 'label' in record) return datum as EnrichedModelRow
  }
  return null
}
