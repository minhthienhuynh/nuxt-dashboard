import { ServiceRepository } from '~~/server/repositories/service.repository'
import { ProxyRepository } from '~~/server/repositories/proxy.repository'
import { handleError } from '~~/server/utils/errors'

const APP_NAME = process.env.APP_NAME || 'lardo'

export default eventHandler(async () => {
  try {
    const [services, proxy] = await Promise.all([
      ServiceRepository.findAllServices(),
      ProxyRepository.getOrCreate()
    ])

    const blocks = services.filter((s: any) => s.enabled).map((svc: any) => {
      const image = svc.imageOverride || svc.serviceType?.defaultImage || 'alpine'
      const ports = (svc.ports || []).map((p: any) =>
        `      - '${p.hostPort}:${p.containerPort}${p.protocol === 'udp' ? '/udp' : ''}'`)
      const env = (svc.envVars || []).map((e: any) =>
        `      ${e.key}: '${e.value}'`)
      const vols = (svc.volumes || []).map((v: any) =>
        `      - '${v.source}:${v.target}'`)

      return [
        `  ${svc.containerName}:`,
        `    image: '${image}'`,
        ports.length ? '    ports:' : null,
        ...ports,
        env.length ? '    environment:' : null,
        ...env,
        vols.length ? '    volumes:' : null,
        ...vols,
        '    networks:',
        `      - ${APP_NAME}_proxy`
      ].filter(Boolean).join('\n')
    })

    const yaml = [
      `# Preview generated at ${new Date().toISOString()}`,
      `# Proxy: ${proxy.type} (${proxy.httpPort}:${proxy.httpsPort})`,
      '',
      'services:',
      ...blocks,
      '',
      'networks:',
      `  ${APP_NAME}_proxy:`,
      `    name: ${APP_NAME}_proxy`
    ].join('\n')

    return { yaml }
  } catch (error) {
    throw handleError(error)
  }
})
