import { getRouterParam } from 'h3'
import { ServiceService } from '~~/server/services/service.service'
import { DockerService } from '~~/server/services/docker.service'
import { serviceIdSchema } from '~~/server/validators/service.schema'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = serviceIdSchema.parse(getRouterParam(event, 'id'))
    const service = await ServiceService.getById(id)
    const exists = await DockerService.containerExists(service.containerName)
    if (exists) {
      await DockerService.startContainer(service.containerName)
    } else {
      await DockerService.deployService(service as unknown as import('~/types').InfrastructureService)
    }
    const status = await DockerService.getContainerStatus(service.containerName)
    return { status, containerName: service.containerName }
  } catch (error) {
    throw handleError(error)
  }
})
