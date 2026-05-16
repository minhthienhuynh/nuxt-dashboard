import { DockerService } from '~~/server/services/docker.service'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async () => {
  try {
    return DockerService.listLardoContainers()
  } catch (error) {
    return handleError(error)
  }
})
