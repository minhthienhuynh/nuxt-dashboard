import { describe, expect, it, vi } from 'vitest'
import { extractAaScores, fetchAaScore, findAaScore, round1 } from './aa'

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
