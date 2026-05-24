import { getRouterParam } from 'h3'
import { WebsiteService } from '~~/server/services/website.service'
import { DockerContainerService } from '~~/server/services/docker-container.service'
import { websiteContainerName } from '~~/server/utils/slugify'
import { websiteIdSchema } from '~~/server/validators/website.schema'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = websiteIdSchema.parse(getRouterParam(event, 'id'))
    const website = await WebsiteService.getById(id)
    const cName = websiteContainerName(website.name)
    await DockerContainerService.restartContainer(cName)
    return { status: 'running', containerName: cName }
  } catch (error) {
    throw handleError(error)
  }
})
