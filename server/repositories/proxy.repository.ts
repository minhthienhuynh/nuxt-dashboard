import type { UpdateProxyInput } from '../validators/proxy.schema'

export const ProxyRepository = {
  get() {
    return prisma.proxyConfig.findFirst()
  },

  async getOrCreate() {
    let config = await prisma.proxyConfig.findFirst()
    if (!config) {
      config = await prisma.proxyConfig.create({
        data: { type: 'caddy', httpPort: 80, httpsPort: 443, adminPort: 8080, domain: '*.test' }
      })
    }
    return config
  },

  async update(data: UpdateProxyInput) {
    const config = await ProxyRepository.getOrCreate()
    return prisma.proxyConfig.update({
      where: { id: config.id },
      data: {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.httpPort !== undefined ? { httpPort: data.httpPort } : {}),
        ...(data.httpsPort !== undefined ? { httpsPort: data.httpsPort } : {}),
        ...(data.adminPort !== undefined ? { adminPort: data.adminPort } : {}),
        ...(data.domain !== undefined ? { domain: data.domain } : {})
      }
    })
  }
}
