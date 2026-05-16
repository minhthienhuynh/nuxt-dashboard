import { websiteIdSchema, websiteUpdateSchema } from '~~/server/validators/website.schema'
import { WebsiteService } from '~~/server/services/website.service'
import { ProxyConfigService } from '~~/server/services/proxy-config.service'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = websiteIdSchema.parse(getRouterParam(event, 'id'))
    const body = await readBody(event)
    const validated = websiteUpdateSchema.parse(body)
    const website = await WebsiteService.update(id, validated)
    await ProxyConfigService.generateForWebsite(website)
    return website
  } catch (error) {
    throw handleError(error)
  }
})
