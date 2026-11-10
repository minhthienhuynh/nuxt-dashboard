import { describe, expect, it } from 'vitest'
import { designCreditBaseline, parseOpenDesignAllowances, parseOpenDesignModels, parseOpenDesignMultipliers, parseOpenDesignUsage, parsePlanAccess } from './opendesign'

// Trimmed copy of go.open-design.ai: the pricing page embeds the plan table as
// a JSON settings block, the models index carries one catalog card (vendor +
// plan access) and one explorer panel (API id + input-length tiers) per model.
const allowancesHtml = `<table>
  <tr><th>Plan</th><th>Regular monthly price</th><th>Monthly maximum =</th><th>Plan model credits<br><small>No 7-day or 5-hour limits</small></th><th>+</th><th>Coding Plan</th></tr>
  <tr><th>Monthly maximum</th><th>Maximum credits per 7-day window</th><th>Maximum credits per 5-hour window</th></tr>
  <tr><td>Go</td><td>$10</td><td>$220</td><td>$0</td><td></td><td>$220</td><td>$55</td><td>$18</td></tr>
  <tr><td>Go-Plus</td><td>$20</td><td>$310</td><td>$20</td><td></td><td>$290 Bonus</td><td>$74</td><td>No limit window</td></tr>
</table>`

const modelsHtml = `<main>
  <a class="catalog-card" href="/models/gpt-6-luna/"><span class="model-tag">OpenAI</span><h2>GPT-6 Luna</h2>
    <p class="catalog-card-foot"><span>Go / Plus / Pro / Max</span><span class="catalog-card-more">View details</span></p></a>
  <a class="catalog-card" href="/models/claude-opus-5-5/"><span class="model-tag">Anthropic</span><h2>Claude Opus 5.5</h2>
    <p class="catalog-card-foot"><span>Pro / Max</span><span class="catalog-card-more">View details</span></p></a>
  <div class="model-explorer-panel" id="model-panel-gpt-6-luna" data-model-panel="gpt-6-luna">
    <header class="model-explorer-heading"><h3>GPT-6 Luna</h3></header>
    <div class="model-explorer-pricing">
      <div class="model-explorer-tier"><h4>Up to 272,000 tokens</h4><dl class="model-explorer-metrics">
        <div><dt>Input / 1M tokens</dt><dd>$0.1</dd></div>
        <div><dt>Output / 1M tokens</dt><dd>$0.5</dd></div>
        <div><dt>Cache read / 1M tokens</dt><dd>$0.01</dd></div>
        <div><dt>Cache write / 1M tokens</dt><dd>$0.125</dd></div>
      </dl></div>
      <div class="model-explorer-tier"><h4>Over 272,000 tokens</h4><dl class="model-explorer-metrics">
        <div><dt>Input / 1M tokens</dt><dd>$0.2</dd></div>
        <div><dt>Output / 1M tokens</dt><dd>$0.75</dd></div>
        <div><dt>Cache read / 1M tokens</dt><dd>$0.02</dd></div>
        <div><dt>Cache write / 1M tokens</dt><dd>$0.25</dd></div>
      </dl></div>
    </div>
  </div>
  <div class="model-explorer-panel" id="model-panel-claude-opus-5-5" data-model-panel="claude-opus-5.5">
    <header class="model-explorer-heading"><h3>Claude Opus 5.5</h3></header>
    <div class="model-explorer-pricing">
      <div class="model-explorer-tier"><h4>No input-length tiers</h4><dl class="model-explorer-metrics">
        <div><dt>Input / 1M tokens</dt><dd>$4</dd></div>
        <div><dt>Output / 1M tokens</dt><dd>$20</dd></div>
        <div><dt>Cache read / 1M tokens</dt><dd>$0.4</dd></div>
        <div><dt>Cache write / 1M tokens</dt><dd aria-label="No separate price listed in the workspace">—</dd></div>
      </dl></div>
    </div>
  </div>
</main>`

describe('parseOpenDesignAllowances', () => {
  it('reads coding credits and both rolling windows per plan', () => {
    expect(parseOpenDesignAllowances(allowancesHtml)).toEqual([
      { name: 'Go', monthly: 10, codingCredits: 220, weeklyWindow: 55, fiveHourWindow: 18 },
      // "No limit window" is the page's way of publishing no 5-hour cap.
      { name: 'Go-Plus', monthly: 20, codingCredits: 290, weeklyWindow: 74, fiveHourWindow: null }
    ])
  })

  it('returns nothing when the table is absent', () => {
    expect(parseOpenDesignAllowances('<html><body>no table</body></html>')).toEqual([])
  })
})

const multipliersHtml = `<table>
  <tr><th>Model</th><th>Credit multiplier</th></tr>
  <tr><th scope="row">DeepSeek V4.1 Flash Off-peak promo</th><td><span class="multiplier-value">0.25×</span></td></tr>
  <tr><th scope="row">DeepSeek V4.1 Flash</th><td><span class="multiplier-value">0.5×</span></td></tr>
  <tr data-eco-multiplier-row><th scope="row">DeepSeek V4.1 Flash Eco</th><td><span class="multiplier-value" data-go-rate="0.27×" data-plus-rate="0.27×">0.27×</span></td></tr>
  <tr><th scope="row">GPT-6 Luna</th><td><span class="multiplier-value">4×</span></td></tr>
  <tr><th scope="row">MiMo V2.6 Flash</th><td><span class="multiplier-value">1×</span></td></tr>
</table>`

// Trimmed copy of the pricing page's "Coding Plan usage" table: div rows, the
// first number cell per plan (Go/Plus/Pro/Max) for requests, the second for the
// normalised usage values. The campaign row quotes a weekly figure.
const usageHtml = `<div class="dpu-row" role="row">
  <span class="dpu-model" role="cell"><strong>GPT-6 Luna</strong></span>
  <span class="dpu-number" role="cell"><span data-usage-value="go">12,100</span><span data-usage-value="plus">16,100</span></span>
  <span class="dpu-number" role="cell"><span data-usage-value="go">$15</span><span data-usage-value="plus">$20</span></span>
</div>
<div class="dpu-row" role="row">
  <span class="dpu-model" role="cell"><strong>DeepSeek V4.1 Flash Eco</strong></span>
  <span class="dpu-number" role="cell"><span data-usage-value="go">266,933</span><span data-usage-value="plus">359,270</span></span>
  <span class="dpu-number" role="cell"><span data-usage-value="go">$220</span><span data-usage-value="plus">$290</span></span>
</div>
<div class="dpu-row" role="row">
  <span class="dpu-model" role="cell"><strong>DeepSeek V4.1 Flash Off-peak promo</strong></span>
  <span class="dpu-number" role="cell"><span data-usage-value="go">291,200</span></span>
  <span class="dpu-number" role="cell"><span data-usage-value="go">$60 / week</span></span>
</div>`

describe('parseOpenDesignUsage', () => {
  it('reads the Go request estimate per model and skips the campaign row', () => {
    expect(parseOpenDesignUsage(usageHtml)).toEqual([
      { name: 'GPT-6 Luna', requestsPerWeek: 12100, monthlyUsageUsd: 15 },
      { name: 'DeepSeek V4.1 Flash Eco', requestsPerWeek: 266933, monthlyUsageUsd: 220 }
    ])
  })

  it('returns nothing on a page without the usage table', () => {
    expect(parseOpenDesignUsage('<main><p>no table</p></main>')).toEqual([])
  })
})

describe('parseOpenDesignMultipliers', () => {
  it('reads each model multiplier, preferring the Go rate', () => {
    expect(parseOpenDesignMultipliers(multipliersHtml)).toEqual([
      { name: 'DeepSeek V4.1 Flash', multiplier: 0.5 },
      { name: 'DeepSeek V4.1 Flash Eco', multiplier: 0.27 },
      { name: 'GPT-6 Luna', multiplier: 4 },
      { name: 'MiMo V2.6 Flash', multiplier: 1 }
    ])
  })

  it('drops promo rows: the dataset never bakes a promo', () => {
    expect(parseOpenDesignMultipliers(multipliersHtml).some(row => /promo/i.test(row.name))).toBe(false)
  })

  it('returns nothing without the multiplier table', () => {
    expect(parseOpenDesignMultipliers('<html><body>nope</body></html>')).toEqual([])
  })
})

describe('parsePlanAccess', () => {
  it('normalizes the slash-separated plan list', () => {
    expect(parsePlanAccess('Go / Plus / Pro / Max')).toEqual(['go', 'plus', 'pro', 'max'])
    expect(parsePlanAccess('Pro / Max')).toEqual(['pro', 'max'])
    expect(parsePlanAccess('')).toEqual([])
  })
})

describe('parseOpenDesignModels', () => {
  const models = parseOpenDesignModels(modelsHtml)

  it('joins the catalog card (vendor, plan access) to the explorer panel', () => {
    expect(models.map(m => [m.id, m.name, m.vendor, m.plans])).toEqual([
      ['gpt-6-luna', 'GPT-6 Luna', 'OpenAI', ['go', 'plus', 'pro', 'max']],
      ['claude-opus-5.5', 'Claude Opus 5.5', 'Anthropic', ['pro', 'max']]
    ])
  })

  it('keeps every input-length tier, cheapest first, with dashes as null', () => {
    const luna = models[0]
    expect(luna?.tiers).toEqual([
      { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
      { input: 0.2, output: 0.75, cacheRead: 0.02, cacheWrite: 0.25 }
    ])
    expect(models[1]?.tiers).toEqual([
      { input: 4, output: 20, cacheRead: 0.4, cacheWrite: null }
    ])
  })

  it('returns an empty list for a page without panels', () => {
    expect(parseOpenDesignModels('<html><body>nothing</body></html>')).toEqual([])
  })

  it('leaves the plan list empty for a legacy panel with no catalog card', () => {
    // 13 live panels (older Grok/GLM/Opus versions) carry rates but no
    // `a.catalog-card`: no plan sells them, so the build must skip them.
    const legacy = parseOpenDesignModels(
      '<div class="model-explorer-panel" id="model-panel-grok-4-5" data-model-panel="grok-4.5"><h3>Grok 4.5</h3></div>'
    )
    expect(legacy).toEqual([
      { id: 'grok-4.5', slug: 'grok-4-5', name: 'Grok 4.5', vendor: null, plans: [], tiers: [] }
    ])
  })
})

describe('designCreditBaseline', () => {
  // The vendor's Go column: every usage value is `60 ÷ multiplier`, and the
  // "$220" in the plan table is only the largest of them (Eco's).
  const usage = [
    { name: 'GPT-6 Luna', requestsPerWeek: null, monthlyUsageUsd: 15 },
    { name: 'GLM-5.3 Flash-X', requestsPerWeek: null, monthlyUsageUsd: 30 },
    { name: 'DeepSeek V4 Pro', requestsPerWeek: null, monthlyUsageUsd: 60 },
    { name: 'DeepSeek V4.1 Flash', requestsPerWeek: null, monthlyUsageUsd: 120 },
    { name: 'DeepSeek V4.1 Flash Eco', requestsPerWeek: null, monthlyUsageUsd: 220 },
    { name: 'Claude Haiku 5.5', requestsPerWeek: null, monthlyUsageUsd: 30 }
  ]
  const multipliers = [
    { name: 'GPT-6 Luna', multiplier: 4 },
    { name: 'GLM-5.3 Flash-X', multiplier: 2 },
    { name: 'DeepSeek V4 Pro', multiplier: 1 },
    { name: 'DeepSeek V4.1 Flash', multiplier: 0.5 },
    { name: 'DeepSeek V4.1 Flash Eco', multiplier: 0.27 },
    { name: 'Claude Haiku 5.5', multiplier: 4 }
  ]

  it('derives the pool from usage × multiplier, ignoring one generous row', () => {
    // Products: 60, 60, 60, 60, 59.4, 120 — the outlier ($120 for Haiku) cannot
    // drag the median, which rounds to the plan's $60.
    expect(designCreditBaseline(usage, multipliers)).toBe(60)
  })

  it('needs a few rows before trusting the baseline', () => {
    expect(designCreditBaseline(usage.slice(0, 2), multipliers)).toBeNull()
    expect(designCreditBaseline([], multipliers)).toBeNull()
  })

  it('returns null when the credits page lists no multiplier', () => {
    expect(designCreditBaseline(usage, [])).toBeNull()
    expect(
      designCreditBaseline(usage, multipliers.map(row => ({ ...row, multiplier: 0 })))
    ).toBeNull()
  })
})
