import { describe, it, expect } from 'vitest'
import { AppError } from '../../utils/errors'

describe('AppError', () => {
  it('creates an error with message and statusCode', () => {
    const error = new AppError('Not found', 404)

    expect(error.message).toBe('Not found')
    expect(error.statusCode).toBe(404)
    expect(error.name).toBe('AppError')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(AppError)
  })

  it('defaults to given status code', () => {
    expect(new AppError('Bad request', 400).statusCode).toBe(400)
    expect(new AppError('Server error', 500).statusCode).toBe(500)
  })
})
