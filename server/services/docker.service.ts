import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { getDocker } from '../utils/docker'
import { ServiceRepository } from '../repositories/service.repository'
import { WebsiteRepository } from '../repositories/website.repository'
import type { InfrastructureService, Website } from '~/types'

import { slugify, websiteContainerName } from '../utils/slugify'

const LARDO_NETWORK = 'lardo'

export class DockerService {
  // ═══════════════════════════════════════════════════════════
  // Case 1: Pull pre-built image tu registry (MySQL, Redis, ...)
  // ═══════════════════════════════════════════════════════════

  static async pullImage(image: string): Promise<void> {
    const docker = await getDocker()
    const [fromImage, tag = 'latest'] = image.split(':')
    await docker.imageCreate({ fromImage, tag })
  }

  // ═══════════════════════════════════════════════════════════
  // Case 2 & 3: Build PHP image + hash cache
  // Su dung docker CLI cho build vi @docker/node-sdk imageBuild
  // yeu cau tar stream — CLI don gian hon.
  // ═══════════════════════════════════════════════════════════

  static computeBuildHash(phpVersion: string, extensionNames: string[]): string {
    const sorted = [...extensionNames].sort()
    return createHash('sha256').update(`${phpVersion}:${sorted.join(',')}`).digest('hex')
  }

  static extensionToBuildArg(extName: string): string {
    return `INSTALL_${extName.toUpperCase().replace(/-/g, '_')}`
  }

  static buildPhpImage(website: Website): string {
    const imageTag = `${slugify(website.name)}:php-${website.phpVersion}-fpm`

    const extensionNames = website.extensions
      ?.filter((e: any) => e.enabled)
      .map((e: any) => e.extension!.name) ?? []

    const buildArgs: string[] = [
      `PHP_TAG=${website.phpVersion}-fpm`,
      `WORKDIR=/var/www/${slugify(website.name)}`,
      'COMPOSER_VERSION=2',
      'NODE_VERSION=22',
      'WWWGROUP=${WWWGROUP:-1000}',
      'INSTALL_BCMATH=false',
      'INSTALL_GD=false',
      'INSTALL_GRPC=false',
      'INSTALL_PCNTL=false',
      'INSTALL_PDO_MYSQL=false',
      'INSTALL_REDIS=false',
      'INSTALL_SOCKETS=false',
      'INSTALL_SWOOLE=false',
      'INSTALL_XDEBUG=false',
      'INSTALL_ZIP=false',
      'INSTALL_IMAGICK=false',
      'INSTALL_MEMCACHED=false',
      'INSTALL_MONGODB=false',
      'INSTALL_PDO_PGSQL=false',
      'INSTALL_SQLSRV=false'
    ]
    for (const name of extensionNames) {
      buildArgs.push(`${DockerService.extensionToBuildArg(name)}=true`)
    }

    const context = path.resolve(process.cwd(), 'docker/php')
    const buildArgFlags = buildArgs.map(a => `--build-arg "${a}"`).join(' ')

    execSync(`docker build ${buildArgFlags} -t ${imageTag} ${context}`, {
      stdio: 'pipe'
    })

    return imageTag
  }

  static needRebuild(website: Website): boolean {
    const extensionNames = website.extensions
      ?.filter((e: any) => e.enabled)
      .map((e: any) => e.extension!.name) ?? []

    const newHash = DockerService.computeBuildHash(website.phpVersion, extensionNames)
    return (website as any).buildHash !== newHash
  }

  static async ensurePhpImage(website: Website): Promise<{ tag: string, rebuilt: boolean }> {
    if (DockerService.needRebuild(website)) {
      const tag = DockerService.buildPhpImage(website)
      const extensionNames = website.extensions
        ?.filter((e: any) => e.enabled)
        .map((e: any) => e.extension!.name) ?? []
      const newHash = DockerService.computeBuildHash(website.phpVersion, extensionNames)
      await prisma.website.update({
        where: { id: website.id },
        data: { buildHash: newHash }
      })
      return { tag, rebuilt: true }
    }
    return { tag: `${slugify(website.name)}:php-${website.phpVersion}-fpm`, rebuilt: false }
  }

  // ═══════════════════════════════════════════════════════════
  // Container orchestration
  // ═══════════════════════════════════════════════════════════

  static async createAndStartContainer(config: {
    image: string
    name: string
    env?: Record<string, string>
    ports?: { host: string, container: string, proto?: string }[]
    volumes?: { source: string, target: string }[]
    network?: string
  }): Promise<void> {
    const docker = await getDocker()

    const env = config.env ? Object.entries(config.env).map(([k, v]) => `${k}=${v}`) : undefined

    const portBindings: Record<string, Array<{ HostPort: string }>> = {}
    const exposedPorts: Record<string, Record<string, never>> = {}
    if (config.ports) {
      for (const p of config.ports) {
        const key = `${p.container}/${p.proto || 'tcp'}`
        exposedPorts[key] = {}
        portBindings[key] = [{ HostPort: p.host }]
      }
    }

    const binds = config.volumes?.map(v => `${v.source}:${v.target}`)

    // Ensure lardo network exists
    try {
      await docker.networkInspect(LARDO_NETWORK)
    } catch {
      await docker.networkCreate({ Name: LARDO_NETWORK })
    }

    // containerCreate(spec, { name }) — name trong options
    await docker.containerCreate(
      {
        Image: config.image,
        Env: env,
        ExposedPorts: exposedPorts,
        HostConfig: {
          PortBindings: portBindings,
          Binds: binds,
          NetworkMode: config.network || LARDO_NETWORK
        }
      } as any,
      { name: config.name }
    )

    await docker.containerStart(config.name)
  }

  static async stopAndRemoveContainer(name: string): Promise<void> {
    const docker = await getDocker()
    try {
      await docker.containerStop(name)
      await docker.containerDelete(name)
    } catch {
      // Container co the da bi xoa tu ben ngoai
    }
  }

  static async stopContainer(name: string): Promise<void> {
    const docker = await getDocker()
    await docker.containerStop(name)
  }

  static async startContainer(name: string): Promise<void> {
    const docker = await getDocker()
    await docker.containerStart(name)
  }

  static async containerExists(name: string): Promise<boolean> {
    const docker = await getDocker()
    try {
      await docker.containerInspect(name)
      return true
    } catch {
      return false
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Deploy
  // ═══════════════════════════════════════════════════════════

  static async deployProxy(proxy: { type: string, httpPort: number, httpsPort: number, adminPort: number }): Promise<void> {
    const proxyBase = path.resolve(process.cwd(), 'docker/proxy', proxy.type)
    const imageMap: Record<string, string> = {
      caddy: 'caddy:2-alpine',
      traefik: 'traefik:v3',
      nginx: 'nginx:alpine'
    }
    const image = imageMap[proxy.type] || 'caddy:2-alpine'
    await DockerService.pullImage(image)

    const name = proxy.type

    // Stop + remove existing container first
    try {
      const docker = await getDocker()
      await docker.containerStop(name)
      await docker.containerDelete(name)
    } catch {}

    const volumes: { source: string, target: string }[] = []
    const portMappings = [
      { host: String(proxy.httpPort), container: '80', proto: 'tcp' },
      { host: String(proxy.httpsPort), container: '443', proto: 'tcp' }
    ]

    if (proxy.type === 'caddy') {
      volumes.push(
        { source: path.join(proxyBase, 'Caddyfile'), target: '/etc/caddy/Caddyfile' },
        { source: path.join(proxyBase, 'sites'), target: '/etc/caddy/sites' }
      )
      if (proxy.adminPort) {
        portMappings.push({ host: String(proxy.adminPort), container: '2019', proto: 'tcp' })
      }
    } else if (proxy.type === 'traefik') {
      volumes.push(
        { source: path.join(proxyBase, 'traefik.yml'), target: '/etc/traefik/traefik.yml' },
        { source: path.join(proxyBase, 'dynamic'), target: '/etc/traefik/dynamic' }
      )
      if (proxy.adminPort) {
        portMappings.push({ host: String(proxy.adminPort), container: '8080', proto: 'tcp' })
      }
    } else if (proxy.type === 'nginx') {
      volumes.push(
        { source: path.join(proxyBase, 'nginx.conf'), target: '/etc/nginx/nginx.conf' },
        { source: path.join(proxyBase, 'sites'), target: '/etc/nginx/sites-enabled' }
      )
    }

    await DockerService.createAndStartContainer({
      image,
      name,
      ports: portMappings,
      volumes
    })
  }

  static async stopProxy(type: string): Promise<void> {
    await DockerService.stopAndRemoveContainer(type)
  }

  static async deployService(svc: InfrastructureService): Promise<void> {
    const type = svc.serviceType!
    const image = svc.imageOverride || type.defaultImage!

    await DockerService.pullImage(image)

    await DockerService.createAndStartContainer({
      image,
      name: svc.containerName,
      env: Object.fromEntries((svc.envVars || []).map(e => [e.key, e.value])),
      ports: (svc.ports || []).map(p => ({
        host: p.hostPort,
        container: p.containerPort,
        proto: p.protocol
      })),
      volumes: (svc.volumes || []).map(v => ({ source: v.source, target: v.target }))
    })
  }

  static async deployWebsite(website: Website): Promise<void> {
    const { tag } = await DockerService.ensurePhpImage(website)

    // Website containers communicate internally via lardo network.
    // Only the reverse proxy exposes ports to the host.
    await DockerService.createAndStartContainer({
      image: tag,
      name: websiteContainerName(website.name),
      volumes: [
        { source: website.documentRoot, target: `/var/www/${slugify(website.name)}` }
      ]
    })
  }

  // ═══════════════════════════════════════════════════════════
  // Monitor: logs, container list
  // ═══════════════════════════════════════════════════════════

  static async getLogs(containerName: string, tail = 100): Promise<string> {
    try {
      const docker = await getDocker()
      // containerLogs(id, stdout, stderr, options) — 4 args
      const chunks: Buffer[] = []
      const stdout = new PassThrough()
      const stderr = new PassThrough()
      stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
      stderr.on('data', (chunk: Buffer) => chunks.push(chunk))

      await docker.containerLogs(containerName, stdout as any, stderr as any, {
        stdout: true,
        stderr: true,
        tail: String(tail)
      })

      return Buffer.concat(chunks).toString('utf-8')
    } catch {
      return ''
    }
  }

  static async listLardoContainers() {
    const docker = await getDocker()
    const containers = await docker.containerList({ all: true })
    return containers
      .filter((c: any) =>
        c.Names?.some((n: string) =>
          n.includes('website-') || n.includes('caddy') || n.includes('traefik') || n.includes('nginx')
        )
      )
      .map((c: any) => ({
        name: c.Names?.[0]?.replace('/', ''),
        image: c.Image,
        state: c.State,
        status: c.Status
      }))
  }

  static async getContainerStatuses(): Promise<Map<string, 'running' | 'stopped'>> {
    const result = new Map<string, 'running' | 'stopped'>()
    try {
      const docker = await getDocker()
      const containers = await docker.containerList({ all: true })
      for (const c of containers) {
        const name = (c as any).Names?.[0]?.replace('/', '')
        if (name) {
          result.set(name, (c as any).State === 'running' ? 'running' : 'stopped')
        }
      }
    } catch {
      // Docker not available — return empty map
    }
    return result
  }

  // ═══════════════════════════════════════════════════════════
  // Sync: so sanh Docker state thuc te voi DB
  // ═══════════════════════════════════════════════════════════

  static async syncContainersWithDB(): Promise<{
    running: { containerName: string, state: string }[]
    stopped: { containerName: string, state: string }[]
    missing: string[]
    total: number
  }> {
    const docker = await getDocker()
    const containers = await docker.containerList({ all: true })

    const dockerState = new Map<string, { state: string, status: string }>()
    for (const c of containers) {
      const name = (c as any).Names?.[0]?.replace('/', '')
      if (name) {
        dockerState.set(name, {
          state: (c as any).State,
          status: (c as any).Status
        })
      }
    }

    const services = await ServiceRepository.findAllServices()
    const websites = await WebsiteRepository.findAll({})
    const running: { containerName: string, state: string }[] = []
    const stopped: { containerName: string, state: string }[] = []
    const missing: string[] = []

    const expectedNames = [
      ...services.map(s => s.containerName),
      ...websites.map(w => websiteContainerName(w.name))
    ]

    for (const name of expectedNames) {
      const ds = dockerState.get(name)
      if (!ds) {
        missing.push(name)
      } else if (ds.state === 'running') {
        running.push({ containerName: name, state: ds.state })
      } else {
        stopped.push({ containerName: name, state: ds.state })
      }
    }

    return { running, stopped, missing, total: expectedNames.length }
  }
}
