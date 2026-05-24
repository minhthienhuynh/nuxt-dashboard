import { DockerContainerService } from '~~/server/services/docker-container.service'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async () => {
  try {
    return await DockerContainerService.listLardoContainers()
  } catch (error) {
    throw handleError(error)
  }
})
