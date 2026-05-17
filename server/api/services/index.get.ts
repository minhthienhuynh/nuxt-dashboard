import { ServiceService } from '~~/server/services/service.service'
import { DockerService } from '~~/server/services/docker.service'
import { getQuery } from 'h3'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event)
    if (query.types === 'only') {
      return ServiceService.listTypes()
    }
    const services = await ServiceService.listServices()
    const statuses = await DockerService.getContainerStatuses()
    for (const svc of services) {
      const dockerStatus = statuses.get(svc.containerName)
      if (dockerStatus) {
        ;(svc as unknown as { status: string }).status = dockerStatus
      }
    }
    return services as unknown as import('~/types').InfrastructureService[]
  } catch (error) {
    throw handleError(error)
  }
})
