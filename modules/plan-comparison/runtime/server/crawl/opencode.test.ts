import { describe, expect, it } from 'vitest'
import { mapOpenCodeModels, normalizeName, parseOpenCodeEndpoints, parseOpenCodeEstimates, parseOpenCodePricing } from './opencode'

const pricingTable = `<table><tr><th>Model</th><th>Input</th><th>Output</th><th>Cached Read</th><th>Cached Write</th><th>Monthly limit</th></tr>
<tr><td>GLM-5.3-Flash</td><td>$0.15</td><td>$0.50</td><td>$0.03</td><td>-</td><td>$60</td></tr></table>`

const estimatesTable = `<table><tr><th>Model</th><th>requests per 5 hour</th><th>requests per week</th><th>requests per month</th></tr>
<tr><td>GLM-5.3-Flash</td><td>6,320</td><td>15,790</td><td>31,580</td></tr></table>`

const endpointsTable = `<table><tr><th>Model</th><th>Model ID</th><th>Endpoint</th><th>AI SDK Package</th></tr>
<tr><td>Grok 4.6</td><td>grok-4.6</td><td>https://opencode.ai/zen/go/v1/responses</td><td>@ai-sdk/openai</td></tr></table>`

const pageHtml = `<main>${pricingTable}${estimatesTable}${endpointsTable}</main>`

describe('parseOpenCodePricing', () => {
  it('parses money columns with dash as null', () => {
    const rows = parseOpenCodePricing(pageHtml)
    expect(rows).toEqual([{
      name: 'GLM-5.3-Flash', tier: 'standard', input: 0.15, output: 0.5, cacheRead: 0.03, cacheWrite: null, monthlyLimit: 60
    }])
  })

  it('reads the current value through deal markup, not the struck-through base', () => {
    const html = `<table><tr><th>Model</th><th>Input</th><th>Output</th><th>Cached Read</th><th>Cached Write</th><th>Monthly limit</th></tr>
      <tr><td>DeepSeek V4.1 Flash (Off-Peak)</td><td>$0.15</td><td>$0.60</td><td>$0.003</td><td>-</td><td><del>$15</del> <strong>$60</strong><br><small>4x · Ends Sep 20</small></td></tr>
      <tr><td>DeepSeek V4.1 Flash (Peak)</td><td>$0.30</td><td>$1.20</td><td>$0.006</td><td>-</td><td><del>$15</del> <strong>$60</strong></td></tr></table>`
    const rows = parseOpenCodePricing(html)
    expect(rows).toEqual([
      { name: 'DeepSeek V4.1 Flash (Off-Peak)', tier: 'off_peak', input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: null, monthlyLimit: 60 },
      { name: 'DeepSeek V4.1 Flash (Peak)', tier: 'peak', input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: null, monthlyLimit: 60 }
    ])
  })
})

describe('parseOpenCodeEstimates', () => {
  it('parses thousands separators', () => {
    expect(parseOpenCodeEstimates(pageHtml)).toEqual([
      { name: 'GLM-5.3-Flash', per5h: 6320, perWeek: 15790, perMonth: 31580 }
    ])
  })

  it('reads boosted deal values with clean model names', () => {
    const html = `<table><tr><th>Model</th><th>requests per 5 hour</th><th>requests per week</th><th>requests per month</th></tr>
      <tr><td>DeepSeek V4.1 Flash<br><small>4x · Ends Sep 20</small></td><td><del>6,500</del><br><strong>26,000</strong></td><td><del>16,250</del><br><strong>65,000</strong></td><td><del>32,500</del><br><strong>130,000</strong></td></tr></table>`
    expect(parseOpenCodeEstimates(html)).toEqual([
      { name: 'DeepSeek V4.1 Flash', per5h: 26000, perWeek: 65000, perMonth: 130000 }
    ])
  })
})

describe('parseOpenCodeEndpoints', () => {
  it('extracts model ids', () => {
    expect(parseOpenCodeEndpoints(pageHtml)).toEqual([{ name: 'Grok 4.6', modelId: 'grok-4.6' }])
  })
})

describe('normalizeName', () => {
  it('ignores case and punctuation', () => {
    expect(normalizeName('GLM-5.3-Flash')).toBe(normalizeName('glm 5.3 flash'))
  })
})

describe('mapOpenCodeModels', () => {
  it('maps rows into CMD shape with null for HTML-missing fields', () => {
    const models = mapOpenCodeModels(pageHtml)
    const glm = models.find(m => m.name === 'GLM-5.3-Flash')
    expect(glm?.contextWindow).toBeNull()
    expect(glm?.inputCost).toBe(0.15)
    expect(glm?.tiers).toEqual([])
    const grok = models.find(m => m.name === 'Grok 4.6')
    expect(grok?.id).toBe('grok-4.6')
    expect(grok?.inputCost).toBeNull()
  })
})
