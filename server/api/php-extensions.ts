import { getQuery } from 'h3'
import { PhpExtensionRepository } from '~~/server/repositories/php-extension.repository'

export default eventHandler(async (event) => {
  const query = getQuery(event)
  const { php, type, search } = query as Record<string, string>
  return PhpExtensionRepository.findAll({ php, type, search })
})
