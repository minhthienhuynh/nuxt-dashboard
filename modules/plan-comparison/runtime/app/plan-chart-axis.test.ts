import { describe, expect, it } from 'vitest'
import {
  AXIS_LABEL_MAX_WIDTH,
  AXIS_LABEL_MIN_WIDTH,
  AXIS_ROW_HEIGHT,
  AXIS_TICK_LABEL_LINE_HEIGHT,
  AXIS_WRAPPED_ROW_HEIGHT,
  chartAxisLayout,
  thinTicks
} from './plan-chart-axis'

// Chart container widths measured in Chromium device emulation: the card is the
// page width minus 2 * 16px page padding.
const PHONE_PORTRAIT = 358
const SMALL_PHONE_PORTRAIT = 288
const TABLET_PORTRAIT = 778
const DESKTOP = 1150

describe('chartAxisLayout', () => {
  it('sizes phones so the longest model name still fits on one line', () => {
    const phone = chartAxisLayout(PHONE_PORTRAIT)
    // 197px column at 11px fits the widest live label (181px)
    expect(phone.labelWidth).toBe(197)
    expect(phone.fontSize).toBe(11)
    expect(phone.rowHeight).toBe(AXIS_WRAPPED_ROW_HEIGHT)
    expect(phone.xTickBudget).toBe(3)
  })

  it('gives the smaller phone 3 ticks and a narrower label column', () => {
    const small = chartAxisLayout(SMALL_PHONE_PORTRAIT)
    expect(small.labelWidth).toBe(158)
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
