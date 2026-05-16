import { ProxyRepository } from '~~/server/repositories/proxy.repository'
import { DockerService } from '~~/server/services/docker.service'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const proxy = await ProxyRepository.getOrCreate()
    await DockerService.stopProxy(proxy.type)
    return { status: 'stopped', containerName: proxy.type }
  } catch (error) {
    return handleError(error)
  }
})
