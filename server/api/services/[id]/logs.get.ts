import { getRouterParam, getQuery } from 'h3'
import { ServiceService } from '~~/server/services/service.service'
import { DockerService } from '~~/server/services/docker.service'
import { serviceIdSchema } from '~~/server/validators/service.schema'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = serviceIdSchema.parse(getRouterParam(event, 'id'))
    const query = getQuery(event)
    const tail = Number(query.tail) || 100
    const service = await ServiceService.getById(id)
    const logs = await DockerService.getLogs(service.containerName, tail)
    return { containerName: service.containerName, logs }
  } catch (error) {
    return handleError(error)
  }
})
