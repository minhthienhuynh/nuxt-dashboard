import { access, readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { ProxyRepository } from '../repositories/proxy.repository'
import { WebsiteRepository } from '../repositories/website.repository'
import { websiteContainerName } from '../utils/slugify'
import { getWebsiteTypeConfig, DEFAULT_WEBSITE_TYPE } from '../utils/website-types'

const PROXY_BASE = path.resolve(process.cwd(), 'docker/proxy')

interface WebsiteForProxy {
  name: string
  domain: string
  type: string
  port: number
  documentRoot: string
  sslEnabled: boolean
}

const STUB_DIR = {
  caddy: path.join(PROXY_BASE, 'caddy/stubs'),
  traefik: path.join(PROXY_BASE, 'traefik/stubs'),
  nginx: path.join(PROXY_BASE, 'nginx/stubs')
} as const

export const ProxyConfigService = {
  async generateAll(): Promise<void> {
    const proxy = await ProxyRepository.getOrCreate()
    const websites = await WebsiteRepository.findAll({})

    const siteList: WebsiteForProxy[] = websites.map(w => ({
      name: w.name,
      domain: w.domain,
      type: w.type || DEFAULT_WEBSITE_TYPE,
      port: w.port,
      documentRoot: w.documentRoot,
      sslEnabled: w.sslEnabled
    }))

    switch (proxy.type) {
      case 'caddy': return ProxyConfigService.generateCaddy(siteList)
      case 'traefik': return ProxyConfigService.generateTraefik(siteList)
      case 'nginx': return ProxyConfigService.generateNginx(siteList)
    }
  },

  async generateForWebsite(website: WebsiteForProxy): Promise<void> {
    const proxy = await ProxyRepository.getOrCreate()
    switch (proxy.type) {
      case 'caddy': return ProxyConfigService.writeCaddySite(website)
      case 'traefik': return ProxyConfigService.writeTraefikSite(website)
      case 'nginx': return ProxyConfigService.writeNginxSite(website)
    }
  },

  async removeForWebsite(name: string): Promise<void> {
    const caddyFile = path.join(PROXY_BASE, 'caddy/sites', `${name}.conf`)
    const traefikFile = path.join(PROXY_BASE, 'traefik/dynamic', `${name}.yml`)
    const nginxFile = path.join(PROXY_BASE, 'nginx/sites', `${name}.conf`)

    for (const f of [caddyFile, traefikFile, nginxFile]) {
      try {
        await access(f)
        await unlink(f)
      } catch {
        // File doesn't exist, skip
      }
    }
  },

  // ── Caddy ──────────────────────────────────────────────

  async generateCaddy(sites: WebsiteForProxy[]): Promise<void> {
    await mkdir(path.join(PROXY_BASE, 'caddy/sites'), { recursive: true })
    for (const site of sites) {
      await ProxyConfigService.writeCaddySite(site)
    }
  },

  async writeCaddySite(site: WebsiteForProxy): Promise<void> {
    const config = getWebsiteTypeConfig(site.type)
    const stub = await readFile(path.join(STUB_DIR.caddy, `${config.proxyStub}.conf.stub`), 'utf-8')
    const dirName = path.basename(site.documentRoot)
    const scheme = site.sslEnabled ? '' : 'http://'
    const tls = site.sslEnabled ? '    tls internal\n' : ''
    const content = stub
      .replace(/\{\{DOMAIN\}\}/g, `${scheme}${site.domain}`)
      .replace(/\{\{TLS\}\}/g, tls)
      .replace(/\{\{SERVICE\}\}/g, websiteContainerName(site.name))
      .replace(/\{\{DIR_NAME\}\}/g, dirName)
      .replace(/\{\{PORT\}\}/g, config.proxyPort)

    await mkdir(path.join(PROXY_BASE, 'caddy/sites'), { recursive: true })
    await writeFile(path.join(PROXY_BASE, 'caddy/sites', `${site.name}.conf`), content)
  },

  // ── Traefik ────────────────────────────────────────────

  async generateTraefik(sites: WebsiteForProxy[]): Promise<void> {
    await mkdir(path.join(PROXY_BASE, 'traefik/dynamic'), { recursive: true })
    for (const site of sites) {
      await ProxyConfigService.writeTraefikSite(site)
    }
  },

  async writeTraefikSite(site: WebsiteForProxy): Promise<void> {
    const stub = await readFile(path.join(STUB_DIR.traefik, 'dynamic.conf.stub'), 'utf-8')
    const content = stub
      .replace(/\{\{DOMAIN\}\}/g, site.domain)
      .replace(/\{\{SERVICE\}\}/g, websiteContainerName(site.name))
      .replace(/\{\{PORT\}\}/g, '80')

    await mkdir(path.join(PROXY_BASE, 'traefik/dynamic'), { recursive: true })
    await writeFile(path.join(PROXY_BASE, 'traefik/dynamic', `${site.name}.yml`), content)
  },

  // ── Nginx ──────────────────────────────────────────────

  async generateNginx(sites: WebsiteForProxy[]): Promise<void> {
    await mkdir(path.join(PROXY_BASE, 'nginx/sites'), { recursive: true })
    for (const site of sites) {
      await ProxyConfigService.writeNginxSite(site)
    }
  },

  async writeNginxSite(site: WebsiteForProxy): Promise<void> {
    const config = getWebsiteTypeConfig(site.type)
    const stub = await readFile(path.join(STUB_DIR.nginx, `${config.proxyStub}.conf.stub`), 'utf-8')
    const content = stub
      .replace(/\{\{DOMAIN\}\}/g, site.domain)
      .replace(/\{\{SERVICE\}\}/g, websiteContainerName(site.name))
      .replace(/\{\{PORT\}\}/g, config.proxyPort)

    await mkdir(path.join(PROXY_BASE, 'nginx/sites'), { recursive: true })
    await writeFile(path.join(PROXY_BASE, 'nginx/sites', `${site.name}.conf`), content)
  }
}
