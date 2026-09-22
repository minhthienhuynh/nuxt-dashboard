// Axis geometry for the plan-comparison charts.
//
// Both charts used Unovis' defaults, which wrap tick text into a ~67px column
// whatever the container size: on a phone (iPhone 12 Pro, 390px → 358px chart)
// every model name broke into 2-4 lines (up to 59px tall) inside 30-48px row
// bands, so labels ran over the neighbouring rows, and the fixed log-decade x
// ticks (300 … 300.000, ~40px wide) collided in ~40px of horizontal space.
//
// Measured against the live dataset (55 rows, Inter 500): the longest label
// ("DeepSeek V4 Flash Vision (exp) (35)") needs 198px at 14px and 181px at
// 11px. So phones get an 11px font in a column that is ~55% of the chart (197px
// of 358px) — enough to keep every label on one line, without the information
// loss of trim (which rendered "MiMo V2… (46.3)" twice). The row bands below
// still leave room for the occasional two-line label on a 320px phone.
//
// Keep the numbers here — pure and unit tested — so both charts stay in sync.

export const AXIS_LABEL_MIN_WIDTH = 132
export const AXIS_LABEL_MAX_WIDTH = 280
export const AXIS_LABEL_WIDTH_RATIO = 0.55
export const AXIS_NARROW_WIDTH = 420
export const AXIS_MEDIUM_WIDTH = 760
export const AXIS_TICK_LABEL_FONT_SIZE = 14
export const AXIS_NARROW_TICK_LABEL_FONT_SIZE = 11
/** Tick label line box, used to keep wrapped labels inside their row band. */
export const AXIS_TICK_LABEL_LINE_HEIGHT = 16
export const AXIS_WRAPPED_LABEL_ROWS = 2
export const AXIS_ROW_HEIGHT = 30
export const AXIS_WRAPPED_ROW_HEIGHT
  = AXIS_WRAPPED_LABEL_ROWS * AXIS_TICK_LABEL_LINE_HEIGHT + 10
/** Plot-width thresholds (chart width minus the label column) for x tick counts. */
export const AXIS_PLOT_TICK_THRESHOLDS: ReadonlyArray<readonly [number, number]> = [
  [175, 3],
  [330, 4],
  [640, 6]
]

export interface ChartAxisLayout {
  /** Max width of the y-axis model-name column, in px. */
  labelWidth: number
  /** Tick text font size, in px. */
  fontSize: number
  /** How many x-axis ticks the plot can show without colliding. */
  xTickBudget: number
  /** Per-model row height, in px: room for a wrapped label on small screens. */
  rowHeight: number
}

/** Per-breakpoint axis geometry for a measured container width. */
export function chartAxisLayout(containerWidth: number): ChartAxisLayout {
  const width = Number.isFinite(containerWidth) && containerWidth > 0 ? containerWidth : 0
  const narrow = width > 0 && width < AXIS_NARROW_WIDTH
  const labelWidth = Math.round(
    Math.min(AXIS_LABEL_MAX_WIDTH, Math.max(AXIS_LABEL_MIN_WIDTH, width * AXIS_LABEL_WIDTH_RATIO))
  )
  const fontSize = narrow ? AXIS_NARROW_TICK_LABEL_FONT_SIZE : AXIS_TICK_LABEL_FONT_SIZE
  const plotWidth = Math.max(0, width - labelWidth)
  const matched = AXIS_PLOT_TICK_THRESHOLDS.find(([limit]) => plotWidth < limit)
  const xTickBudget = matched ? matched[1] : 8
  return { labelWidth, fontSize, xTickBudget, rowHeight: narrow ? AXIS_WRAPPED_ROW_HEIGHT : AXIS_ROW_HEIGHT }
}

/** Evenly thins `ticks` to at most `maxCount`, always keeping the first and the last. */
export function thinTicks(ticks: number[], maxCount: number): number[] {
  const budget = Math.max(2, Math.floor(maxCount))
  if (!Number.isFinite(budget) || ticks.length <= budget) return [...ticks]
  const picked: number[] = []
  for (let i = 0; i < budget; i++) {
    const index = Math.round((i * (ticks.length - 1)) / (budget - 1))
    const tick = ticks[index]
    if (tick != null && !picked.includes(tick)) picked.push(tick)
  }
  return picked
}
