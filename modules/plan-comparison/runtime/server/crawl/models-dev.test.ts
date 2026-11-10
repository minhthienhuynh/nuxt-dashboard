import { describe, expect, it } from 'vitest'
import { indexModelsDev, modelsDevReleaseDate } from './models-dev'

// Trimmed copy of https://models.dev/api.json: providers → models →
// release_date, with the same model carried by several aggregators.
const catalog = JSON.stringify({
  'vercel': { models: { 'meta/muse-ember': { name: 'Muse Ember', release_date: '2026-11-09' } } },
  'kilo': { models: { 'meta/muse-ember': { name: 'Meta: Muse Ember', release_date: '2026-11-09' } } },
  'alibaba': { models: { 'qwen3.8-flash': { name: 'Qwen3.8 Flash', release_date: '2026-08-26' } } },
  'nano-gpt': { models: { 'qwen/qwen3.8-flash': { name: 'Qwen3.8 Flash', release_date: '2026-08-26' } } },
  // An aggregator copying the base date onto a speed variant, outvoted below.
  'chutes': { models: { 'glm-5.2-fast': { name: 'GLM 5.2 Fast', release_date: '2026-06-13' } } },
  'requesty': { models: { 'glm-5.2-fast': { name: 'glm-5.2-fast', release_date: '2026-07-13' } } },
  'zai': { models: { 'glm-5.2-fast': { name: 'GLM-5.2-Fast', release_date: '2026-07-13' } } },
  // Rows without a usable date are skipped.
  'broken': { models: { 'ghost/model': { name: 'Ghost' }, 'bad/model': { name: 'Bad', release_date: 'soon' } } }
})

describe('modelsDevReleaseDate', () => {
  const index = indexModelsDev(catalog)

  it('finds a model by name across aggregators and returns their consensus', () => {
    expect(modelsDevReleaseDate(index, ['muse-ember', 'Muse Ember', 'meta/muse-ember'])).toBe('2026-11-09')
  })

  it('matches on the compact key, ignoring spacing and case', () => {
    expect(modelsDevReleaseDate(index, ['qwen3.8-flash'])).toBe('2026-08-26')
    expect(modelsDevReleaseDate(index, ['Qwen 3.8 Flash'])).toBe('2026-08-26')
  })

  it('lets the majority win over a single copy-paste date', () => {
    expect(modelsDevReleaseDate(index, ['glm-5.2-fast'])).toBe('2026-07-13')
  })

  it('returns null when nothing matches or the payload is unusable', () => {
    expect(modelsDevReleaseDate(index, ['unknown-model'])).toBeNull()
    expect(modelsDevReleaseDate(index, ['ghost/model', 'Bad'])).toBeNull()
    expect(modelsDevReleaseDate(indexModelsDev(''), ['muse-ember'])).toBeNull()
    expect(modelsDevReleaseDate(indexModelsDev('not json'), ['muse-ember'])).toBeNull()
  })
})
