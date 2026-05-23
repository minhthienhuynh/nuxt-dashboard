import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import type { Writable } from 'node:stream'
import { getDocker } from '../utils/docker'
import { SERVICE_DEFAULTS } from '../utils/service-defaults'
import type { InfrastructureService, Website, WebsitePhpExtension } from '~/types'

import { websiteContainerName } from '../utils/slugify'
import { getWebsiteTypeConfig, imageTagForType, DEFAULT_WEBSITE_TYPE } from '../utils/website-types'

const APP_NAME = process.env.APP_NAME || 'lardo'
const LARDO_NETWORK = `${APP_NAME}_proxy`

interface DockerSdkContainer {
  Names?: string[]
  Image?: string
  State?: string
  Status?: string
}

export const DockerService = {
  // ═══════════════════════════════════════════════════════════
  // Case 1: Pull pre-built image tu registry (MySQL, Redis, ...)
  // ═══════════════════════════════════════════════════════════

  async pullImage(image: string): Promise<void> {
    const docker = await getDocker()
    const [fromImage, tag = 'latest'] = image.split(':')
    await docker.imageCreate({ fromImage, tag })
  },

  // ═══════════════════════════════════════════════════════════
  // Case 2 & 3: Build PHP image + hash cache
  // Su dung docker CLI cho build vi @docker/node-sdk imageBuild
  // yeu cau tar stream — CLI don gian hon.
  // ═══════════════════════════════════════════════════════════

  computeBuildHash(type: string, phpVersion: string, extensionNames: string[], documentRoot: string): string {
    const sorted = [...extensionNames].sort()
    const dirName = path.basename(documentRoot)
    return createHash('sha256').update(`${type}:${phpVersion}:${sorted.join(',')}:${dirName}`).digest('hex')
  },

  buildPhpImage(website: Website): string {
    const type = website.type || DEFAULT_WEBSITE_TYPE
    const config = getWebsiteTypeConfig(type)
    const phpTag = config.phpTag(website.phpVersion)
    const imageTag = imageTagForType(website.name, website.phpVersion, type)
    const dirName = path.basename(website.documentRoot)

    const extensionNames = website.extensions
      ?.filter((e: WebsitePhpExtension) => e.enabled)
      .map((e: WebsitePhpExtension) => e.extension!.name) ?? []

    const buildArgs: string[] = [
      `PHP_TAG=${phpTag}`,
      `WORKDIR=/var/www/${dirName}`,
      `SUPERVISOR_PHP_COMMAND=${config.supervisorCommand(dirName)}`,
      `SUPERVISOR_PHP_USER=${config.supervisorUser}`,
      'COMPOSER_VERSION=2',
      'NODE_VERSION=22',
      'WWWGROUP=${WWWGROUP:-1000}',
      `PHP_EXTENSIONS=${extensionNames.join(' ')}`
    ]

    const context = path.resolve(process.cwd(), 'docker/php')
    const buildArgFlags = buildArgs.map(a => `--build-arg "${a}"`).join(' ')

    execSync(`docker build ${buildArgFlags} -t ${imageTag} ${context}`, {
      stdio: 'pipe'
    })

    return imageTag
  },

  needRebuild(website: Website): boolean {
    const type = website.type || DEFAULT_WEBSITE_TYPE
    const extensionNames = website.extensions
      ?.filter((e: WebsitePhpExtension) => e.enabled)
      .map((e: WebsitePhpExtension) => e.extension!.name) ?? []

    const newHash = DockerService.computeBuildHash(type, website.phpVersion, extensionNames, website.documentRoot)
    return website.buildHash !== newHash
  },

  async ensurePhpImage(website: Website): Promise<{ tag: string, rebuilt: boolean }> {
    if (DockerService.needRebuild(website)) {
      const tag = DockerService.buildPhpImage(website)
      const type = website.type || DEFAULT_WEBSITE_TYPE
      const extensionNames = website.extensions
        ?.filter((e: WebsitePhpExtension) => e.enabled)
        .map((e: WebsitePhpExtension) => e.extension!.name) ?? []
      const newHash = DockerService.computeBuildHash(type, website.phpVersion, extensionNames, website.documentRoot)
      await prisma.website.update({
        where: { id: website.id },
        data: { buildHash: newHash }
      })
      return { tag, rebuilt: true }
    }
    const type = website.type || DEFAULT_WEBSITE_TYPE
    return { tag: imageTagForType(website.name, website.phpVersion, type), rebuilt: false }
  },

  // ═══════════════════════════════════════════════════════════
  // Container orchestration
  // ═══════════════════════════════════════════════════════════

  async createAndStartContainer(config: {
    image: string
    name: string
    env?: Record<string, string>
    ports?: { host: string, container: string, proto?: string }[]
    volumes?: { source: string, target: string }[]
    network?: string
    cmd?: string[]
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
    const createSpec: Record<string, unknown> = {
      Image: config.image,
      Env: env,
      ExposedPorts: exposedPorts,
      Labels: {
        'com.docker.compose.project': APP_NAME
      },
      HostConfig: {
        PortBindings: portBindings,
        Binds: binds,
        NetworkMode: config.network || LARDO_NETWORK
      }
    }
    if (config.cmd?.length) {
      createSpec.Cmd = config.cmd
    }
    await docker.containerCreate(
      createSpec,
      { name: config.name }
    )

    await docker.containerStart(config.name)
  },

  async stopAndRemoveContainer(name: string): Promise<void> {
    const docker = await getDocker()
    try {
      await docker.containerStop(name)
      await docker.containerDelete(name)
    } catch {
      // Container co the da bi xoa tu ben ngoai
    }
  },

  async stopContainer(name: string): Promise<void> {
    const docker = await getDocker()
    await docker.containerStop(name)
  },

  async startContainer(name: string): Promise<void> {
    const docker = await getDocker()
    await docker.containerStart(name)
  },

  async restartContainer(name: string): Promise<void> {
    const docker = await getDocker()
    await docker.containerRestart(name)
  },

  async rebuildWebsite(website: Website): Promise<void> {
    const cName = websiteContainerName(website.name)
    try {
      await DockerService.stopAndRemoveContainer(cName)
    } catch { /* ok */ }
    // Reset build hash de force rebuild
    await prisma.website.update({
      where: { id: website.id },
      data: { buildHash: null }
    })
    website.buildHash = null
    await DockerService.deployWebsite(website)
  },

  async containerExists(name: string): Promise<boolean> {
    const docker = await getDocker()
    try {
      await docker.containerInspect(name)
      return true
    } catch {
      return false
    }
  },

  // ═══════════════════════════════════════════════════════════
  // Deploy
  // ═══════════════════════════════════════════════════════════

  async deployProxy(proxy: { type: string, httpPort: number, httpsPort: number, adminPort: number }): Promise<void> {
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
    } catch { /* container may already be removed */ }

    const volumes: { source: string, target: string }[] = []
    const portMappings = [
      { host: String(proxy.httpPort), container: '80', proto: 'tcp' },
      { host: String(proxy.httpsPort), container: '443', proto: 'tcp' }
    ]

    if (proxy.type === 'caddy') {
      volumes.push(
        { source: path.join(proxyBase, 'Caddyfile'), target: '/etc/caddy/Caddyfile' },
        { source: path.join(proxyBase, 'sites'), target: '/etc/caddy/sites' },
        { source: path.resolve(process.cwd(), '..', 'www'), target: '/var/www' }
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
  },

  async stopProxy(type: string): Promise<void> {
    await DockerService.stopAndRemoveContainer(type)
  },

  async deployService(svc: InfrastructureService): Promise<void> {
    const type = svc.serviceType!
    const image = svc.imageOverride || type.defaultImage!

    await DockerService.pullImage(image)

    const ports = (svc.ports || []).map(p => ({
      host: p.hostPort,
      container: p.containerPort,
      proto: p.protocol
    }))

    const defaults = SERVICE_DEFAULTS[type.key]
    const cmd = defaults?.cmd

    await DockerService.createAndStartContainer({
      image,
      name: svc.containerName,
      env: Object.fromEntries((svc.envVars || []).map(e => [e.key, e.value])),
      ports,
      volumes: (svc.volumes || []).map(v => ({ source: v.source, target: v.target })),
      cmd
    })
  },

  async deployWebsite(website: Website): Promise<void> {
    const { tag } = await DockerService.ensurePhpImage(website)

    const dirName = path.basename(website.documentRoot)
    const type = website.type || DEFAULT_WEBSITE_TYPE
    const config = getWebsiteTypeConfig(type)

    const ports: { host: string, container: string, proto: string }[] = []
    if (website.port && website.port > 0) {
      ports.push({
        host: String(website.port),
        container: config.proxyPort,
        proto: 'tcp'
      })
    }

    // Website containers communicate internally via lardo network.
    // Only the reverse proxy exposes ports to the host.
    await DockerService.createAndStartContainer({
      image: tag,
      name: websiteContainerName(website.name),
      ports,
      volumes: [
        { source: website.documentRoot, target: `/var/www/${dirName}` }
      ]
    })
  },

  // ═══════════════════════════════════════════════════════════
  // Monitor: logs, container list
  // ═══════════════════════════════════════════════════════════

  async* getLogStream(
    containerName: string,
    tail = 100,
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    const docker = await getDocker()
    const pt = new PassThrough()

    // Fire-and-forget — streams indefinitely with follow:true
    docker.containerLogs(containerName, pt as unknown as Writable, pt as unknown as Writable, {
      stdout: true,
      stderr: true,
      tail: String(tail),
      follow: true
    }).catch((err: unknown) => {
      pt.destroy(err instanceof Error ? err : new Error(String(err)))
    })

    signal?.addEventListener('abort', () => pt.destroy(), { once: true })

    let buffer = ''
    let resolve: (value: IteratorResult<string>) => void
    let promise = new Promise<IteratorResult<string>>((r) => {
      resolve = r
    })
    let done = false

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        resolve({ value: line, done: false })
        promise = new Promise<IteratorResult<string>>((r) => {
          resolve = r
        })
      }
    }

    const onEnd = () => {
      const value = buffer ? buffer : undefined
      done = true
      resolve({ value: value as string, done: true })
    }

    const onError = () => {
      done = true
      resolve({ value: undefined as unknown as string, done: true })
    }

    pt.on('data', onData)
    pt.on('end', onEnd)
    pt.on('error', onError)

    try {
      while (true) {
        const result = await promise
        if (result.done) break
        yield result.value
      }
    } finally {
      pt.off('data', onData)
      pt.off('end', onEnd)
      pt.off('error', onError)
      if (!done) pt.destroy()
    }
  },

  async getLogs(containerName: string, tail = 100): Promise<string> {
    try {
      const docker = await getDocker()
      // containerLogs(id, stdout, stderr, options) — 4 args
      const chunks: Buffer[] = []
      const stdout = new PassThrough()
      const stderr = new PassThrough()
      stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
      stderr.on('data', (chunk: Buffer) => chunks.push(chunk))

      await docker.containerLogs(containerName, stdout as unknown as Writable, stderr as unknown as Writable, {
        stdout: true,
        stderr: true,
        tail: String(tail)
      })

      return Buffer.concat(chunks).toString('utf-8')
    } catch {
      return ''
    }
  },

  async listLardoContainers() {
    const docker = await getDocker()
    const containers = await docker.containerList({ all: true })
    return containers
      .filter((c: DockerSdkContainer) =>
        c.Names?.some((n: string) =>
          n.includes('website-') || n.includes('caddy') || n.includes('traefik') || n.includes('nginx')
        )
      )
      .map((c: DockerSdkContainer) => ({
        name: c.Names?.[0]?.replace('/', ''),
        image: c.Image ?? '',
        state: c.State ?? '',
        status: c.Status ?? ''
      }))
  },

  async getContainerStatus(name: string): Promise<'running' | 'stopped' | 'error'> {
    try {
      const docker = await getDocker()
      const info = await docker.containerInspect(name)
      const state = (info as unknown as { State?: { Status?: string, ExitCode?: number } })?.State
      if (state?.Status === 'running') return 'running'
      if (state?.ExitCode !== undefined && state.ExitCode !== 0) return 'error'
      return 'stopped'
    } catch {
      return 'stopped'
    }
  },

  async getContainerStatuses(): Promise<Map<string, 'running' | 'stopped'>> {
    const result = new Map<string, 'running' | 'stopped'>()
    try {
      const docker = await getDocker()
      const containers = await docker.containerList({ all: true })
      for (const c of containers) {
        const container = c as unknown as DockerSdkContainer
        const name = container.Names?.[0]?.replace('/', '')
        if (name) {
          result.set(name, container.State === 'running' ? 'running' : 'stopped')
        }
      }
    } catch {
      // Docker not available — return empty map
    }
    return result
  }
}
