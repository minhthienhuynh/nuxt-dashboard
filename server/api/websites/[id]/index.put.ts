import { websiteIdSchema, websiteUpdateSchema } from '~~/server/validators/website.schema'
import { WebsiteService } from '~~/server/services/website.service'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = websiteIdSchema.parse(getRouterParam(event, 'id'))
    const body = await readBody(event)
    const validated = websiteUpdateSchema.parse(body)
    return await WebsiteService.update(id, validated)
  } catch (error) {
    throw handleError(error)
  }
})
