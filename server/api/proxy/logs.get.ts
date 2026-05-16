import { getQuery } from 'h3'
import { ProxyRepository } from '~~/server/repositories/proxy.repository'
import { DockerService } from '~~/server/services/docker.service'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const tail = Number(query.tail) || 100
    const proxy = await ProxyRepository.getOrCreate()
    const logs = await DockerService.getLogs(proxy.type, tail)
    return { containerName: proxy.type, logs }
  } catch (error) {
    return handleError(error)
  }
})
