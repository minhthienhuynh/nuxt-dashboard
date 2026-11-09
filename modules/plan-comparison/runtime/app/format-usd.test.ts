import { describe, expect, it } from 'vitest'
import { formatUsd } from './format-usd'

describe('formatUsd', () => {
  it('keeps whole dollars free of decimals', () => {
    expect(formatUsd(10)).toBe('$10')
    expect(formatUsd(220)).toBe('$220')
  })

  it('keeps two decimals on fractional money', () => {
    expect(formatUsd(2.5)).toBe('$2.50')
    expect(formatUsd(1.99)).toBe('$1.99')
  })

  it('groups thousands', () => {
    expect(formatUsd(1250)).toBe('$1,250')
  })
})
