import { getRouterParam, readBody } from 'h3'
import { ServiceService } from '~~/server/services/service.service'
import { updateServiceSchema, serviceIdSchema } from '~~/server/validators/service.schema'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = serviceIdSchema.parse(getRouterParam(event, 'id'))
    const body = await readBody(event)
    const input = updateServiceSchema.parse(body)
    return ServiceService.update(id, input)
  } catch (error) {
    return handleError(error)
  }
})
