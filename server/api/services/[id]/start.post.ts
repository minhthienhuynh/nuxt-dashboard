import { getRouterParam } from 'h3'
import { ServiceService } from '~~/server/services/service.service'
import { DockerContainerService } from '~~/server/services/docker-container.service'
import { DockerDeploymentService } from '~~/server/services/docker-deployment.service'
import { serviceIdSchema } from '~~/server/validators/service.schema'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = serviceIdSchema.parse(getRouterParam(event, 'id'))
    const service = await ServiceService.getById(id)
    const exists = await DockerContainerService.containerExists(service.containerName)
    if (exists) {
      await DockerContainerService.startContainer(service.containerName)
    } else {
      await DockerDeploymentService.deployService(service as unknown as import('~/types').InfrastructureService)
    }
    const status = await DockerContainerService.getContainerStatus(service.containerName)
    return { status, containerName: service.containerName }
  } catch (error) {
    throw handleError(error)
  }
})
