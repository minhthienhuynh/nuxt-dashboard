import { ProxyRepository } from '~~/server/repositories/proxy.repository'
import { DockerDeploymentService } from '~~/server/services/docker-deployment.service'
import { ProxyConfigService } from '~~/server/services/proxy-config.service'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (_event) => {
  try {
    // Regenerate proxy config before deploy
    await ProxyConfigService.generateAll()
    const proxy = await ProxyRepository.getOrCreate()
    await DockerDeploymentService.deployProxy(proxy)
    return { status: 'running', containerName: proxy.type }
  } catch (error) {
    throw handleError(error)
  }
})
