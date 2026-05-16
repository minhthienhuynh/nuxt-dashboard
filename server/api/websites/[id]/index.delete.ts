import { websiteIdSchema } from '~~/server/validators/website.schema'
import { WebsiteService } from '~~/server/services/website.service'
import { ProxyConfigService } from '~~/server/services/proxy-config.service'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = websiteIdSchema.parse(getRouterParam(event, 'id'))
    const website = await WebsiteService.getById(id)
    const websiteName = website.name
    await WebsiteService.remove(id)
    ProxyConfigService.removeForWebsite(websiteName)
    return { success: true }
  } catch (error) {
    throw handleError(error)
  }
})
