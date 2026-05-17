import { readBody } from 'h3'
import { ServiceService } from '~~/server/services/service.service'
import { createServiceSchema } from '~~/server/validators/service.schema'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const input = createServiceSchema.parse(body)
    return ServiceService.create(input)
  } catch (error) {
    throw handleError(error)
  }
})
