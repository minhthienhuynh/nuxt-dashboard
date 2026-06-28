import { describe, expect, it } from 'vitest'
import { FONT_SIZE_DEFAULT, FONT_SIZE_MAX, FONT_SIZE_MIN, clampFontSize, formatSshTarget } from '../../layers/termius/app/utils/terminal'
import { terminalTheme } from '../../layers/termius/app/utils/terminal-theme'

describe('formatSshTarget', () => {
  it('renders user@host:port when a username is present', () => {
    expect(formatSshTarget({ username: 'root', address: '36.50.177.250', port: 22 })).toBe('root@36.50.177.250:22')
  })

  it('falls back to host:port when username is missing or blank', () => {
    expect(formatSshTarget({ username: null, address: '10.0.0.1', port: 2222 })).toBe('10.0.0.1:2222')
    expect(formatSshTarget({ username: undefined, address: '10.0.0.1', port: 22 })).toBe('10.0.0.1:22')
    expect(formatSshTarget({ username: '   ', address: '10.0.0.1', port: 22 })).toBe('10.0.0.1:22')
  })

  it('trims surrounding whitespace from the username', () => {
    expect(formatSshTarget({ username: '  admin ', address: 'host', port: 22 })).toBe('admin@host:22')
  })
})

describe('clampFontSize', () => {
  it('keeps a value within range unchanged', () => {
    expect(clampFontSize(FONT_SIZE_DEFAULT)).toBe(FONT_SIZE_DEFAULT)
  })

  it('clamps below the minimum and above the maximum', () => {
    expect(clampFontSize(FONT_SIZE_MIN - 5)).toBe(FONT_SIZE_MIN)
    expect(clampFontSize(FONT_SIZE_MAX + 5)).toBe(FONT_SIZE_MAX)
  })

  it('rounds fractional sizes', () => {
    expect(clampFontSize(13.6)).toBe(14)
  })
})

describe('terminalTheme', () => {
  it('returns distinct light and dark palettes', () => {
    const light = terminalTheme('light')
    const dark = terminalTheme('dark')
    expect(light.background).toBe('#ffffff')
    expect(dark.background).toBe('#18181b')
    expect(light.background).not.toBe(dark.background)
  })
})
