import { ServiceRepository } from '~~/server/repositories/service.repository'
import { ProxyRepository } from '~~/server/repositories/proxy.repository'
import { handleError } from '~~/server/utils/errors'

const APP_NAME = process.env.APP_NAME || 'lardo'

interface ServicePort { hostPort: string, containerPort: string, protocol?: string | null }
interface ServiceEnvVar { key: string, value: string }
interface ServiceVolume { source: string, target: string }

interface ServiceForCompose {
  enabled: boolean
  imageOverride?: string | null
  serviceType?: { defaultImage?: string | null } | null
  containerName: string
  ports?: ServicePort[]
  envVars?: ServiceEnvVar[]
  volumes?: ServiceVolume[]
}

export default eventHandler(async () => {
  try {
    const [services, proxy] = await Promise.all([
      ServiceRepository.findAllServices(),
      ProxyRepository.getOrCreate()
    ])

    const blocks = (services as ServiceForCompose[]).filter(s => s.enabled).map((svc) => {
      const image = svc.imageOverride || svc.serviceType?.defaultImage || 'alpine'
      const ports = (svc.ports || []).map(p =>
        `      - '${p.hostPort}:${p.containerPort}${p.protocol === 'udp' ? '/udp' : ''}'`)
      const env = (svc.envVars || []).map(e =>
        `      ${e.key}: '${e.value}'`)
      const vols = (svc.volumes || []).map(v =>
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
