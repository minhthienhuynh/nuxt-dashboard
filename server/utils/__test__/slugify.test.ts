import { describe, it, expect } from 'vitest'
import { slugify } from '../../utils/slugify'

describe('slugify', () => {
  it('converts lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('replaces spaces with dashes', () => {
    expect(slugify('my website name')).toBe('my-website-name')
  })

  it('removes special characters', () => {
    expect(slugify('hello! world?')).toBe('hello-world')
  })

  it('removes Vietnamese diacritics', () => {
    expect(slugify('Tiếng Việt')).toBe('tieng-viet')
  })

  it('handles Vietnamese đ/Đ', () => {
    expect(slugify('đường phố')).toBe('duong-pho')
    expect(slugify('Đường Phố')).toBe('duong-pho')
  })

  it('preserves leading/trailing dashes from raw dash input', () => {
    // radash `dash` does not trim leading/trailing dashes;
    // slugify passes through whatever dash produces.
    expect(slugify('---hello---')).toBe('---hello---')
  })

  it('preserves multiple dashes from multi-space input', () => {
    // radash `dash` maps each whitespace run to a single dash,
    // but non-space dashes in the original string survive.
    expect(slugify('hello---world')).toBe('hello---world')
  })

  it('returns "unnamed" for empty or all-special-chars input', () => {
    expect(slugify('')).toBe('unnamed')
    expect(slugify('!!!')).toBe('unnamed')
  })
})
