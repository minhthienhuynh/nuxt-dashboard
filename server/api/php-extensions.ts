import { getQuery } from 'h3'
import { z } from 'zod'
import { PhpExtensionRepository } from '~~/server/repositories/php-extension.repository'
import { handleError } from '~~/server/utils/errors'

const phpExtensionsQuerySchema = z.object({
  php: z.string().optional(),
  type: z.string().optional(),
  search: z.string().optional()
})

export default eventHandler(async (event) => {
  try {
    const query = phpExtensionsQuerySchema.parse(getQuery(event))
    return PhpExtensionRepository.findAll(query)
  } catch (error) {
    throw handleError(error)
  }
})
