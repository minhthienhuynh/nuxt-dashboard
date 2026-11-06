import { describe, expect, it } from 'vitest'
import { extractFlightEstimates, extractFlightModels, fetchSources } from './sources'

describe('extractFlightModels', () => {
  it('extracts the models array from Flight HTML', () => {
    const html = 'self.__next_f.push([1,"...\\"models\\":[{\\"slug\\":\\"a\\",\\"name\\":\\"A\\"}]..."])'
    expect(extractFlightModels(html)).toEqual([{ slug: 'a', name: 'A' }])
  })

  it('returns empty when absent', () => {
    expect(extractFlightModels('<html>no data</html>')).toEqual([])
  })
})

describe('extractFlightEstimates', () => {
  it('extracts the estimates payload', () => {
    const html = 'push([1,"$L45:{\\"rows\\":[{\\"name\\":\\"A\\",\\"budgetUsd\\":20}],\\"fiveHourFraction\\":0.2,\\"weeklyFraction\\":0.5}"])'
    const parsed = extractFlightEstimates(html)
    expect(parsed?.fiveHourFraction).toBe(0.2)
    expect(parsed?.weeklyFraction).toBe(0.5)
    expect(parsed?.rows).toEqual([{ name: 'A', budgetUsd: 20 }])
  })

  it('returns null when absent', () => {
    expect(extractFlightEstimates('<html>no data</html>')).toBeNull()
  })
})

describe('fetchSources', () => {
  const ok = async () => new Response('<html>core</html>', { status: 200 })

  it('keeps the core sources when an additive OpenDesign page fails', async () => {
    const fetchImpl = (async (url: string) => {
      if (url.includes('open-design')) throw new Error('down')
      return ok()
    }) as typeof fetch
    const sources = await fetchSources(fetchImpl)
    expect(sources.goatHtml).toBe('<html>core</html>')
    expect(sources.openDesignGoHtml).toBe('')
    expect(sources.openDesignModelsHtml).toBe('')
  })

  it('still fails when a core source is down', async () => {
    const fetchImpl = (async () => {
      throw new Error('down')
    }) as typeof fetch
    await expect(fetchSources(fetchImpl)).rejects.toThrow('down')
  })
})
