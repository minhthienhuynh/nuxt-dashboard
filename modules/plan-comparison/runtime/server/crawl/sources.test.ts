import { describe, expect, it } from 'vitest'
import { extractFlightEstimates, extractFlightModels } from './sources'

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
