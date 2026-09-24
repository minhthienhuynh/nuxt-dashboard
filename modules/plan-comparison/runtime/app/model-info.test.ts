import { describe, expect, it } from 'vitest'
import { formatDate, formatScore, formatTokenCount, fundingFields, fundingWithPlans, modelInfoFields, normalizeLabelText, rowFromClickDatum, rowFromEventTarget } from './model-info'
import { PLAN_COMPARISON_PLANS } from './plan-colors'
import type { EnrichedModelRow } from './composables/usePlanComparisonDatabase'
import type { Model, PricingEntry } from './types'

function makeModel(overrides: Partial<Model> = {}): Model {
  return {
    id: 'vendor/model',
    slug: 'model',
    name: 'Model A',
    vendor: 'Vendor',
    category: null,
    contextWindow: null,
    reasoning: null,
    vision: null,
    inputCost: null,
    outputCost: null,
    cacheReadCost: null,
    cacheWriteCost: null,
    tiers: [],
    minPlanName: null,
    deal: null,
    caps: {},
    intelligenceIndex: null,
    codingIndex: null,
    outputTokensPerSec: null,
    releaseDate: null,
    launchedAt: null,
    timeOfDay: null,
    ...overrides
  }
}

function makePricing(overrides: Partial<PricingEntry> = {}): PricingEntry {
  return {
    provider_id: 'command-code',
    model_id: 'vendor/model',
    tier: 'standard',
    peak_utc_hours: null,
    input: 2,
    output: 6,
    cache_read: 0.25,
    cache_write: null,
    ...overrides
  }
}

function makeRow(name: string, overrides: Partial<EnrichedModelRow> = {}): EnrichedModelRow {
  const model = overrides.model ?? makeModel({ name })
  return {
    model,
    // Production labels are plain model names (labelFor); wrapped ticks use
    // `\n` line breaks, never an intel suffix.
    label: name,
    pricing: null,
    release: null,
    name,
    context: null,
    intelligence: null,
    speed: null,
    inputPrice: null,
    cmd: { credit: null, request: null },
    goat: { credit: null, request: null },
    go: { credit: null, request: null },
    ...overrides
  }
}

describe('formatTokenCount', () => {
  it('formats millions and thousands with 3 significant digits', () => {
    expect(formatTokenCount(1_000_000)).toBe('1M')
    expect(formatTokenCount(200_000)).toBe('200K')
    expect(formatTokenCount(128_000)).toBe('128K')
    expect(formatTokenCount(1_048_576)).toBe('1.05M')
    expect(formatTokenCount(32_768)).toBe('32.8K')
    expect(formatTokenCount(512)).toBe('512')
  })
})

describe('formatScore', () => {
  it('keeps finite precision', () => {
    expect(formatScore(58.68)).toBe('58.68')
    expect(formatScore(46)).toBe('46')
    expect(formatScore(0.003625)).toBe('0.003625')
  })

  it('cleans IEEE-754 float artifacts to 2 decimals', () => {
    expect(formatScore(3.5999999999999996)).toBe('3.6')
    expect(formatScore(0.15000000000000002)).toBe('0.15')
    expect(formatScore(49.99999999999999)).toBe('50')
  })
})

describe('formatDate', () => {
  it('renders date-only ISO strings as short month-name dates', () => {
    expect(formatDate('2026-08-05')).toBe('Aug 5, 2026')
  })

  it('does not shift the day across UTC boundaries', () => {
    // UTC midnight must stay on the same calendar day regardless of local timezone.
    expect(formatDate('2026-08-01')).toBe('Aug 1, 2026')
    expect(formatDate('2027-01-01')).toBe('Jan 1, 2027')
  })

  it('falls back to the raw string when unparseable', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })
})

describe('modelInfoFields', () => {
  it('lists every populated field in display order', () => {
    const model = makeModel({
      vendor: 'Qwen',
      contextWindow: 1_000_000,
      intelligenceIndex: 58.68,
      codingIndex: 70.2,
      outputTokensPerSec: 160,
      caps: { text: true, vision: true, reasoning: true },
      category: 'frontier',
      releaseDate: '2026-09-02',
      launchedAt: '2026-09-03',
      minPlanName: 'Goat',
      deal: { free: false, expires: '2026-10-01' }
    })
    const fields = modelInfoFields(model, makePricing({ cache_write: 2.5 }))
    expect(fields.map(field => field.label)).toEqual([
      'Vendor',
      'Context',
      'Intelligence',
      'Coding index',
      'Output speed',
      'Category',
      'Input price',
      'Output price',
      'Cache read',
      'Cache write',
      'Caps',
      'Released',
      'On Command Code',
      'Min plan',
      'Deal'
    ])
    expect(Object.fromEntries(fields.map(field => [field.label, field.value]))).toEqual({
      'Vendor': 'Qwen',
      'Context': '1M tokens',
      'Intelligence': '58.68',
      'Coding index': '70.2',
      'Output speed': '160 tok/s',
      'Category': 'frontier',
      'Input price': '$2/1M tokens',
      'Output price': '$6/1M tokens',
      'Cache read': '$0.25/1M tokens',
      'Cache write': '$2.5/1M tokens',
      'Caps': 'Text, Vision, Reasoning',
      'Released': 'Sep 2, 2026',
      'On Command Code': 'Sep 3, 2026',
      'Min plan': 'Cmd GOAT',
      'Deal': 'On sale until Oct 1, 2026'
    })
  })

  it('skips fields the crawl has no value for', () => {
    // OpenCode-only rows arrive metadata-null: with no confirmed capability
    // the Caps field is skipped too, instead of asserting "Text".
    const fields = modelInfoFields(makeModel({ vendor: null, caps: {} }), null)
    expect(fields).toEqual([])
  })

  it('lists only confirmed capabilities', () => {
    const fields = modelInfoFields(makeModel({ caps: { text: true, vision: true } }), null)
    expect(fields.find(field => field.label === 'Caps')?.value).toBe('Text, Vision')
  })

  it('hides $0 rates and free deals', () => {
    const pricing = makePricing({ input: 2, output: 0, cache_read: 0, cache_write: 0 })
    const model = makeModel({ deal: { free: true } })
    const fields = modelInfoFields(model, pricing)
    expect(fields.filter(field => field.label.endsWith('price') || field.label.startsWith('Cache')).map(field => field.label))
      .toEqual(['Input price'])
    expect(fields.find(field => field.label === 'Deal')?.value).toBe('Free (for now)')
  })

  it('falls back to On sale when a deal has no expiry', () => {
    const model = makeModel({ deal: { free: false, expires: null } })
    const fields = modelInfoFields(model, makePricing())
    expect(fields.find(field => field.label === 'Deal')?.value).toBe('On sale')
  })

  it('cleans float artifacts in prices but keeps precise small values', () => {
    const artifact = modelInfoFields(makeModel(), makePricing({ output: 3.5999999999999996 }))
    expect(artifact.find(field => field.label === 'Output price')?.value).toBe('$3.6/1M tokens')

    const precise = modelInfoFields(makeModel(), makePricing({ cache_read: 0.003625 }))
    expect(precise.find(field => field.label === 'Cache read')?.value).toBe('$0.003625/1M tokens')
  })
})

describe('fundingFields', () => {
  it('lists every plan in registry order with credit and request counts', () => {
    const row = makeRow('Alpha', {
      cmd: { credit: 100, request: 2500 },
      goat: { credit: 200, request: 5000 },
      go: { credit: 50, request: 1000 }
    })
    expect(fundingFields(row)).toEqual([
      { label: 'Cmd Go', value: '$100 credit · 2,500 req/mo' },
      { label: 'Cmd GOAT', value: '$200 credit · 5,000 req/mo' },
      { label: 'OpenCode Go', value: '$50 credit · 1,000 req/mo' }
    ])
  })

  it('dashes an unpublished request count', () => {
    const row = makeRow('Alpha', { cmd: { credit: 100, request: null } })
    expect(fundingFields(row)[0]).toEqual({ label: 'Cmd Go', value: '$100 credit · — req/mo' })
  })

  it('cleans float artifacts in credit', () => {
    const row = makeRow('Alpha', { cmd: { credit: 49.99999999999999, request: 100 } })
    expect(fundingFields(row)[0]).toEqual({ label: 'Cmd Go', value: '$50 credit · 100 req/mo' })
  })

  it('dashes the whole row when a plan grants no credit', () => {
    const row = makeRow('Alpha', { go: { credit: null, request: 1000 } })
    expect(fundingFields(row)[2]).toEqual({ label: 'OpenCode Go', value: '—' })
  })

  it('dashes every row for an unfunded model', () => {
    expect(fundingFields(makeRow('Alpha')).every(field => field.value === '—')).toBe(true)
  })
})

describe('fundingWithPlans', () => {
  it('joins each funding row to its plan meta by label, not position', () => {
    const row = makeRow('Alpha', {
      cmd: { credit: 100, request: 2500 },
      goat: { credit: 200, request: 5000 },
      go: { credit: 50, request: 1000 }
    })
    const fields = fundingWithPlans(row)
    expect(fields.map(field => [field.plan.key, field.label, field.value])).toEqual([
      ['cmd', 'Cmd Go', '$100 credit · 2,500 req/mo'],
      ['goat', 'Cmd GOAT', '$200 credit · 5,000 req/mo'],
      ['go', 'OpenCode Go', '$50 credit · 1,000 req/mo']
    ])
    expect(fields.map(field => field.plan)).toEqual(PLAN_COMPARISON_PLANS)
  })
})

describe('rowFromClickDatum', () => {
  const rows = [makeRow('Alpha'), makeRow('Beta'), makeRow('Gamma')]
  const tickLabels = ['Alpha', 'Beta', 'Gamma']

  it('resolves a y-axis tick datum, tolerating wrapped tick text', () => {
    expect(rowFromClickDatum(rows, tickLabels, 1, 'Beta')?.name).toBe('Beta')
  })

  it('resolves a two-line wrapped tick against the plain label', () => {
    const wrapped = [makeRow('Alpha'), makeRow('DeepSeek V4 Flash')]
    const labels = ['Alpha', 'DeepSeek V4\nFlash']
    // SVG drops the `\n` when concatenating tspans.
    expect(rowFromClickDatum(wrapped, labels, 1, 'DeepSeek V4Flash')?.name).toBe('DeepSeek V4 Flash')
  })

  it('rejects a numeric datum whose text is not a model label (x-axis ticks)', () => {
    expect(rowFromClickDatum(rows, tickLabels, 1, '1.000')).toBeNull()
    expect(rowFromClickDatum(rows, tickLabels, 1, null)).toBeNull()
    expect(rowFromClickDatum(rows, tickLabels, 42, 'Alpha')).toBeNull()
  })

  it('resolves a request-dot datum through rowIndex', () => {
    // True DotPoint shape: no label/planLabel fields.
    const dot = { rowIndex: 2, request: 100, credit: 20, planColor: '#000' }
    expect(rowFromClickDatum(rows, tickLabels, dot, null)?.name).toBe('Gamma')
  })

  it('resolves a credit-bar datum (the row itself)', () => {
    expect(rowFromClickDatum(rows, tickLabels, rows[0], null)?.name).toBe('Alpha')
  })

  it('returns null for clicks with no row datum', () => {
    expect(rowFromClickDatum(rows, tickLabels, undefined, null)).toBeNull()
    expect(rowFromClickDatum(rows, tickLabels, { some: 'thing' }, null)).toBeNull()
  })
})

describe('normalizeLabelText', () => {
  it('ignores whitespace differences from SVG tspan concatenation', () => {
    expect(normalizeLabelText('Beta\n(—)')).toBe(normalizeLabelText('Beta (—)'))
  })
})

describe('rowFromEventTarget', () => {
  const rows = [makeRow('Alpha'), makeRow('Beta')]
  const tickLabels = ['Alpha', 'Beta']

  // Minimal DOM-ish chain: each node exposes closest(), parentElement and an
  // optional d3-bound `__data__` — enough for the datum walk without a DOM.
  // `contains` walks the other's ancestor chain, like the real DOM API.
  function node(opts: {
    data?: unknown
    parent?: ReturnType<typeof node> | null
    tickText?: string | null
  }): Element {
    const self = {
      __data__: opts.data,
      parentElement: opts.parent ?? null,
      closest(selector: string) {
        if ((selector === 'text' || selector === 'g.tick') && opts.tickText != null && self.__data__ !== undefined) {
          return { textContent: opts.tickText }
        }
        return self.parentElement?.closest(selector) ?? null
      },
      contains(other: unknown) {
        let el = other as { parentElement?: unknown } | null
        while (el) {
          if (el === self) return true
          const parent = (el as { parentElement?: unknown })?.parentElement
          el = (parent ?? null) as { parentElement?: unknown } | null
        }
        return false
      }
    }
    return self as unknown as Element
  }

  it('resolves a row through the datum walk', () => {
    const container = node({ parent: null })
    const bar = node({ data: rows[0], parent: container })
    expect(rowFromEventTarget(rows, tickLabels, container, bar)?.name).toBe('Alpha')
  })

  it('resolves a tick datum only when the tick text matches the row label', () => {
    const container = node({ parent: null })
    const tick = node({ data: 1, parent: container, tickText: 'Beta' })
    expect(rowFromEventTarget(rows, tickLabels, container, tick)?.name).toBe('Beta')
    const xAxisTick = node({ data: 1, parent: container, tickText: '500' })
    expect(rowFromEventTarget(rows, tickLabels, container, xAxisTick)).toBeNull()
  })

  it('ignores a datum bound outside the container', () => {
    const container = node({ parent: null })
    const outsider = node({ data: rows[0], parent: null })
    expect(rowFromEventTarget(rows, tickLabels, container, outsider)).toBeNull()
  })

  it('returns null outside the container or without a datum', () => {
    const container = node({ parent: null })
    expect(rowFromEventTarget(rows, tickLabels, container, node({ parent: null }))).toBeNull()
    expect(rowFromEventTarget(rows, tickLabels, container, null)).toBeNull()
    expect(rowFromEventTarget(rows, tickLabels, null, node({ data: rows[0] }))).toBeNull()
  })
})
