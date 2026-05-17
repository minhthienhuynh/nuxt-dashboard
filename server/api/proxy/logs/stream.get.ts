import { getQuery } from 'h3'
import { ProxyRepository } from '~~/server/repositories/proxy.repository'
import { streamContainerLogs } from '~~/server/utils/sse-logs'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const tail = Number(query.tail) || 100
    const proxy = await ProxyRepository.getOrCreate()
    return streamContainerLogs(event, proxy.type, tail)
  } catch (error) {
    throw handleError(error)
  }
})
