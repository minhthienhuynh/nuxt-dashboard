import { websiteQuerySchema } from '~~/server/validators/website.schema'
import { WebsiteService } from '~~/server/services/website.service'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const validated = websiteQuerySchema.parse(query)
    return await WebsiteService.list(validated)
  } catch (error) {
    throw handleError(error)
  }
})
