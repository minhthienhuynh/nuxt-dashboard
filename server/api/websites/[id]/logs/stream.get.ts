import { getRouterParam, getQuery } from 'h3'
import { WebsiteService } from '~~/server/services/website.service'
import { websiteContainerName } from '~~/server/utils/slugify'
import { websiteIdSchema } from '~~/server/validators/website.schema'
import { streamContainerLogs } from '~~/server/utils/sse-logs'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = websiteIdSchema.parse(getRouterParam(event, 'id'))
    const query = getQuery(event)
    const tail = Number(query.tail) || 100
    const website = await WebsiteService.getById(id)
    const containerName = websiteContainerName(website.name)
    return streamContainerLogs(event, containerName, tail)
  } catch (error) {
    throw handleError(error)
  }
})
