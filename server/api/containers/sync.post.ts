import { DockerService } from '~~/server/services/docker.service'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async () => {
  try {
    const result = await DockerService.syncContainersWithDB()
    return result
  } catch (error) {
    return handleError(error)
  }
})
