import { DockerService } from '~~/server/services/docker.service'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async () => {
  try {
    return await DockerService.listLardoContainers()
  } catch (error) {
    throw handleError(error)
  }
})
