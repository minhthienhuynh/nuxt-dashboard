import { describe, expect, it } from 'vitest'
import { parseGoPlanLimits, parsePricingLimits, slugFromAnchor } from './ccpricing'

const sectionHtml = `
<div><a href="#minimax-m3-2x-usage">deal</a>
<p>Model MiniMax M3 Discount 50%</p>
<table><tr><th>Per 1M tokens (context)</th><th>Was</th><th>Now</th><th>Off</th></tr>
<tr><td>Input</td><td>$0.60</td><td>$0.30</td><td>50%</td></tr>
<tr><td>Output</td><td>$2.40</td><td>$1.20</td><td>50%</td></tr>
<tr><td>Cache read</td><td>$0.12</td><td>$0.06</td><td>50%</td></tr></table>
<a href="#other-model-deal">deal</a>
<table><tr><th>Per 1M tokens</th><th>Price</th></tr>
<tr><td>Input</td><td>$0.00</td></tr></table>
</div>`

describe('slugFromAnchor', () => {
  it('strips deal/usage suffixes', () => {
    expect(slugFromAnchor('#minimax-m3-2x-usage')).toBe('minimax-m3')
    expect(slugFromAnchor('#qwen-deal')).toBe('qwen')
    expect(slugFromAnchor('#models-included')).toBe('models-included')
  })

  it('rejects non-anchors', () => {
    expect(slugFromAnchor('/docs/go')).toBeNull()
  })
})

describe('parsePricingLimits', () => {
  it('extracts Was list prices keyed by slug', () => {
    const sections = parsePricingLimits(sectionHtml)
    const m3 = sections.find(s => s.slug === 'minimax-m3')
    expect(m3?.rates).toEqual({ input: 0.6, output: 2.4, cacheRead: 0.12, cacheWrite: null })
  })

  it('skips tables without Was column structure', () => {
    const sections = parsePricingLimits(sectionHtml)
    expect(sections.some(s => s.slug === 'other-model')).toBe(false)
  })
})

describe('parseGoPlanLimits', () => {
  it('extracts the Go plan row', () => {
    const html = `<table><tr><th>Plan</th><th>Price/mo</th><th>Credits/mo</th></tr>
      <tr><td>Go Plan</td><td>$1</td><td>$10</td></tr>
      <tr><td>GOAT Plan</td><td>$10</td><td>$70</td></tr></table>`
    expect(parseGoPlanLimits(html)).toEqual({ priceUsd: 1, creditsUsd: 10 })
  })

  it('returns null without a plan table', () => {
    expect(parseGoPlanLimits('<p>no tables</p>')).toBeNull()
  })
})
