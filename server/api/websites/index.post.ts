import { websiteCreateSchema } from '~~/server/validators/website.schema'
import { WebsiteService } from '~~/server/services/website.service'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const validated = websiteCreateSchema.parse(body)
    return await WebsiteService.create(validated)
  } catch (error) {
    throw handleError(error)
  }
})
