import { ProxyRepository } from '~~/server/repositories/proxy.repository'
import { DockerService } from '~~/server/services/docker.service'

export default eventHandler(async () => {
  const proxy = await ProxyRepository.getOrCreate()
  const statuses = await DockerService.getContainerStatuses()
  const dockerStatus = statuses.get(proxy.type)
  return { ...proxy, status: dockerStatus || 'stopped' }
})
