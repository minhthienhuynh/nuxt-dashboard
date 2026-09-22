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
/**
 * Unovis sizes tick text with `len * fontSize * 0.5` (its default font
 * width/height ratio). Measured against the live chart this matches Inter 500
 * within ~3% ("DeepSeek V4 Flash Vision (exp) (35)" is 230.9px at 14px; the
 * metric says 231px), so our own line breaks stay inside the label column.
 */
export const AXIS_FONT_WIDTH_TO_HEIGHT_RATIO = 0.5
/** Axis tick size plus breathing room, i.e. what the label column does not get. */
export const AXIS_LABEL_COLUMN_PADDING = 20
/**
 * Unovis only breaks tick text at these separators, plus hard `\n` breaks. We
 * supply our own line breaks (score on its own line), so the separator is set to
 * a character that cannot appear in a label: it makes `\n` the only break and
 * stops Unovis from re-wrapping (and shrinking) the lines we chose.
 */
export const AXIS_TICK_SEPARATOR: string[] = ['\u0000']
/** Plot-width thresholds (chart width minus the label column) for x tick counts. */
export const AXIS_PLOT_TICK_THRESHOLDS: ReadonlyArray<readonly [number, number]> = [
  [175, 3],
  [330, 4],
  [640, 6]
]

export interface ChartAxisLayout {
  /** Max width of the y-axis model-name column, in px. */
  labelWidth: number
  /** Usable text width inside the label column, in px. */
  labelWrapWidth: number
  /** Tick text font size, in px. */
  fontSize: number
  /** Tick label line box, in px. */
  lineHeight: number
  /** Whether the intel score goes on its own (second) line. */
  stackScore: boolean
  /** How many x-axis ticks the plot can show without colliding. */
  xTickBudget: number
  /** Base per-model row height, in px. */
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
  return {
    labelWidth,
    labelWrapWidth: Math.max(0, labelWidth - AXIS_LABEL_COLUMN_PADDING),
    fontSize,
    lineHeight: AXIS_TICK_LABEL_LINE_HEIGHT,
    stackScore: narrow,
    xTickBudget,
    rowHeight: narrow ? AXIS_WRAPPED_ROW_HEIGHT : AXIS_ROW_HEIGHT
  }
}

/** Width Unovis assumes for `text` at `fontSize`, in px. */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * AXIS_FONT_WIDTH_TO_HEIGHT_RATIO
}

/**
 * Splits a chart label (`"DeepSeek V4 Flash (34.5)"`) into its model name and
 * the trailing intel score. Labels without a score keep `score === null`, so
 * the score line never shows up empty.
 */
export function splitLabel(label: string): { name: string, score: string | null } {
  const trimmed = label.trim()
  const match = /^(.*\S)\s+(\([^)]*\))$/.exec(trimmed)
  if (!match) return { name: trimmed, score: null }
  return { name: match[1] ?? trimmed, score: match[2] ?? null }
}

/** Greedy word wrap, with a character break for a word that cannot fit alone. */
export function wrapText(text: string, maxWidthPx: number, fontSize: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return []
  if (!(maxWidthPx > 0)) return [words.join(' ')]
  const lines: string[] = []
  let line = ''
  const fits = (candidate: string) => estimateTextWidth(candidate, fontSize) <= maxWidthPx
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (fits(candidate) || !line) {
      if (fits(candidate)) {
        line = candidate
        continue
      }
      // Single word wider than the column: hard-break it so it cannot overflow.
      let head = line
      for (const char of word) {
        if (head && !fits(head + char)) {
          lines.push(head)
          head = char
        } else {
          head += char
        }
      }
      line = head
      continue
    }
    lines.push(line)
    line = word
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Two-line tick label: model name on the first line, intel score on the second.
 * Wide screens keep the compact single-line form, which is what the tables and
 * tooltips show as well.
 */
export function tickLabel(label: string, layout: ChartAxisLayout): string {
  if (!layout.stackScore) return label
  const { name, score } = splitLabel(label)
  const lines = wrapText(name, layout.labelWrapWidth, layout.fontSize)
  if (score) lines.push(score)
  return lines.length ? lines.join('\n') : label
}

/**
 * Row band that fits the tallest label: extra name lines grow the band instead
 * of running over the neighbouring row.
 */
export function rowHeightForLabels(labels: string[], layout: ChartAxisLayout): number {
  const maxLines = labels.reduce((max, label) => Math.max(max, label.split('\n').length), 1)
  return Math.max(layout.rowHeight, maxLines * layout.lineHeight + 10)
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
