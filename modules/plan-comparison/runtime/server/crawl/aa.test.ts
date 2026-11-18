import { describe, expect, it } from 'vitest'
import {
  aaSlugCandidates,
  extractAaIntelligence,
  extractAaScores,
  fetchAaScore,
  fetchLeaderboardIntel,
  findAaScore,
  labelMatchesModel,
  parseLeaderboardIntel,
  resolveAaScore,
  round1,
  scoreFromLeaderboard
} from './aa'

describe('extractAaScores', () => {
  const jsonLd = '<script type="application/ld+json">{"data":[{"label":"claude-sonnet-5.5 (max)","artificialAnalysisIntelligenceIndex":58.68}]}</script>'

  it('parses exact scores from the JSON-LD Dataset script', () => {
    expect(extractAaScores(jsonLd)).toEqual([{ label: 'claude-sonnet-5.5 (max)', score: 58.68 }])
  })

  it('returns empty without the script', () => {
    expect(extractAaScores('<html></html>')).toEqual([])
  })
})

describe('findAaScore', () => {
  const entries = [
    { label: 'claude-sonnet-5.5 (max)', score: 58.68 },
    { label: 'claude-sonnet-5.5 (xhigh)', score: 56.2 }
  ]

  it('rounds to 1 decimal and matches variants exactly', () => {
    expect(findAaScore(entries, 'Claude Sonnet 5.5')).toBe(58.7)
  })

  it('variant identity survives formatting noise, not qualifier changes', () => {
    expect(findAaScore(entries, 'claude-sonnet-5-5')).toBe(58.7)
    expect(findAaScore(entries, 'Claude Sonnet 5')).toBeNull()
  })
})

describe('round1', () => {
  it('rounds half away from float noise', () => {
    expect(round1(58.68)).toBe(58.7)
    expect(round1(58.64)).toBe(58.6)
    expect(round1(58.65)).toBe(58.7)
  })
})

describe('fetchAaScore', () => {
  it('fetches and resolves the variant score', async () => {
    const fakeFetch = async () => new Response(
      '<script type="application/ld+json">{"data":[{"label":"claude-sonnet-5.5 (max)","artificialAnalysisIntelligenceIndex":58.68}]}</script>',
      { status: 200 }
    )
    const score = await fetchAaScore('claude-sonnet-5-5', 'Claude Sonnet 5.5', fakeFetch as any)
    expect(score).toBe(58.7)
  })

  it('returns null on fetch failure', async () => {
    const fakeFetch = async () => new Response('', { status: 500 })
    const score = await fetchAaScore('claude-sonnet-5-5', 'Claude Sonnet 5.5', fakeFetch as any)
    expect(score).toBeNull()
  })
})

describe('labelMatchesModel', () => {
  it('accepts identical names (compact key, parentheticals and separators ignored)', () => {
    expect(labelMatchesModel('Claude Sonnet 5.5', 'claude-sonnet-5.5 (max)')).toBe(true)
    expect(labelMatchesModel('Claude Sonnet 5.5', 'Claude Sonnet 5.5')).toBe(true)
    expect(labelMatchesModel('Qwen3.8-Flash', 'Qwen3.8-Flash-Next')).toBe(true)
    expect(labelMatchesModel('Qwen3.8-Flash', 'Qwen3.8 Flash (xhigh)')).toBe(true)
  })

  it('accepts serving-tier suffix differences but not product differences', () => {
    expect(labelMatchesModel('DeepSeek V4.1 Flash', 'DeepSeek-V4.1-Flash-Fast')).toBe(true)
    expect(labelMatchesModel('DeepSeek V4.1 Flash', 'DeepSeek V4.1 Flash Pro')).toBe(true)
    expect(labelMatchesModel('Claude Sonnet 5.5', 'Claude Haiku 5.5')).toBe(false)
    expect(labelMatchesModel('Claude Sonnet 5.5', 'Claude Sonnet 5')).toBe(false)
    expect(labelMatchesModel('GPT-5', 'GPT-5.1')).toBe(false)
  })
})

describe('aaSlugCandidates', () => {
  it('right-trims suffix tokens, longest first, capped at 2, keeping >=2 parts', () => {
    expect(aaSlugCandidates('deepseek-v4-pro-chat')).toEqual(['deepseek-v4-pro', 'deepseek-v4'])
    expect(aaSlugCandidates('claude-sonnet-5-5')).toEqual(['claude-sonnet-5', 'claude-sonnet'])
    expect(aaSlugCandidates('gpt-5')).toEqual([])
    expect(aaSlugCandidates('a-b-c-d-e')).toEqual(['a-b-c-d', 'a-b-c'])
  })
})

describe('extractAaIntelligence', () => {
  it('collects only the Intelligence dataset, keeping the detailsUrl slug', () => {
    const html = '<script type="application/ld+json">{"name":"Speed","data":[{"label":"X","artificialAnalysisIntelligenceIndex":10}]}</script>'
      + '<script type="application/ld+json">{"name":"Intelligence","data":[{"label":"DeepSeek V4 Pro (max)","detailsUrl":"/models/deepseek-v4-pro","artificialAnalysisIntelligenceIndex":52.6}]}</script>'
    expect(extractAaIntelligence(html)).toEqual([
      { label: 'DeepSeek V4 Pro (max)', score: 52.6, slug: 'deepseek-v4-pro' }
    ])
  })

  it('returns empty without datasets', () => {
    expect(extractAaIntelligence('<html></html>')).toEqual([])
  })
})

describe('resolveAaScore', () => {
  const pad = (body: string) => body + '<!-- ' + 'x'.repeat(1_000_000) + ' -->'
  const intelScript = (slug: string, label: string, score: number) =>
    `<script type="application/ld+json">{"name":"Intelligence","data":[{"label":"${label}","detailsUrl":"/models/${slug}","artificialAnalysisIntelligenceIndex":${score}}]}</script>`

  it('resolves via the direct slug with slug back-reference + label match', async () => {
    const html = pad(intelScript('deepseek-v4-pro', 'DeepSeek V4 Pro (max)', 52.6))
    const fakeFetch = async (url: string) => {
      if (url.endsWith('/deepseek-v4-pro')) return new Response(html, { status: 200 })
      return new Response('', { status: 404 })
    }
    const score = await resolveAaScore('deepseek-v4-pro', 'DeepSeek V4 Pro', fakeFetch as any)
    expect(score).toBe(52.6)
  })

  it('rejects a wrong-model page (label mismatch) instead of borrowing its score', async () => {
    const html = pad(intelScript('deepseek-v4-pro', 'DeepSeek V4 Chat (max)', 52.6))
    const fakeFetch = async () => new Response(html, { status: 200 })
    const score = await resolveAaScore('deepseek-v4-pro', 'Claude Sonnet 5.5', fakeFetch as any)
    expect(score).toBeNull()
  })

  it('falls back to right-trimmed slug for serving-tier variants', async () => {
    const trimmedHtml = pad(intelScript('deepseek-v4-pro', 'DeepSeek V4 Pro (max)', 52.6))
    const fakeFetch = async (url: string) => {
      if (url.endsWith('/deepseek-v4-pro-chat')) return new Response('', { status: 404 })
      if (url.endsWith('/deepseek-v4-pro')) return new Response(trimmedHtml, { status: 200 })
      return new Response('', { status: 404 })
    }
    const score = await resolveAaScore('deepseek-v4-pro-chat', 'DeepSeek V4 Pro', fakeFetch as any)
    expect(score).toBe(52.6)
  })

  it('falls back to sitemap overlap when trims miss (renamed slug)', async () => {
    const sitemapXml = '<urlset><url><loc>https://artificialanalysis.ai/models/gemma-3-27b-it</loc></url></urlset>'
    const pageHtml = pad(intelScript('gemma-3-27b-it', 'Gemma 3 27B-IT', 35.1))
    const fakeFetch = async (url: string) => {
      if (url.endsWith('/sitemap.xml')) return new Response(sitemapXml, { status: 200 })
      if (url.endsWith('/gemma-3-27b-it')) return new Response(pageHtml, { status: 200 })
      return new Response('', { status: 404 })
    }
    const score = await resolveAaScore('gemma-3-27b', 'Gemma 3 27B', fakeFetch as any)
    expect(score).toBe(35.1)
  })

  it('returns null on fetch failure', async () => {
    const fakeFetch = async () => new Response('', { status: 500 })
    const score = await resolveAaScore('missing', 'Missing', fakeFetch as any)
    expect(score).toBeNull()
  })
})

describe('parseLeaderboardIntel', () => {
  const BS = String.fromCharCode(92)
  const q = `${BS}"`
  // Trimmed from the live leaderboard page (v5.0.1, 2026-11-12): the
  // initialModels array is embedded in a flight chunk, quotes escaped as
  // served so the test covers the unescape step.
  const flightHtml = `<html><body><script>self.__next_f.push([1,"{${q}initialModels${q}:[{${q}slug${q}:${q}mimo-v2-6-flash${q},${q}name${q}:${q}MiMo-V2.6-Flash${q},${q}intelligenceIndex${q}:26.7276981444568,${q}intelligenceIndexIsEstimated${q}:false},{${q}slug${q}:${q}mimo-v2-6-pro${q},${q}name${q}:${q}MiMo-V2.6-Pro${q},${q}intelligenceIndex${q}:29.9,${q}intelligenceIndexIsEstimated${q}:false},{${q}slug${q}:${q}guess-model${q},${q}name${q}:${q}Guess Model${q},${q}intelligenceIndex${q}:12.5,${q}intelligenceIndexIsEstimated${q}:true},{${q}slug${q}:${q}unscored-model${q},${q}name${q}:${q}Unscored Model${q},${q}intelligenceIndex${q}:null,${q}intelligenceIndexIsEstimated${q}:false}]}"])</script></body></html>`

  it('keeps exact scores rounded to 1 decimal', () => {
    expect(parseLeaderboardIntel(flightHtml)).toEqual([
      { slug: 'mimo-v2-6-flash', label: 'MiMo-V2.6-Flash', score: 26.7 },
      { slug: 'mimo-v2-6-pro', label: 'MiMo-V2.6-Pro', score: 29.9 }
    ])
  })

  it('drops estimated and null entries', () => {
    const entries = parseLeaderboardIntel(flightHtml)
    expect(entries.some(e => e.slug === 'guess-model')).toBe(false)
    expect(entries.some(e => e.slug === 'unscored-model')).toBe(false)
  })

  it('keeps the first record on duplicate slugs', () => {
    const dupHtml = `<script>[{${q}initialModels${q}:[{${q}slug${q}:${q}dup-model${q},${q}name${q}:${q}Dup Model${q},${q}intelligenceIndex${q}:40.0,${q}intelligenceIndexIsEstimated${q}:false},{${q}slug${q}:${q}dup-model${q},${q}name${q}:${q}Dup Model${q},${q}intelligenceIndex${q}:10.0,${q}intelligenceIndexIsEstimated${q}:false}]}]</script>`
    expect(parseLeaderboardIntel(dupHtml)[0]?.score).toBe(40)
  })

  it('lowercases slugs for case-insensitive joins', () => {
    const upperHtml = `<script>[{${q}initialModels${q}:[{${q}slug${q}:${q}MiMo-V2-6-Flash${q},${q}name${q}:${q}MiMo-V2-6-Flash${q},${q}intelligenceIndex${q}:26.7,${q}intelligenceIndexIsEstimated${q}:false}]}]</script>`
    expect(parseLeaderboardIntel(upperHtml)[0]?.slug).toBe('mimo-v2-6-flash')
  })

  it('extracts slug from nested release object in modern payloads', () => {
    const modernHtml = `<script>[{${q}initialModels${q}:[{${q}id${q}:${q}m1${q},${q}release${q}:{${q}slug${q}:${q}claude-sonnet-5-5${q},${q}name${q}:${q}Claude Sonnet 5.5${q}},${q}name${q}:${q}Claude Sonnet 5.5 (Max)${q},${q}intelligenceIndex${q}:54.54,${q}intelligenceIndexIsEstimated${q}:false}]}]</script>`
    expect(parseLeaderboardIntel(modernHtml)).toEqual([
      { slug: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (Max)', score: 54.5 }
    ])
  })

  it('returns empty without the initialModels array', () => {
    expect(parseLeaderboardIntel('<html></html>')).toEqual([])
    expect(parseLeaderboardIntel('<script>{]}</script>')).toEqual([])
  })
})

describe('scoreFromLeaderboard', () => {
  const entries = [
    { slug: 'glm-5-3-low', label: 'GLM-5.3 (Low)', score: 23.1 },
    { slug: 'glm-5-3', label: 'GLM-5.3 (Max)', score: 31.7 },
    { slug: 'mimo-v2-6-pro', label: 'MiMo-V2.6-Pro', score: 29.9 },
    { slug: 'qwen3-8-max', label: 'Qwen3.8 Max (0902)', score: 33.7 },
    { slug: 'tencent-hy4', label: 'Tencent Hy4', score: 34.6 }
  ]

  it('matches effort variants and takes the highest score', () => {
    expect(scoreFromLeaderboard(entries, 'GLM-5.3')).toBe(31.7)
  })

  it('matches a model with a trailing serving-tier word', () => {
    expect(scoreFromLeaderboard(entries, 'MiMo V2.6 Pro UltraSpeed')).toBe(29.9)
    expect(scoreFromLeaderboard(entries, 'Tencent Hy4 Preview')).toBe(34.6)
  })

  it('strips parentheticals as the identity (dated snapshots join the base entry, via override)', () => {
    expect(scoreFromLeaderboard(entries, 'Qwen3.8 Max')).toBe(33.7)
  })

  it('joins an AA snapshot label via the curated override', () => {
    const list = [{ slug: 'qwen3-8-max', label: 'Qwen3.8 Max (0902)', score: 33.7 }]
    expect(scoreFromLeaderboard(list, 'Qwen3.8 Max (0902)')).toBe(33.7)
  })

  it('joins the AA 1017 snapshot label via the curated override', () => {
    const list = [{ slug: 'deepseek-v4-1-flash-1017', label: 'DeepSeek V4.1 Flash 1017 (Max)', score: 32.6 }]
    expect(scoreFromLeaderboard(list, 'DeepSeek V4.1 Flash 1017 (Max)')).toBe(32.6)
  })

  it('never leaks a variant score to a different model', () => {
    expect(scoreFromLeaderboard(entries, 'GLM-5.3-Air')).toBeNull()
    expect(scoreFromLeaderboard(entries, 'MiMo-V2.6-Flash')).toBeNull()
  })
})

describe('fetchLeaderboardIntel', () => {
  it('fetches the leaderboard page once', async () => {
    const fakeFetch = async () => new Response(
      '<script>self.__next_f.push([1,"{\\"initialModels\\":[{\\"slug\\":\\"mimo-v2-6-flash\\",\\"name\\":\\"MiMo-V2.6-Flash\\",\\"intelligenceIndex\\":26.7,\\"intelligenceIndexIsEstimated\\":false}]}"])</script>',
      { status: 200 }
    )
    const entries = await fetchLeaderboardIntel(fakeFetch as any)
    expect(entries).toEqual([{ slug: 'mimo-v2-6-flash', label: 'MiMo-V2.6-Flash', score: 26.7 }])
  })

  it('returns an empty array on fetch failure', async () => {
    const fakeFetch = async () => { throw new Error('network down') }
    expect(await fetchLeaderboardIntel(fakeFetch as any)).toEqual([])
  })

  it('returns an empty array on non-ok responses', async () => {
    const fakeFetch = async () => new Response('', { status: 502 })
    expect(await fetchLeaderboardIntel(fakeFetch as any)).toEqual([])
  })
})
