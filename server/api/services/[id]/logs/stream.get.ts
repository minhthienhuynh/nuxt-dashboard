import { getRouterParam, getQuery } from 'h3'
import { ServiceService } from '~~/server/services/service.service'
import { serviceIdSchema } from '~~/server/validators/service.schema'
import { streamContainerLogs } from '~~/server/utils/sse-logs'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = serviceIdSchema.parse(getRouterParam(event, 'id'))
    const query = getQuery(event)
    const tail = Number(query.tail) || 100
    const service = await ServiceService.getById(id)
    return streamContainerLogs(event, service.containerName, tail)
  } catch (error) {
    throw handleError(error)
  }
})
