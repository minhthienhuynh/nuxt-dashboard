import { ServiceService } from '~~/server/services/service.service'
import { getQuery } from 'h3'

export default eventHandler(async (event) => {
  const query = getQuery(event)
  if (query.types === 'only') {
    return ServiceService.listTypes()
  }
  return ServiceService.listServices()
})
