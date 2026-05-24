import { ServiceService } from '~~/server/services/service.service'
import { DockerContainerService } from '~~/server/services/docker-container.service'
import { SERVICE_DEFAULTS } from '~~/server/utils/service-defaults'
import { getQuery } from 'h3'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event)
    if (query.types === 'only') {
      const types = await ServiceService.listTypes()
      return types.map(t => ({
        ...t,
        requiredEnv: SERVICE_DEFAULTS[t.key]?.requiredEnv || null
      }))
    }
    const services = await ServiceService.listServices()
    const statuses = await DockerContainerService.getContainerStatuses()
    for (const svc of services) {
      const dockerStatus = statuses.get(svc.containerName)
      ;(svc as unknown as { status: string }).status = dockerStatus || 'unknown'
    }
    return services as unknown as import('~/types').InfrastructureService[]
  } catch (error) {
    throw handleError(error)
  }
})
