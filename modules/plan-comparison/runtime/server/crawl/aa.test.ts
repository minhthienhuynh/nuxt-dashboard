import { describe, expect, it, vi } from 'vitest'
import {
  aaSlugCandidates,
  extractAaIntelligence,
  extractAaScores,
  fetchAaScore,
  findAaScore,
  labelMatchesModel,
  resolveAaScoreForTest,
  round1
} from './aa'

const pageHtml = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Dataset","name":"Intelligence","data":[{"label":"Qwen3.8 Max (0902)","artificialAnalysisIntelligenceIndex":45.4354834980521,"detailsUrl":"/models/qwen3-8-max"},{"label":"GLM-5.3 (max)","artificialAnalysisIntelligenceIndex":44.855717385614}]}</script></head></html>`

describe('extractAaScores', () => {
  it('parses exact scores from the JSON-LD Dataset script', () => {
    expect(extractAaScores(pageHtml)).toEqual([
      { label: 'Qwen3.8 Max (0902)', score: 45.4354834980521 },
      { label: 'GLM-5.3 (max)', score: 44.855717385614 }
    ])
  })

  it('returns empty without the script', () => {
    expect(extractAaScores('<html></html>')).toEqual([])
  })
})

describe('findAaScore', () => {
  it('rounds to 1 decimal and matches variants exactly', () => {
    const entries = extractAaScores(pageHtml)
    expect(findAaScore(entries, 'Qwen3.8 Max (0902)')).toBe(45.4)
    expect(findAaScore(entries, 'Qwen3.8 Max')).toBeNull()
  })
})

describe('round1', () => {
  it('rounds half away from float noise', () => {
    expect(round1(44.855717385614)).toBe(44.9)
    expect(round1(39.545442472527)).toBe(39.5)
  })
})

describe('fetchAaScore', () => {
  it('fetches and resolves the variant score', async () => {
    const fetchImpl = vi.fn(async () => new Response(pageHtml))
    expect(await fetchAaScore('qwen3-8-max', 'Qwen3.8 Max (0902)', fetchImpl)).toBe(45.4)
  })

  it('returns null on fetch failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('down')
    })
    expect(await fetchAaScore('x', 'y', fetchImpl)).toBeNull()
  })
})

describe('labelMatchesModel', () => {
  it('accepts identical names (compact key, parentheticals and separators ignored)', () => {
    expect(labelMatchesModel('MiMo V2.6 Pro', 'MiMo-V2.6-Pro')).toBe(true)
    expect(labelMatchesModel('Grok 4.7', 'Grok 4.7 (xhigh)')).toBe(true)
    expect(labelMatchesModel('Qwen 3.8 Max', 'Qwen3.8 Max')).toBe(true)
  })

  it('accepts serving-tier suffix differences but not product differences', () => {
    expect(labelMatchesModel('DeepSeek V4 Flash Fast', 'DeepSeek V4 Flash (max)')).toBe(true)
    expect(labelMatchesModel('Kimi K2.7 Code HighSpeed', 'Kimi K2.7 Code')).toBe(true)
    expect(labelMatchesModel('MiMo V2.6 Pro UltraSpeed', 'MiMo V2.6 Pro')).toBe(true)
    expect(labelMatchesModel('DeepSeek V4 Flash Vision (exp)', 'DeepSeek V4 Flash Vision')).toBe(true)
    // distinct products must never match
    expect(labelMatchesModel('GLM-5.3 Flash', 'GLM-5.3')).toBe(false)
    expect(labelMatchesModel('GLM-5.3 FlashX', 'GLM-5.3-Flash')).toBe(false)
    expect(labelMatchesModel('MiMo V2.6 Pro', 'MiMo V2.5 Pro')).toBe(false)
    expect(labelMatchesModel('Kimi K3', 'Kimi K2.7 Code')).toBe(false)
    // dated snapshots are NOT tier words: 0902 stays a distinct variant
    expect(labelMatchesModel('Qwen 3.8 Max 0902', 'Qwen3.8 Max')).toBe(false)
  })
})

describe('aaSlugCandidates', () => {
  it('right-trims suffix tokens, longest first, capped at 2, keeping >=2 parts', () => {
    expect(aaSlugCandidates('deepseek-v4-flash-fast')).toEqual(['deepseek-v4-flash', 'deepseek-v4'])
    expect(aaSlugCandidates('kimi-k2-7-code-highspeed')).toEqual(['kimi-k2-7-code', 'kimi-k2-7'])
    expect(aaSlugCandidates('glm-5-2-fast')).toEqual(['glm-5-2', 'glm-5'])
    expect(aaSlugCandidates('mimo-v2-6-pro')).toEqual(['mimo-v2-6', 'mimo-v2'])
    expect(aaSlugCandidates('abc-def')).toEqual([])
  })
})

describe('extractAaIntelligence', () => {
  const html = `<html><head>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Dataset","name":"Speed","data":[{"label":"MiMo-V2.6-Pro","artificialAnalysisIntelligenceIndex":99,"detailsUrl":"/models/mimo-v2-6-pro"}]}</script>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Dataset","name":"Intelligence","data":[{"label":"MiMo-V2.6-Pro","artificialAnalysisIntelligenceIndex":46.3242065310383,"detailsUrl":"/models/mimo-v2-6-pro"},{"label":"GLM-5.3 (max)","artificialAnalysisIntelligenceIndex":44.777,"detailsUrl":"/models/glm-5-3"}]}</script>
  </head></html>`

  it('collects only the Intelligence dataset, keeping the detailsUrl slug', () => {
    expect(extractAaIntelligence(html)).toEqual([
      { label: 'MiMo-V2.6-Pro', score: 46.3242065310383, slug: 'mimo-v2-6-pro' },
      { label: 'GLM-5.3 (max)', score: 44.777, slug: 'glm-5-3' }
    ])
  })

  it('returns empty without datasets', () => {
    expect(extractAaIntelligence('<html></html>')).toEqual([])
  })
})

describe('resolveAaScore', () => {
  const tinyBody = 'x'
  const modelPage = (slug: string, label: string, score: number) => `<html><head>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Dataset","name":"Intelligence","data":[{"label":"${label}","artificialAnalysisIntelligenceIndex":${score},"detailsUrl":"/models/${slug}"}]}</script>
  </head></html>`
  const sitemap = `<urlset><url><loc>https://artificialanalysis.ai/models/mimo-v2-5-0424</loc></url></urlset>`
  const resolve = (model: { slug: string, name: string }, fetchImpl: Parameters<typeof resolveAaScoreForTest>[1]) =>
    resolveAaScoreForTest(model, fetchImpl)

  it('resolves via the direct slug with slug back-reference + label match', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = String(url)
      if (u.includes('mimo-v2-6-pro')) return new Response(modelPage('mimo-v2-6-pro', 'MiMo-V2.6-Pro', 46.3242065310383))
      return new Response(sitemap)
    })
    expect(await resolve({ slug: 'mimo-v2-6-pro', name: 'MiMo V2.6 Pro' }, fetchImpl)).toBe(46.3)
    // one probe only — direct hit short-circuits
    expect(fetchImpl.mock.calls.filter(c => String(c[0]).includes('/models/')).length).toBe(1)
  })

  it('rejects a wrong-model page (label mismatch) instead of borrowing its score', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = String(url)
      if (u.includes('/models/mimo-v2-6-pro-ultraspeed')) return new Response(tinyBody)
      if (u.includes('/models/mimo-v2-6-pro')) return new Response(tinyBody)
      if (u.includes('/models/mimo-v2-6')) return new Response(modelPage('mimo-v2-6', 'GLM-5.3 (max)', 44.777))
      if (u.includes('/models/mimo-v2')) return new Response(tinyBody)
      return new Response(sitemap)
    })
    expect(await resolve({ slug: 'mimo-v2-6-pro-ultraspeed', name: 'MiMo V2.6 Pro UltraSpeed' }, fetchImpl)).toBeNull()
  })

  it('falls back to right-trimmed slug for serving-tier variants', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = String(url)
      if (u.includes('/models/kimi-k2-7-code')) return new Response(modelPage('kimi-k2-7-code', 'Kimi K2.7 Code', 25.8121062401836))
      return new Response(tinyBody)
    })
    expect(await resolve({ slug: 'kimi-k2-7-code-highspeed', name: 'Kimi K2.7 Code HighSpeed' }, fetchImpl)).toBe(25.8)
  })

  it('falls back to sitemap overlap when trims miss (renamed slug)', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = String(url)
      if (u.includes('/models/mimo-v2-5-0424')) return new Response(modelPage('mimo-v2-5-0424', 'MiMo-V2.5', 22.33))
      if (u.includes('sitemap.xml')) return new Response(sitemap)
      return new Response(tinyBody)
    })
    expect(await resolve({ slug: 'mimo-v2-5', name: 'MiMo V2.5' }, fetchImpl)).toBe(22.3)
  })

  it('returns null on fetch failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('down')
    })
    expect(await resolve({ slug: 'step-5-preview', name: 'Step 5 Preview' }, fetchImpl)).toBeNull()
  })
})
