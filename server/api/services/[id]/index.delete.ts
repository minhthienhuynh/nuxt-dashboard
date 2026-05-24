import { getRouterParam } from 'h3'
import { ServiceService } from '~~/server/services/service.service'
import { DockerContainerService } from '~~/server/services/docker-container.service'
import { serviceIdSchema } from '~~/server/validators/service.schema'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = serviceIdSchema.parse(getRouterParam(event, 'id'))
    const service = await ServiceService.getById(id)
    await DockerContainerService.stopAndRemoveContainer(service.containerName)
    return ServiceService.remove(id)
  } catch (error) {
    throw handleError(error)
  }
})
