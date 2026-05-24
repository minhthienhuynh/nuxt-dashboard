import { ProxyRepository } from '~~/server/repositories/proxy.repository'
import { DockerContainerService } from '~~/server/services/docker-container.service'

export default eventHandler(async () => {
  const proxy = await ProxyRepository.getOrCreate()
  const statuses = await DockerContainerService.getContainerStatuses()
  const dockerStatus = statuses.get(proxy.type)
  return { ...proxy, status: dockerStatus || 'stopped' }
})
