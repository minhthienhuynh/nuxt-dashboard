import { getRouterParam, readBody } from 'h3'
import { websiteIdSchema, websiteExtensionsSchema } from '~~/server/validators/website.schema'
import { WebsiteService } from '~~/server/services/website.service'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = websiteIdSchema.parse(getRouterParam(event, 'id'))
    const body = await readBody(event)
    const validated = websiteExtensionsSchema.parse(body)
    return await WebsiteService.updateExtensions(id, validated)
  } catch (error) {
    throw handleError(error)
  }
})
