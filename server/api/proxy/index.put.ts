import { readBody } from 'h3'
import { ProxyRepository } from '~~/server/repositories/proxy.repository'
import { ProxyConfigService } from '~~/server/services/proxy-config.service'
import { updateProxySchema } from '~~/server/validators/proxy.schema'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const input = updateProxySchema.parse(body)
    const result = await ProxyRepository.update(input)
    if (input.type !== undefined) {
      await ProxyConfigService.generateAll()
    }
    return result
  } catch (error) {
    throw handleError(error)
  }
})
