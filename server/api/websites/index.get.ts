import { getQuery } from 'h3'
import { websiteQuerySchema } from '~~/server/validators/website.schema'
import { WebsiteService } from '~~/server/services/website.service'
import { DockerService } from '~~/server/services/docker.service'
import { websiteContainerName } from '~~/server/utils/slugify'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const validated = websiteQuerySchema.parse(query)
    const websites = await WebsiteService.list(validated)
    const statuses = await DockerService.getContainerStatuses()
    for (const w of websites) {
      const dockerStatus = statuses.get(websiteContainerName(w.name))
      if (dockerStatus) {
        ;(w as any).status = dockerStatus
      }
    }
    return websites as any as import('~/types').Website[]
  } catch (error) {
    throw handleError(error)
  }
})
