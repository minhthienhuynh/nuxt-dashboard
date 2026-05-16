import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function handleError(error: unknown) {
  if (error instanceof ZodError) {
    const messages = error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
    throw createError({
      statusCode: 400,
      statusMessage: `Validation failed: ${messages.join('; ')}`
    })
  }

  if (error instanceof AppError) {
    throw createError({
      statusCode: error.statusCode,
      statusMessage: error.message
    })
  }

  console.error(error)
  throw createError({
    statusCode: 500,
    statusMessage: error instanceof Error ? error.message : 'Internal Server Error'
  })
}
