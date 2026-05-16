import { getRouterParam } from 'h3'
import { ServiceService } from '~~/server/services/service.service'
import { serviceIdSchema } from '~~/server/validators/service.schema'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = serviceIdSchema.parse(getRouterParam(event, 'id'))
    return ServiceService.remove(id)
  } catch (error) {
    return handleError(error)
  }
})
