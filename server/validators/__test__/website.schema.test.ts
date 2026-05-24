import { describe, it, expect } from 'vitest'
import { websiteIdSchema, websiteCreateSchema, websiteUpdateSchema, websiteTypeSchema, websiteQuerySchema } from '../website.schema'

describe('websiteIdSchema', () => {
  it('coerces string to number', () => {
    expect(websiteIdSchema.parse('42')).toBe(42)
  })

  it('rejects negative numbers', () => {
    expect(() => websiteIdSchema.parse(-1)).toThrow()
    expect(() => websiteIdSchema.parse('-1')).toThrow()
  })

  it('rejects zero', () => {
    expect(() => websiteIdSchema.parse(0)).toThrow()
    expect(() => websiteIdSchema.parse('0')).toThrow()
  })

  it('rejects non-integer', () => {
    expect(() => websiteIdSchema.parse('3.14')).toThrow()
    expect(() => websiteIdSchema.parse(1.5)).toThrow()
  })

  it('accepts positive integer', () => {
    expect(websiteIdSchema.parse(1)).toBe(1)
    expect(websiteIdSchema.parse('100')).toBe(100)
  })
})

describe('websiteCreateSchema', () => {
  const validInput = {
    name: 'Test Site',
    domain: 'test.example.com',
    documentRoot: '/var/www/test',
    phpVersion: '8.4'
  }

  it('accepts valid input with defaults', () => {
    const result = websiteCreateSchema.parse(validInput)

    expect(result.name).toBe('Test Site')
    expect(result.domain).toBe('test.example.com')
    expect(result.documentRoot).toBe('/var/www/test')
    expect(result.phpVersion).toBe('8.4')
    expect(result.type).toBe('php-fpm')
    expect(result.port).toBe(0)
    expect(result.sslEnabled).toBe(false)
  })

  it('rejects empty name', () => {
    expect(() => websiteCreateSchema.parse({ ...validInput, name: '' })).toThrow()
  })

  it('rejects missing domain', () => {
    expect(() => websiteCreateSchema.parse({ ...validInput, domain: '' })).toThrow()
  })

  it('rejects missing documentRoot', () => {
    expect(() => websiteCreateSchema.parse({ ...validInput, documentRoot: '' })).toThrow()
  })

  it('rejects missing phpVersion', () => {
    expect(() => websiteCreateSchema.parse({ ...validInput, phpVersion: '' })).toThrow()
  })

  it('rejects invalid type', () => {
    expect(() => websiteCreateSchema.parse({ ...validInput, type: 'invalid' })).toThrow()
  })

  it('coerces port from string to number', () => {
    const result = websiteCreateSchema.parse({ ...validInput, port: '8080' })
    expect(result.port).toBe(8080)
    expect(typeof result.port).toBe('number')
  })

  it('rejects port out of range', () => {
    expect(() => websiteCreateSchema.parse({ ...validInput, port: -1 })).toThrow()
    expect(() => websiteCreateSchema.parse({ ...validInput, port: 99999 })).toThrow()
  })
})

describe('websiteUpdateSchema', () => {
  it('allows partial update with empty object', () => {
    const result = websiteUpdateSchema.parse({})
    expect(result).toEqual({})
  })

  it('allows updating single field', () => {
    const result = websiteUpdateSchema.parse({ name: 'New Name' })
    expect(result.name).toBe('New Name')
  })

  it('rejects empty name if provided', () => {
    expect(() => websiteUpdateSchema.parse({ name: '' })).toThrow()
  })
})

describe('websiteTypeSchema', () => {
  it('accepts valid types', () => {
    expect(websiteTypeSchema.parse('php-fpm')).toBe('php-fpm')
    expect(websiteTypeSchema.parse('php-serve')).toBe('php-serve')
    expect(websiteTypeSchema.parse('php-octane')).toBe('php-octane')
  })

  it('rejects invalid type', () => {
    expect(() => websiteTypeSchema.parse('node')).toThrow()
  })
})

describe('websiteQuerySchema', () => {
  it('accepts empty query', () => {
    expect(websiteQuerySchema.parse({})).toEqual({})
  })

  it('accepts phpVersion and search', () => {
    const result = websiteQuerySchema.parse({ phpVersion: '8.4', search: 'blog' })
    expect(result.phpVersion).toBe('8.4')
    expect(result.search).toBe('blog')
  })
})
