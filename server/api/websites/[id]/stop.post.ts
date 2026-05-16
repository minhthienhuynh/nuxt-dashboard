import { getRouterParam } from 'h3'
import { WebsiteService } from '~~/server/services/website.service'
import { DockerService } from '~~/server/services/docker.service'
import { websiteContainerName } from '~~/server/utils/slugify'
import { websiteIdSchema } from '~~/server/validators/website.schema'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = websiteIdSchema.parse(getRouterParam(event, 'id'))
    const website = await WebsiteService.getById(id)
    const cName = websiteContainerName(website.name)
    await DockerService.stopContainer(cName)
    return { status: 'stopped', containerName: cName }
  } catch (error) {
    return handleError(error)
  }
})
