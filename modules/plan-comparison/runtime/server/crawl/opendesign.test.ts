import { describe, expect, it } from 'vitest'
import { parseOpenDesignModels, parseOpenDesignPlans, parsePlanAccess } from './opendesign'

// Trimmed copy of go.open-design.ai: the pricing page embeds the plan table as
// a JSON settings block, the models index carries one catalog card (vendor +
// plan access) and one explorer panel (API id + input-length tiers) per model.
const settingsHtml = `<html><body><script type="application/json" data-corouter-settings>{"copy":{"budget":"Credits"},"plans":[
  {"name":"Go","monthly":10,"first":8,"annual":7,"year":84,"pool":0,"design":220},
  {"name":"Plus","monthly":20,"first":16,"annual":14,"year":168,"pool":20,"design":290}
]}</script></body></html>`

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

describe('parseOpenDesignPlans', () => {
  it('keeps the name, list price and Coding Plan pool; promo fields are not carried', () => {
    expect(parseOpenDesignPlans(settingsHtml)).toEqual([
      { name: 'Go', monthly: 10, design: 220 },
      { name: 'Plus', monthly: 20, design: 290 }
    ])
  })

  it('returns nothing when the settings block is absent or unparsable', () => {
    expect(parseOpenDesignPlans('<html><body>no json</body></html>')).toEqual([])
    expect(parseOpenDesignPlans('<script type="application/json" data-corouter-settings>{oops</script>')).toEqual([])
  })

  it('skips rows without a name or a price', () => {
    const html = '<script type="application/json" data-corouter-settings>{"plans":[{"name":"Go"},{"monthly":10},{"name":"Go","monthly":10,"design":220}]}</script>'
    expect(parseOpenDesignPlans(html)).toHaveLength(1)
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
