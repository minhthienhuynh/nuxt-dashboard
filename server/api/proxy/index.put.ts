import { readBody } from 'h3'
import { ProxyRepository } from '~~/server/repositories/proxy.repository'
import { updateProxySchema } from '~~/server/validators/proxy.schema'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const input = updateProxySchema.parse(body)
    return ProxyRepository.update(input)
  } catch (error) {
    return handleError(error)
  }
})
