import { getRouterParam } from 'h3'
import { websiteIdSchema } from '~~/server/validators/website.schema'
import { WebsiteService } from '~~/server/services/website.service'
import { DockerContainerService } from '~~/server/services/docker-container.service'
import { websiteContainerName } from '~~/server/utils/slugify'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = websiteIdSchema.parse(getRouterParam(event, 'id'))
    const website = await WebsiteService.getById(id)
    const statuses = await DockerContainerService.getContainerStatuses()
    const dockerStatus = statuses.get(websiteContainerName(website.name))
    ;(website as unknown as { status: string }).status = dockerStatus || 'unknown'
    return website as unknown as import('~/types').Website
  } catch (error) {
    throw handleError(error)
  }
})
