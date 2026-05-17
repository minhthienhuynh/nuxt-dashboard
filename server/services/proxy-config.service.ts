import fs from 'node:fs'
import path from 'node:path'
import { ProxyRepository } from '../repositories/proxy.repository'
import { WebsiteRepository } from '../repositories/website.repository'
import { websiteContainerName } from '../utils/slugify'

const PROXY_BASE = path.resolve(process.cwd(), 'docker/proxy')

interface WebsiteForProxy {
  name: string
  domain: string
  port: number
  documentRoot: string
}

const STUB_DIR = {
  caddy: path.join(PROXY_BASE, 'caddy/stubs'),
  traefik: path.join(PROXY_BASE, 'traefik/stubs'),
  nginx: path.join(PROXY_BASE, 'nginx/stubs')
} as const

export class ProxyConfigService {
  static async generateAll(): Promise<void> {
    const proxy = await ProxyRepository.getOrCreate()
    const websites = await WebsiteRepository.findAll({})

    const siteList: WebsiteForProxy[] = websites.map(w => ({
      name: w.name,
      domain: w.domain,
      port: w.port,
      documentRoot: w.documentRoot
    }))

    switch (proxy.type) {
      case 'caddy': return ProxyConfigService.generateCaddy(siteList)
      case 'traefik': return ProxyConfigService.generateTraefik(siteList)
      case 'nginx': return ProxyConfigService.generateNginx(siteList)
    }
  }

  static async generateForWebsite(website: WebsiteForProxy): Promise<void> {
    const proxy = await ProxyRepository.getOrCreate()
    switch (proxy.type) {
      case 'caddy': return ProxyConfigService.writeCaddySite(website)
      case 'traefik': return ProxyConfigService.writeTraefikSite(website)
      case 'nginx': return ProxyConfigService.writeNginxSite(website)
    }
  }

  static removeForWebsite(name: string): void {
    const caddyFile = path.join(PROXY_BASE, 'caddy/sites', `${name}.conf`)
    const traefikFile = path.join(PROXY_BASE, 'traefik/dynamic', `${name}.yml`)
    const nginxFile = path.join(PROXY_BASE, 'nginx/sites', `${name}.conf`)

    for (const f of [caddyFile, traefikFile, nginxFile]) {
      if (fs.existsSync(f)) fs.unlinkSync(f)
    }
  }

  // ── Caddy ──────────────────────────────────────────────

  private static generateCaddy(sites: WebsiteForProxy[]): void {
    fs.mkdirSync(path.join(PROXY_BASE, 'caddy/sites'), { recursive: true })
    for (const site of sites) {
      ProxyConfigService.writeCaddySite(site)
    }
  }

  private static writeCaddySite(site: WebsiteForProxy): void {
    const stub = fs.readFileSync(path.join(STUB_DIR.caddy, 'fpm.conf.stub'), 'utf-8')
    const dirName = path.basename(site.documentRoot)
    const content = stub
      .replace(/\{\{DOMAIN\}\}/g, site.domain)
      .replace(/\{\{SERVICE\}\}/g, websiteContainerName(site.name))
      .replace(/\{\{DIR_NAME\}\}/g, dirName)
      .replace(/\{\{PORT\}\}/g, '9000')

    fs.mkdirSync(path.join(PROXY_BASE, 'caddy/sites'), { recursive: true })
    fs.writeFileSync(path.join(PROXY_BASE, 'caddy/sites', `${site.name}.conf`), content)
  }

  // ── Traefik ────────────────────────────────────────────

  private static generateTraefik(sites: WebsiteForProxy[]): void {
    fs.mkdirSync(path.join(PROXY_BASE, 'traefik/dynamic'), { recursive: true })
    for (const site of sites) {
      ProxyConfigService.writeTraefikSite(site)
    }
  }

  private static writeTraefikSite(site: WebsiteForProxy): void {
    const stub = fs.readFileSync(path.join(STUB_DIR.traefik, 'dynamic.conf.stub'), 'utf-8')
    const content = stub
      .replace(/\{\{DOMAIN\}\}/g, site.domain)
      .replace(/\{\{SERVICE\}\}/g, websiteContainerName(site.name))
      .replace(/\{\{PORT\}\}/g, '80')

    fs.mkdirSync(path.join(PROXY_BASE, 'traefik/dynamic'), { recursive: true })
    fs.writeFileSync(path.join(PROXY_BASE, 'traefik/dynamic', `${site.name}.yml`), content)
  }

  // ── Nginx ──────────────────────────────────────────────

  private static generateNginx(sites: WebsiteForProxy[]): void {
    fs.mkdirSync(path.join(PROXY_BASE, 'nginx/sites'), { recursive: true })
    for (const site of sites) {
      ProxyConfigService.writeNginxSite(site)
    }
  }

  private static writeNginxSite(site: WebsiteForProxy): void {
    const stub = fs.readFileSync(path.join(STUB_DIR.nginx, 'fpm.conf.stub'), 'utf-8')
    const content = stub
      .replace(/\{\{DOMAIN\}\}/g, site.domain)
      .replace(/\{\{SERVICE\}\}/g, websiteContainerName(site.name))
      .replace(/\{\{PORT\}\}/g, '9000')

    fs.mkdirSync(path.join(PROXY_BASE, 'nginx/sites'), { recursive: true })
    fs.writeFileSync(path.join(PROXY_BASE, 'nginx/sites', `${site.name}.conf`), content)
  }
}
