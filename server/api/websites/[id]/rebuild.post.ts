import { getRouterParam } from 'h3'
import { WebsiteService } from '~~/server/services/website.service'
import { DockerDeploymentService } from '~~/server/services/docker-deployment.service'
import { websiteIdSchema } from '~~/server/validators/website.schema'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = websiteIdSchema.parse(getRouterParam(event, 'id'))
    const website = await WebsiteService.getById(id)
    await DockerDeploymentService.rebuildWebsite(website as unknown as import('~/types').Website)
    return { status: 'running' }
  } catch (error) {
    throw handleError(error)
  }
})
