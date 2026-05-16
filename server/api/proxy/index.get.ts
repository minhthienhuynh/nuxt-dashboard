import { ProxyRepository } from '~~/server/repositories/proxy.repository'

export default eventHandler(async () => {
  return ProxyRepository.getOrCreate()
})
