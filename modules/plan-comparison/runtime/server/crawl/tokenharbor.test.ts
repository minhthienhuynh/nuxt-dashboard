import { describe, expect, it } from 'vitest'
import { isAgentPassModel, isOfficePassModel, parseTokenHarborBoosts, parseTokenHarborCatalogue, tokenHarborRequestCost, tokenHarborVendor } from './tokenharbor'
import type { TokenHarborModel } from './tokenharbor'

// Trimmed copy of tokenharbor.ai/models: the catalogue is a Next.js Flight
// payload (escape depth 1 here, the page nests it deeper), one array per tab
// plus a `speedBuild` child entry per model that has a faster sibling.
const catalogueHtml = 'self.__next_f.push([1,"[{\\"surface\\":\\"glm-5.3-flash\\",\\"label\\":\\"GLM 5.3 Flash\\",\\"family\\":\\"z-ai\\",\\"tier\\":\\"value\\",\\"priceIn\\":0.15,\\"priceOut\\":0.5,\\"cache\\":{\\"read\\":0.03,\\"write\\":null},\\"contextWindow\\":1000000,\\"maxOutput\\":128000,\\"intelligenceIndex\\":27.8,\\"inputModalities\\":[\\"text\\"],\\"isFree\\":false,\\"speedBuild\\":{\\"surface\\":\\"glm-5.3-fast\\",\\"label\\":\\"GLM 5.3 Fast\\",\\"priceIn\\":2.1,\\"priceOut\\":6.6}},{\\"surface\\":\\"deepseek-v4.1-flash:free\\",\\"label\\":\\"DeepSeek V4.1 Flash\\",\\"family\\":\\"deepseek\\",\\"priceIn\\":0,\\"priceOut\\":0,\\"isFree\\":true},{\\"surface\\":\\"claude-opus-5.5\\",\\"label\\":\\"Claude Opus 5.5\\",\\"family\\":\\"anthropic\\",\\"priceIn\\":4,\\"priceOut\\":20,\\"cache\\":{\\"read\\":0.2},\\"inputModalities\\":[\\"text\\",\\"image\\"],\\"isFree\\":false}]"])'

// Trimmed copy of the `/pricing` Agent Pass widget: a bare `2×` badge is a
// standing Model Boost, a badge whose title says "promo" is a temporary one.
const pricingHtml = '<div><p>Agent Pass<!-- --> · estimated requests</p><ul class="space-y-2">'
  + '<li class="flex items-center gap-3"><span class="flex w-[172px] shrink-0 items-center gap-1.5 sm:w-[228px]"><span class="min-w-0 break-words text-[12.5px] font-medium leading-tight text-foreground">GLM 5.3 Flash</span><span class="shrink-0 rounded-full bg-[color:var(--accent-lime-soft)] px-1.5 py-0.5 text-[9.5px] font-bold text-[color:var(--accent-lime-ink)]">2×</span></span><span class="relative h-[14px] flex-1 overflow-hidden rounded-full">19.2k+</span></li>'
  + '<li class="flex items-center gap-3"><span class="flex w-[172px] shrink-0 items-center gap-1.5 sm:w-[228px]"><span class="min-w-0 break-words text-[12.5px] font-medium leading-tight text-foreground">DeepSeek V4.1 Flash 1017</span><span class="shrink-0 rounded-full bg-[color:var(--accent-lime-soft)] px-1.5 py-0.5 text-[9.5px] font-bold text-[color:var(--accent-lime-ink)]" title="2x usage during the promo">2x</span></span><span class="relative h-[14px] flex-1 overflow-hidden rounded-full">10.8k+</span></li>'
  + '<li class="flex items-center gap-3"><span class="flex w-[172px] shrink-0 items-center gap-1.5 sm:w-[228px]"><span class="min-w-0 break-words text-[12.5px] font-medium leading-tight text-foreground">GPT-6 Luna</span></span><span class="relative h-[14px] flex-1 overflow-hidden rounded-full">12k+</span></li>'
  + '</ul></div>'

function model(overrides: Partial<TokenHarborModel> = {}): TokenHarborModel {
  return {
    id: 'widget',
    label: 'Widget',
    family: 'acme',
    tier: 'value',
    priceIn: 0.1,
    priceOut: 0.5,
    cacheRead: 0.01,
    cacheWrite: null,
    contextWindow: 100000,
    maxOutput: null,
    intelligenceIndex: null,
    inputModalities: ['text'],
    isFree: false,
    speedOf: null,
    ...overrides
  }
}

describe('parseTokenHarborCatalogue', () => {
  it('reads every tab array and expands the speed variant with the base model metadata', () => {
    const models = parseTokenHarborCatalogue(catalogueHtml)
    expect(models.map(item => item.id)).toEqual(['glm-5.3-flash', 'glm-5.3-fast', 'deepseek-v4.1-flash:free', 'claude-opus-5.5'])

    const base = models[0]!
    expect(base).toMatchObject({ family: 'z-ai', priceIn: 0.15, cacheRead: 0.03, contextWindow: 1000000, isFree: false })

    // The variant publishes only its own rates; the page renders it under the
    // base model, so cache/context/family come from there.
    expect(models[1]).toMatchObject({
      id: 'glm-5.3-fast',
      speedOf: 'glm-5.3-flash',
      priceIn: 2.1,
      priceOut: 6.6,
      family: 'z-ai',
      cacheRead: 0.03,
      contextWindow: 1000000
    })
    expect(models[2]).toMatchObject({ id: 'deepseek-v4.1-flash:free', isFree: true })
  })

  it('returns nothing for a page without the payload', () => {
    expect(parseTokenHarborCatalogue('<html>no payload</html>')).toEqual([])
  })
})

describe('parseTokenHarborBoosts', () => {
  it('tells a standing Model Boost from a promo multiplier', () => {
    expect(parseTokenHarborBoosts(pricingHtml)).toEqual([
      { name: 'GLM 5.3 Flash', multiple: 2, promo: false },
      { name: 'DeepSeek V4.1 Flash 1017', multiple: 2, promo: true }
    ])
  })

  it('returns nothing when the widget is absent', () => {
    expect(parseTokenHarborBoosts('<html>no widget</html>')).toEqual([])
  })
})

describe('isAgentPassModel', () => {
  it('funds models inside the published price caps', () => {
    expect(isAgentPassModel(model({ priceIn: 0.2, priceOut: 1 }))).toBe(true)
    expect(isAgentPassModel(model({ priceIn: 0.21, priceOut: 0.9 }))).toBe(false)
    expect(isAgentPassModel(model({ priceIn: 0.19, priceOut: 1.01 }))).toBe(false)
  })

  it('funds the by-name models even above the caps', () => {
    expect(isAgentPassModel(model({ id: 'gpt-5.6-luna', priceIn: 0.2, priceOut: 1.2 }))).toBe(true)
    expect(isAgentPassModel(model({ id: 'mimo-v2.5-pro', priceIn: 0.435, priceOut: 0.87 }))).toBe(true)
  })

  it('never funds a free route', () => {
    expect(isAgentPassModel(model({ id: 'mimo-v2.5:free', priceIn: 0, priceOut: 0, isFree: true }))).toBe(false)
  })
})

describe('isOfficePassModel', () => {
  it('funds the wider published caps ($1 in / $4 out)', () => {
    expect(isOfficePassModel(model({ priceIn: 1, priceOut: 4 }))).toBe(true)
    expect(isOfficePassModel(model({ priceIn: 1.01, priceOut: 3 }))).toBe(false)
    expect(isOfficePassModel(model({ priceIn: 0.5, priceOut: 4.01 }))).toBe(false)
  })

  it('keeps everything the Agent Pass funds', () => {
    expect(isOfficePassModel(model({ priceIn: 0.2, priceOut: 1 }))).toBe(true)
    expect(isOfficePassModel(model({ id: 'gpt-5.6-luna', priceIn: 0.2, priceOut: 1.2 }))).toBe(true)
    expect(isOfficePassModel(model({ id: 'mimo-v2.5-pro', priceIn: 0.435, priceOut: 0.87 }))).toBe(true)
  })

  it('funds the by-name office models even far above the caps', () => {
    expect(isOfficePassModel(model({ id: 'claude-sonnet-5', priceIn: 2, priceOut: 10 }))).toBe(true)
    expect(isOfficePassModel(model({ id: 'grok-4.6', priceIn: 3, priceOut: 15 }))).toBe(true)
    expect(isOfficePassModel(model({ id: 'muse-spark-1-3', priceIn: 0.5, priceOut: 6 }))).toBe(true)
  })

  it('never funds a free route', () => {
    expect(isOfficePassModel(model({ id: 'mimo-v2.5:free', priceIn: 0, priceOut: 0, isFree: true }))).toBe(false)
  })
})

describe('tokenHarborRequestCost', () => {
  it('prices the published profile: 2K input + 8K cache + 1K output', () => {
    // GLM 5.3 Flash: 2K×0.15 + 8K×0.03 + 1K×0.5 per 1M → $0.00104.
    expect(tokenHarborRequestCost(model({ priceIn: 0.15, priceOut: 0.5, cacheRead: 0.03 }))).toBeCloseTo(0.00104, 8)
  })

  it('bills the whole input at the input rate when no cache rate is published', () => {
    // 10K input + 1K output, no cache rate: 10,000×0.1 + 1,000×0.5 per 1M.
    expect(tokenHarborRequestCost(model({ priceIn: 0.1, priceOut: 0.5, cacheRead: null }))).toBeCloseTo(0.0015, 8)
  })

  it('returns null without published rates', () => {
    expect(tokenHarborRequestCost(model({ priceIn: null, priceOut: null }))).toBeNull()
  })
})

describe('tokenHarborVendor', () => {
  it('labels the published families and passes unknown ones through', () => {
    expect(tokenHarborVendor('z-ai')).toBe('Z.ai')
    expect(tokenHarborVendor('deepseek')).toBe('DeepSeek')
    expect(tokenHarborVendor('unlisted')).toBe('unlisted')
    expect(tokenHarborVendor(null)).toBeNull()
  })
})
