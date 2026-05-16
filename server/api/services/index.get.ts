import { ServiceService } from '~~/server/services/service.service'
import { DockerService } from '~~/server/services/docker.service'
import { getQuery } from 'h3'

export default eventHandler(async (event) => {
  const query = getQuery(event)
  if (query.types === 'only') {
    return ServiceService.listTypes()
  }
  const services = await ServiceService.listServices()
  const statuses = await DockerService.getContainerStatuses()
  for (const svc of services) {
    const dockerStatus = statuses.get(svc.containerName)
    if (dockerStatus) {
      ;(svc as any).status = dockerStatus
    }
  }
  return services as any as import('~/types').InfrastructureService[]
})
