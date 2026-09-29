import { describe, expect, it } from 'vitest'
import { isModelMarkerSlug, normalizeMarkerSlug, parseGoPlanLimits, parsePricingLimits, slugFromAnchor } from './ccpricing'

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

  it('splits several deal cards sharing one article at pick-from-model markers', () => {
    const html = `<div><a href="#minimax-m3-2x-usage">deal</a>
<p>No code, no toggle: pick MiniMax M3 from /model in the CLI</p>
<table><tr><th>Per 1M tokens</th><th>Was</th><th>Now</th></tr>
<tr><td>Input</td><td>$0.60</td><td>$0.30</td></tr>
<tr><td>Output</td><td>$2.40</td><td>$1.20</td></tr>
<tr><td>Cache read</td><td>$0.12</td><td>$0.06</td></tr></table>
<p>pick <code>mimo-v2.5-pro</code> from <code>/model</code> in the CLI</p>
<table><tr><th>Per 1M tokens</th><th>Was</th><th>Now</th></tr>
<tr><td>Input</td><td>$2.00</td><td>$0.435</td></tr></table>
<p>pick <code>mimo-v2.5</code> from <code>/model</code> in the CLI</p>
<table><tr><th>Per 1M tokens</th><th>Was</th><th>Now</th></tr>
<tr><td>Input</td><td>$0.80</td><td>$0.016</td></tr></table>
</div>`
    const sections = parsePricingLimits(html)
    expect(sections.find(s => s.slug === 'minimax-m3')?.rates.input).toBe(0.6)
    expect(sections.find(s => s.slug === 'mimo-v2-5-pro')?.rates.input).toBe(2)
    expect(sections.find(s => s.slug === 'mimo-v2-5')?.rates.input).toBe(0.8)
  })

  it('ignores generic prose markers instead of spawning junk sections', () => {
    const html = `<div><a href="#minimax-m3-2x-usage">deal</a>
<p>pick any model from /model in the CLI</p>
<table><tr><th>Per 1M tokens</th><th>Was</th><th>Now</th></tr>
<tr><td>Input</td><td>$0.60</td><td>$0.30</td></tr></table>
</div>`
    const sections = parsePricingLimits(html)
    expect(sections.find(s => s.slug === 'minimax-m3')?.rates.input).toBe(0.6)
    expect(sections.some(s => s.slug === 'any-model')).toBe(false)
  })

  it('ignores short marker slugs like the anchor guard does', () => {
    const html = `<div><a href="#minimax-m3-2x-usage">deal</a>
<p>pick Go from /model in the CLI</p>
<table><tr><th>Per 1M tokens</th><th>Was</th><th>Now</th></tr>
<tr><td>Input</td><td>$0.60</td><td>$0.30</td></tr></table>
</div>`
    const sections = parsePricingLimits(html)
    expect(sections.find(s => s.slug === 'minimax-m3')?.rates.input).toBe(0.6)
    expect(sections.some(s => s.slug === 'go')).toBe(false)
  })

  it('matches markers spanning line breaks', () => {
    const html = `<div><a href="#minimax-m3-2x-usage">deal</a>
<p>pick MiniMax M3
from /model in the CLI</p>
<table><tr><th>Per 1M tokens</th><th>Was</th><th>Now</th></tr>
<tr><td>Input</td><td>$0.60</td><td>$0.30</td></tr></table>
</div>`
    const sections = parsePricingLimits(html)
    expect(sections.find(s => s.slug === 'minimax-m3')?.rates.input).toBe(0.6)
  })

  it('isModelMarkerSlug accepts versioned models and rejects prose', () => {
    expect(isModelMarkerSlug('minimax-m3')).toBe(true)
    expect(isModelMarkerSlug('mimo-v2-5-pro')).toBe(true)
    expect(isModelMarkerSlug('any-model')).toBe(false)
    expect(isModelMarkerSlug('go')).toBe(false)
  })

  it('normalizes marker slugs with the same suffix stripping as anchors', () => {
    expect(normalizeMarkerSlug('MiniMax M3')).toBe('minimax-m3')
    expect(normalizeMarkerSlug('<code>mimo-v2.5-pro</code>')).toBe('mimo-v2-5-pro')
    expect(normalizeMarkerSlug('MiniMax M3 2x usage')).toBe('minimax-m3')
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
