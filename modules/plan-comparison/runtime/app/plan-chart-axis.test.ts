import { describe, expect, it } from 'vitest'
import {
  AXIS_LABEL_MAX_WIDTH,
  AXIS_LABEL_MIN_WIDTH,
  AXIS_ROW_HEIGHT,
  AXIS_TICK_LABEL_LINE_HEIGHT,
  AXIS_WRAPPED_ROW_HEIGHT,
  chartAxisLayout,
  estimateTextWidth,
  rowHeightForLabels,
  thinTicks,
  tickLabel
} from './plan-chart-axis'

// Chart container widths measured in Chromium device emulation: the card is the
// page width minus 2 * 16px page padding.
const PHONE_PORTRAIT = 358
const SMALL_PHONE_PORTRAIT = 288
const TABLET_PORTRAIT = 778
const DESKTOP = 1150

describe('chartAxisLayout', () => {
  it('gives phones a narrow label column; long names wrap to two lines', () => {
    const phone = chartAxisLayout(PHONE_PORTRAIT)
    // 38% of 358px: the widest live names wrap onto two 10px lines
    expect(phone.labelWidth).toBe(136)
    expect(phone.fontSize).toBe(11)
    expect(phone.rowHeight).toBe(AXIS_WRAPPED_ROW_HEIGHT)
    // Wider plot (358 - 136 = 222px) fits one more x tick than before
    expect(phone.xTickBudget).toBe(4)
  })

  it('clamps the smaller phone label column at the min width', () => {
    const small = chartAxisLayout(SMALL_PHONE_PORTRAIT)
    expect(small.labelWidth).toBe(132)
    expect(small.fontSize).toBe(11)
    expect(small.xTickBudget).toBe(3)
  })

  it('keeps the desktop geometry that already fit on one line', () => {
    const desktop = chartAxisLayout(DESKTOP)
    expect(desktop.labelWidth).toBe(AXIS_LABEL_MAX_WIDTH)
    expect(desktop.fontSize).toBe(14)
    expect(desktop.xTickBudget).toBe(8)
    expect(desktop.rowHeight).toBe(AXIS_ROW_HEIGHT)
  })

  it('counts x ticks from the plot width, not the container width', () => {
    // Tablet portrait: 778 - 280 = 498px plot → 6 ticks
    expect(chartAxisLayout(TABLET_PORTRAIT).xTickBudget).toBe(6)
    // Every layout must leave a plot at least 100px wide to draw into
    for (const width of [288, 320, 358, 390, 414, 480, 768, 1024, 1440]) {
      const { labelWidth } = chartAxisLayout(width)
      expect(width - labelWidth).toBeGreaterThanOrEqual(100)
    }
  })

  it('clamps the label column between the min and max widths', () => {
    expect(chartAxisLayout(0).labelWidth).toBe(AXIS_LABEL_MIN_WIDTH)
    expect(chartAxisLayout(100).labelWidth).toBe(AXIS_LABEL_MIN_WIDTH)
    expect(chartAxisLayout(4000).labelWidth).toBe(AXIS_LABEL_MAX_WIDTH)
    expect(chartAxisLayout(Number.NaN).labelWidth).toBe(AXIS_LABEL_MIN_WIDTH)
    expect(chartAxisLayout(-10).labelWidth).toBe(AXIS_LABEL_MIN_WIDTH)
  })

  it('sizes wrapped rows to fit two lines of tick text', () => {
    expect(AXIS_WRAPPED_ROW_HEIGHT).toBeGreaterThanOrEqual(2 * AXIS_TICK_LABEL_LINE_HEIGHT)
  })

  it('wraps labels only where the column is tight', () => {
    expect(chartAxisLayout(PHONE_PORTRAIT).wrapLabels).toBe(true)
    expect(chartAxisLayout(SMALL_PHONE_PORTRAIT).wrapLabels).toBe(true)
    expect(chartAxisLayout(DESKTOP).wrapLabels).toBe(false)
    // The wrap width has to leave room for the axis tick line inside the column
    expect(chartAxisLayout(PHONE_PORTRAIT).labelWrapWidth).toBeLessThan(chartAxisLayout(PHONE_PORTRAIT).labelWidth)
  })
})

describe('tickLabel', () => {
  const LONGEST = 'DeepSeek V4 Flash Vision (exp)'
  const SHORT = 'GLM-5.3 Flash'
  const WIDE_NAME = 'Muse Spark 1.3 Contributor Ultra'

  it('wraps long names onto two lines in the narrower phone column', () => {
    const phone = chartAxisLayout(PHONE_PORTRAIT)
    // 136 - 20 = 116px wrap width at 10px: the longest live names overflow one line
    expect(tickLabel(LONGEST, phone)).toBe('DeepSeek V4 Flash\nVision (exp)')
    expect(tickLabel('Muse Spark 1.3 Contributor', phone)).toBe('Muse Spark 1.3\nContributor')
    expect(tickLabel(SHORT, phone)).toBe(SHORT)
  })

  it('keeps the compact single-line label on wide screens', () => {
    expect(tickLabel(LONGEST, chartAxisLayout(DESKTOP))).toBe(LONGEST)
    expect(tickLabel(SHORT, chartAxisLayout(DESKTOP))).toBe(SHORT)
  })

  it('wraps to two lines, never three, when the name cannot fit the small-phone column', () => {
    const small = chartAxisLayout(SMALL_PHONE_PORTRAIT)
    const result = tickLabel(LONGEST, small)
    expect(result.split('\n').length).toBeLessThanOrEqual(2)
  })

  it('wraps a long name onto two lines at the base font size', () => {
    const phone = chartAxisLayout(PHONE_PORTRAIT)
    const result = tickLabel(WIDE_NAME, phone)
    const lines = result.split('\n')
    expect(lines.length).toBeLessThanOrEqual(2)
    // Wrapped, not shrunk: every line fits its column at the base (11px) size.
    for (const line of lines) {
      expect(estimateTextWidth(line, phone.fontSize)).toBeLessThanOrEqual(phone.labelWrapWidth)
    }
  })

  it('clamps overflow to two lines when even the smallest step cannot fit', () => {
    const tiny = { ...chartAxisLayout(SMALL_PHONE_PORTRAIT), labelWrapWidth: 40 }
    const result = tickLabel('Supercalifragilistic', tiny)
    expect(result.split('\n').length).toBeLessThanOrEqual(2)
  })

  it('truncates an over-wide final line with an ellipsis so it stays in the column', () => {
    const tiny = { ...chartAxisLayout(SMALL_PHONE_PORTRAIT), labelWrapWidth: 40 }
    const lines = tickLabel('Supercalifragilistic Extra Words Here', tiny).split('\n')
    expect(lines.length).toBeLessThanOrEqual(2)
    const last = lines[lines.length - 1]!
    expect(estimateTextWidth(last, tiny.fontSize)).toBeLessThanOrEqual(tiny.labelWrapWidth)
    expect(last.endsWith('…')).toBe(true)
  })

  it('leaves a single-word label untouched on wide screens', () => {
    expect(tickLabel('PlainModel', chartAxisLayout(DESKTOP))).toBe('PlainModel')
  })
})

describe('rowHeightForLabels', () => {
  it('keeps the base band when every label fits two lines', () => {
    const phone = chartAxisLayout(PHONE_PORTRAIT)
    const labels = ['Muse Spark 1.3 Contributor', 'GLM-5.3 Flash']
    expect(rowHeightForLabels(labels, phone)).toBe(AXIS_WRAPPED_ROW_HEIGHT)
  })

  it('grows the band for a two-line label on desktop instead of letting it collide', () => {
    const desktop = chartAxisLayout(DESKTOP)
    const labels = ['Muse Spark 1.3 Contributor Ultra\nSpeed Edition']
    expect(rowHeightForLabels(labels, desktop)).toBe(2 * AXIS_TICK_LABEL_LINE_HEIGHT + 10)
  })

  it('leaves the desktop band alone for single-line labels', () => {
    const desktop = chartAxisLayout(DESKTOP)
    expect(rowHeightForLabels(['Muse Spark 1.3 Contributor'], desktop)).toBe(AXIS_ROW_HEIGHT)
  })
})

describe('thinTicks', () => {
  const logTicks = [300, 1000, 3000, 10000, 30000, 100000, 300000]

  it('drops every other decade on narrow screens, keeping first and last', () => {
    expect(thinTicks(logTicks, 4)).toEqual([300, 3000, 30000, 300000])
    expect(thinTicks(logTicks, 3)).toEqual([300, 10000, 300000])
  })

  it('returns the ticks untouched when they already fit', () => {
    expect(thinTicks(logTicks, 8)).toEqual(logTicks)
    expect(thinTicks(logTicks, 7)).toEqual(logTicks)
    expect(thinTicks([], 4)).toEqual([])
  })

  it('clamps a degenerate budget to two ticks', () => {
    expect(thinTicks(logTicks, 1)).toEqual([300, 300000])
    expect(thinTicks(logTicks, 0)).toEqual([300, 300000])
  })
})
