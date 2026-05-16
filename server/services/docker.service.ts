import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { Writable, PassThrough } from 'node:stream'
import { getDocker } from '../utils/docker'
import { ServiceRepository } from '../repositories/service.repository'
import type { InfrastructureService, Website } from '~/types'

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
    const imageTag = `website-${website.name}:latest`

    const extensionNames = website.extensions
      ?.filter((e: any) => e.enabled)
      .map((e: any) => e.extension!.name) ?? []

    const buildArgs: string[] = [
      `PHP_TAG=${website.phpVersion}-fpm`,
      `WORKDIR=/var/www/${website.name}`,
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

    const context = process.env.LARDO_PHP_PATH || '/Users/huynhminhthien/Workspaces/lardo/php'
    const buildArgFlags = buildArgs.map(a => `--build-arg ${a}`).join(' ')

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
    return { tag: `website-${website.name}:latest`, rebuilt: false }
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

    await prisma.infrastructureService.updateMany({
      where: { containerName: config.name },
      data: { status: 'running' }
    })
  }

  static async stopAndRemoveContainer(name: string): Promise<void> {
    const docker = await getDocker()
    try {
      await docker.containerStop(name)
      await docker.containerDelete(name)
    } catch {
      // Container co the da bi xoa tu ben ngoai
    }
    await prisma.infrastructureService.updateMany({
      where: { containerName: name },
      data: { status: 'stopped' }
    })
  }

  // ═══════════════════════════════════════════════════════════
  // Deploy
  // ═══════════════════════════════════════════════════════════

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

    await DockerService.createAndStartContainer({
      image: tag,
      name: `website-${website.name}`,
      ports: [
        { host: String(website.port), container: '80', proto: 'tcp' },
        ...(website.sslEnabled ? [{ host: '443', container: '443', proto: 'tcp' }] : [])
      ],
      volumes: [
        { source: website.documentRoot, target: `/var/www/${website.name}` }
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

  // ═══════════════════════════════════════════════════════════
  // Sync: so sanh Docker state thuc te voi DB, cap nhat DB
  // ═══════════════════════════════════════════════════════════

  static async syncContainersWithDB(): Promise<{
    updated: { containerName: string, oldStatus: string, newStatus: string }[]
    missing: string[]
    total: number
  }> {
    const docker = await getDocker()
    const containers = await docker.containerList({ all: true })

    const dockerState = new Map<string, string>()
    for (const c of containers) {
      const name = (c as any).Names?.[0]?.replace('/', '')
      if (name) {
        const state = (c as any).State
        dockerState.set(name, state === 'running' ? 'running' : 'stopped')
      }
    }

    const services = await ServiceRepository.findAllServices()
    const updated: { containerName: string, oldStatus: string, newStatus: string }[] = []
    const missing: string[] = []

    for (const svc of services) {
      const dockerStatus = dockerState.get(svc.containerName)
      if (!dockerStatus) {
        if (svc.status !== 'error') {
          missing.push(svc.containerName)
          await prisma.infrastructureService.update({
            where: { id: svc.id },
            data: { status: 'error' }
          })
          updated.push({ containerName: svc.containerName, oldStatus: svc.status, newStatus: 'error' })
        }
      } else if (dockerStatus !== svc.status) {
        await prisma.infrastructureService.update({
          where: { id: svc.id },
          data: { status: dockerStatus as 'running' | 'stopped' }
        })
        updated.push({ containerName: svc.containerName, oldStatus: svc.status, newStatus: dockerStatus })
      }
    }

    return { updated, missing, total: services.length }
  }
}
