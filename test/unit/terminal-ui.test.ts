import { describe, expect, it } from 'vitest'
import { FONT_FAMILY_DEFAULT, FONT_SIZE_DEFAULT, FONT_SIZE_MAX, FONT_SIZE_MIN, TERMINAL_FONTS, clampFontSize, formatSshTarget, resolveFontStack } from '../../layers/termius/app/utils/terminal'
import { TERMINAL_THEMES, THEME_DEFAULT, resolveTheme, terminalTheme } from '../../layers/termius/app/utils/terminal-theme'

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

describe('resolveTheme', () => {
  it('resolves a known theme id to its palette', () => {
    expect(resolveTheme('light').background).toBe('#ffffff')
    expect(resolveTheme('dark').background).toBe('#18181b')
  })

  it('falls back to the default theme for an unknown id', () => {
    const fallback = resolveTheme('does-not-exist')
    const expected = TERMINAL_THEMES.find(t => t.id === THEME_DEFAULT)!.palette
    expect(fallback).toEqual(expected)
  })
})

describe('resolveFontStack', () => {
  it('resolves a known font id to a stack ending in monospace', () => {
    for (const font of TERMINAL_FONTS) {
      expect(resolveFontStack(font.id)).toMatch(/monospace$/)
    }
  })

  it('falls back to the default font for an unknown id', () => {
    const expected = TERMINAL_FONTS.find(f => f.id === FONT_FAMILY_DEFAULT)!.stack
    expect(resolveFontStack('does-not-exist')).toBe(expected)
  })
})
