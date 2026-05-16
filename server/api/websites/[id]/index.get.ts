import { getRouterParam } from 'h3'
import { websiteIdSchema } from '~~/server/validators/website.schema'
import { WebsiteService } from '~~/server/services/website.service'
import { DockerService } from '~~/server/services/docker.service'
import { websiteContainerName } from '~~/server/utils/slugify'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = websiteIdSchema.parse(getRouterParam(event, 'id'))
    const website = await WebsiteService.getById(id)
    const statuses = await DockerService.getContainerStatuses()
    const dockerStatus = statuses.get(websiteContainerName(website.name))
    if (dockerStatus) {
      ;(website as any).status = dockerStatus
    }
    return website as any as import('~/types').Website
  } catch (error) {
    throw handleError(error)
  }
})
