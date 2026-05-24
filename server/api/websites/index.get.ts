import { getQuery } from 'h3'
import { websiteQuerySchema } from '~~/server/validators/website.schema'
import { WebsiteService } from '~~/server/services/website.service'
import { DockerContainerService } from '~~/server/services/docker-container.service'
import { websiteContainerName } from '~~/server/utils/slugify'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const validated = websiteQuerySchema.parse(query)
    const websites = await WebsiteService.list(validated)
    const statuses = await DockerContainerService.getContainerStatuses()
    for (const w of websites) {
      const dockerStatus = statuses.get(websiteContainerName(w.name))
      ;(w as unknown as { status: string }).status = dockerStatus || 'unknown'
    }
    return websites as unknown as import('~/types').Website[]
  } catch (error) {
    throw handleError(error)
  }
})
