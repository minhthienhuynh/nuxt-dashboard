import { describe, expect, it } from 'vitest'
import { OS_META, osMeta } from '../../layers/termius/app/utils/os'

describe('osMeta', () => {
  it('maps a known OS id to its icon and colour metadata', () => {
    expect(osMeta('ubuntu')).toEqual(OS_META.ubuntu)
    expect(osMeta('ubuntu').icon).toBe('i-simple-icons-ubuntu')
    expect(osMeta('ubuntu').color).toBe('#E95420')
  })

  it('returns a monochrome entry (no colour) for macOS', () => {
    expect(osMeta('macos').icon).toBe('i-simple-icons-apple')
    expect(osMeta('macos').color).toBeUndefined()
  })

  it('falls back to the generic monitor icon for an unknown id', () => {
    expect(osMeta('plan9')).toEqual({ icon: 'i-lucide-monitor' })
  })

  it('falls back for null or undefined', () => {
    expect(osMeta(null)).toEqual({ icon: 'i-lucide-monitor' })
    expect(osMeta(undefined)).toEqual({ icon: 'i-lucide-monitor' })
  })

  it('falls back for an empty string', () => {
    expect(osMeta('')).toEqual({ icon: 'i-lucide-monitor' })
  })
})
