import { ProxyRepository } from '~~/server/repositories/proxy.repository'
import { DockerDeploymentService } from '~~/server/services/docker-deployment.service'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (_event) => {
  try {
    const proxy = await ProxyRepository.getOrCreate()
    await DockerDeploymentService.stopProxy(proxy.type)
    return { status: 'stopped', containerName: proxy.type }
  } catch (error) {
    throw handleError(error)
  }
})
