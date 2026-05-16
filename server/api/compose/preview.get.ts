import { ServiceRepository } from '~~/server/repositories/service.repository'
import { ProxyRepository } from '~~/server/repositories/proxy.repository'

export default eventHandler(async () => {
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
      '      - lardo'
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
    '  lardo:',
    '    name: lardo'
  ].join('\n')

  return { yaml }
})
