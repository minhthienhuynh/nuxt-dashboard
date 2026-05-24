import path from 'node:path'
import { DockerImageService } from './docker-image.service'
import { DockerContainerService } from './docker-container.service'
import { WebsiteRepository } from '../repositories/website.repository'
import { SERVICE_DEFAULTS } from '../utils/service-defaults'
import { getWebsiteTypeConfig, imageTagForType, DEFAULT_WEBSITE_TYPE } from '../utils/website-types'
import { websiteContainerName } from '../utils/slugify'
import type { Website, InfrastructureService, WebsitePhpExtension } from '~/types'

export const DockerDeploymentService = {
  async ensurePhpImage(website: Website): Promise<{ tag: string, rebuilt: boolean }> {
    const type = website.type || DEFAULT_WEBSITE_TYPE
    const extensionNames = website.extensions
      ?.filter((e: WebsitePhpExtension) => e.enabled)
      .map((e: WebsitePhpExtension) => e.extension!.name) ?? []

    if (DockerImageService.needRebuild(website)) {
      const tag = await DockerImageService.buildPhpImage(website)
      const newHash = DockerImageService.computeBuildHash(type, website.phpVersion, extensionNames, website.documentRoot)
      await WebsiteRepository.updateBuildHash(website.id, newHash)
      return { tag, rebuilt: true }
    }
    return { tag: imageTagForType(website.name, website.phpVersion, type), rebuilt: false }
  },

  async deployWebsite(website: Website): Promise<void> {
    const { tag } = await DockerDeploymentService.ensurePhpImage(website)
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

    await DockerContainerService.createAndStartContainer({
      image: tag,
      name: websiteContainerName(website.name),
      ports,
      volumes: [
        { source: website.documentRoot, target: `/var/www/${dirName}` }
      ]
    })
  },

  async rebuildWebsite(website: Website): Promise<void> {
    const cName = websiteContainerName(website.name)
    try {
      await DockerContainerService.stopAndRemoveContainer(cName)
    } catch { /* ok */ }
    // Reset build hash để force rebuild
    await WebsiteRepository.updateBuildHash(website.id, null)
    website.buildHash = null
    await DockerDeploymentService.deployWebsite(website)
  },

  async deployProxy(proxy: { type: string, httpPort: number, httpsPort: number, adminPort: number }): Promise<void> {
    const proxyBase = path.resolve(process.cwd(), 'docker/proxy', proxy.type)
    const imageMap: Record<string, string> = {
      caddy: 'caddy:2-alpine',
      traefik: 'traefik:v3',
      nginx: 'nginx:alpine'
    }
    const image = imageMap[proxy.type] || 'caddy:2-alpine'
    await DockerImageService.pullImage(image)

    const name = proxy.type

    try {
      await DockerContainerService.stopAndRemoveContainer(name)
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

    await DockerContainerService.createAndStartContainer({
      image,
      name,
      ports: portMappings,
      volumes
    })
  },

  async stopProxy(type: string): Promise<void> {
    await DockerContainerService.stopAndRemoveContainer(type)
  },

  async deployService(svc: InfrastructureService): Promise<void> {
    const type = svc.serviceType!
    const image = svc.imageOverride || type.defaultImage!
    await DockerImageService.pullImage(image)

    const ports = (svc.ports || []).map(p => ({
      host: p.hostPort,
      container: p.containerPort,
      proto: p.protocol
    }))

    const defaults = SERVICE_DEFAULTS[type.key]
    const cmd = defaults?.cmd

    await DockerContainerService.createAndStartContainer({
      image,
      name: svc.containerName,
      env: Object.fromEntries((svc.envVars || []).map(e => [e.key, e.value])),
      ports,
      volumes: (svc.volumes || []).map(v => ({ source: v.source, target: v.target })),
      cmd
    })
  },

  async rebuildService(svc: InfrastructureService): Promise<void> {
    try {
      await DockerContainerService.stopAndRemoveContainer(svc.containerName)
    } catch { /* container might not exist */ }
    await DockerDeploymentService.deployService(svc)
  }
}
